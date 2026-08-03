import "server-only";

import { createHash } from "node:crypto";

import { parsePublishedCatalogProjection } from "@/lib/published-catalog/contracts";
import {
  createProjectBoundSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/client.server";

import {
  calculateProductCharacteristicsWave1PatchManifestSha256,
  PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST,
  PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST_SHA256,
  type ProductCharacteristicsWave1PatchEntry,
} from "./product-characteristics-wave-1-patch-manifest";

const CORPORATE_ACTOR_ID = "7e90a993-8b30-4e0d-aff4-a257d5a4a179";
const CLOUD_API_HEADERS = {
  "Accept-Profile": "cloud_api",
  "Content-Profile": "cloud_api",
  "Content-Type": "application/json",
} as const;

type CatalogAdminProduct = {
  id?: unknown;
  slug?: unknown;
  model?: unknown;
  publicationStatus?: unknown;
  reviewState?: unknown;
  published?: unknown;
  updatedAt?: unknown;
  characteristics?: unknown;
  immutable?: {
    sourceUid?: unknown;
    sourceChecksum?: unknown;
    rawSnapshot?: unknown;
  } | null;
};
type CatalogAdminInventory = { items?: unknown; total?: unknown };
type PatchRpcResult = {
  status?: unknown;
  productId?: unknown;
  draftUpdatedAt?: unknown;
  payloadChecksum?: unknown;
  characteristicCount?: unknown;
};

export type ProductCharacteristicsWave1PatchEvidence = Readonly<{
  productId: string;
  sourceUid: string;
  model: string;
  status: "applied" | "already_applied";
  draftUpdatedAt: string;
  payloadChecksum: string;
  characteristicCount: 10;
}>;

export type ProductCharacteristicsWave1PatchResult = Readonly<{
  status: "completed" | "already_complete";
  operationKey: string;
  manifestSha256: string;
  applied: number;
  alreadyApplied: number;
  replay: "already_applied";
  patches: readonly ProductCharacteristicsWave1PatchEvidence[];
  projectionHashBefore: string;
  projectionHashAfter: string;
  publishedProducts: 71;
}>;

export class ProductCharacteristicsWave1PatchRunnerError extends Error {
  readonly code: string;
  constructor(code: string) {
    super("Characteristics Wave 1 patch operation failed closed.");
    this.name = "ProductCharacteristicsWave1PatchRunnerError";
    this.code = code;
  }
}

function fail(code: string): never {
  throw new ProductCharacteristicsWave1PatchRunnerError(code);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

async function callCloudApi<T>(
  client: SupabaseServerClient,
  rpc: string,
  body: Readonly<Record<string, unknown>>,
): Promise<T> {
  if (client.access !== "service_role") fail("service_role_required");
  const response = await client.request(`/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: CLOUD_API_HEADERS,
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

async function readCatalogProduct(client: SupabaseServerClient, productId: string) {
  return callCloudApi<CatalogAdminProduct | null>(client, "catalog_admin_product", {
    p_id: productId,
  });
}

async function readInventory(client: SupabaseServerClient) {
  return callCloudApi<CatalogAdminInventory>(client, "catalog_admin_products", {
    p_search: null,
    p_filter: "all",
    p_sort: "updated",
  });
}

async function readPublishedProjection(client: SupabaseServerClient) {
  const value = await callCloudApi<unknown>(
    client,
    "cloud_published_storefront_catalog_v1",
    {},
  );
  return parsePublishedCatalogProjection(value);
}

async function mapWithConcurrency<T, U>(
  values: readonly T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<U>,
) {
  const results = new Array<U>(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function assertManifest() {
  const manifest = PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST;
  const ids = new Set(manifest.entries.map(({ productId }) => productId));
  const sourceUids = new Set(manifest.entries.map(({ sourceUid }) => sourceUid));
  if (
    calculateProductCharacteristicsWave1PatchManifestSha256()
      !== PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST_SHA256
    || manifest.manifestSha256 !== PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST_SHA256
    || manifest.operationKey !== "product-characteristics-wave-1-patch-v1"
    || manifest.sourceArtifactSha256
      !== "1a46847aaa4859ede519070af5b890190f9d6ba4eaed77de04e14f57248d9978"
    || manifest.productCount !== 15
    || manifest.entries.length !== 15
    || ids.size !== 15
    || sourceUids.size !== 15
    || manifest.entries.some((entry) =>
      entry.characteristics.length !== 10
      || new Set(entry.characteristics.map(({ key }) => key.toLowerCase())).size !== 10
      || entry.characteristics.some((characteristic) =>
        characteristic.contentKind !== "technical_specification"
        || characteristic.recordOrigin !== "authoritative_wave_1_preparation"
        || characteristic.confidence !== "High"
        || !characteristic.sourceUrl.startsWith("https://")
        || !characteristic.evidenceLocation.trim()))
  ) fail("manifest_scope_invalid");
}

function assertCatalogProduct(
  entry: ProductCharacteristicsWave1PatchEntry,
  product: CatalogAdminProduct | null,
) {
  if (!product || product.id !== entry.productId) fail("catalog_product_binding_drift");
  if (product.slug !== entry.slug || product.model !== entry.model) {
    fail("catalog_product_identity_drift");
  }
  if (
    product.published !== true
    || product.publicationStatus !== "published"
    || product.reviewState !== "published"
  ) fail("catalog_product_publication_drift");
  if (typeof product.updatedAt !== "string" || !product.updatedAt.trim()) {
    fail("catalog_product_stale_token_missing");
  }
  if (
    !Array.isArray(product.characteristics)
    || product.characteristics.length !== entry.expectedCurrentCharacteristics
  ) fail("catalog_product_characteristics_drift");
  if (product.immutable?.sourceUid !== entry.sourceUid) fail("catalog_product_source_uid_drift");
  if (
    typeof product.immutable.sourceChecksum !== "string"
    || !product.immutable.sourceChecksum.trim()
  ) {
    fail("catalog_product_source_checksum_missing");
  }
  if (!product.immutable.rawSnapshot || typeof product.immutable.rawSnapshot !== "object") {
    fail("catalog_product_raw_snapshot_missing");
  }
}

async function applyPatch(
  client: SupabaseServerClient,
  entry: ProductCharacteristicsWave1PatchEntry,
  expectedUpdatedAt: string,
) {
  const result = await callCloudApi<PatchRpcResult>(
    client,
    "catalog_admin_patch_product_characteristics_v1",
    {
      p_product_id: entry.productId,
      p_expected_updated_at: expectedUpdatedAt,
      p_locale: "ru",
      p_product_patch: entry.productPatch,
      p_description_patch: entry.descriptionPatch,
      p_characteristics: entry.characteristics,
      p_actor_id: CORPORATE_ACTOR_ID,
      p_request_id: entry.requestId,
    },
  );
  if (
    (result.status !== "applied" && result.status !== "already_applied")
    || result.productId !== entry.productId
    || typeof result.draftUpdatedAt !== "string"
    || typeof result.payloadChecksum !== "string"
    || !/^[a-f0-9]{64}$/u.test(result.payloadChecksum)
    || result.characteristicCount !== 10
  ) fail("patch_result_invalid");
  return {
    productId: entry.productId,
    sourceUid: entry.sourceUid,
    model: entry.model,
    status: result.status,
    draftUpdatedAt: result.draftUpdatedAt,
    payloadChecksum: result.payloadChecksum,
    characteristicCount: 10,
  } satisfies ProductCharacteristicsWave1PatchEvidence;
}

export async function executeProductionProductCharacteristicsWave1Patches(): Promise<
  ProductCharacteristicsWave1PatchResult
> {
  assertManifest();
  const manifest = PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST;
  const client = createProjectBoundSupabaseServerClient();
  if (client.access !== "service_role") fail("service_role_required");

  const [inventoryBefore, projectionBefore, productsBefore] = await Promise.all([
    readInventory(client),
    readPublishedProjection(client),
    mapWithConcurrency(manifest.entries, 2, ({ productId }) =>
      readCatalogProduct(client, productId)),
  ]);
  if (
    inventoryBefore.total !== 79
    || !Array.isArray(inventoryBefore.items)
    || inventoryBefore.items.length !== 79
    || projectionBefore.products.length !== 71
  ) fail("production_baseline_drift");
  productsBefore.forEach((product, index) =>
    assertCatalogProduct(manifest.entries[index], product));

  const beforeProductHashes = productsBefore.map(sha256);
  const projectionHashBefore = sha256(projectionBefore);
  const firstResults = await mapWithConcurrency(manifest.entries, 2, (entry, index) =>
    applyPatch(client, entry, productsBefore[index]?.updatedAt as string));
  const applied = firstResults.filter(({ status }) => status === "applied").length;
  const alreadyApplied = firstResults.length - applied;

  const replayResults = await mapWithConcurrency(manifest.entries, 2, (entry, index) =>
    applyPatch(client, entry, productsBefore[index]?.updatedAt as string));
  if (replayResults.some(({ status }) => status !== "already_applied")) {
    fail("patch_replay_failed");
  }

  const [inventoryAfter, projectionAfter, productsAfter] = await Promise.all([
    readInventory(client),
    readPublishedProjection(client),
    mapWithConcurrency(manifest.entries, 2, ({ productId }) =>
      readCatalogProduct(client, productId)),
  ]);
  if (
    inventoryAfter.total !== 79
    || !Array.isArray(inventoryAfter.items)
    || inventoryAfter.items.length !== 79
    || projectionAfter.products.length !== 71
  ) fail("production_post_patch_drift");
  productsAfter.forEach((product, index) => {
    assertCatalogProduct(manifest.entries[index], product);
    if (sha256(product) !== beforeProductHashes[index]) fail("canonical_source_row_changed");
  });
  const projectionHashAfter = sha256(projectionAfter);
  if (projectionHashAfter !== projectionHashBefore) fail("published_projection_changed");

  return {
    status: applied === 0 ? "already_complete" : "completed",
    operationKey: manifest.operationKey,
    manifestSha256: manifest.manifestSha256,
    applied,
    alreadyApplied,
    replay: "already_applied",
    patches: firstResults,
    projectionHashBefore,
    projectionHashAfter,
    publishedProducts: 71,
  };
}
