import "server-only";

import {
  approveProductPublicationRevision,
  publishProduct,
} from "@/lib/product-publication/server";
import { parsePublishedCatalogProjection } from "@/lib/published-catalog/contracts";
import {
  createProjectBoundSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/client.server";

import {
  calculateIdn03PublicationManifestSha256,
  IDN_03_APPROVAL_IDEMPOTENCY_KEY,
  IDN_03_PUBLICATION_MANIFEST,
  IDN_03_PUBLICATION_MANIFEST_SHA256,
} from "./idn-03-publication-manifest";

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
  immutable?: { sourceUid?: unknown; sourceChecksum?: unknown } | null;
};

export type Idn03PublicationResult = Readonly<{
  status: "completed" | "already_complete";
  approvalId: string;
  publicationBatchId: string;
  productUrl: string;
  publicationVersion: number;
  totals: Readonly<{
    products: 79;
    published: 71;
    revisions: 71;
    decisions: 71;
    approvals: 71;
    publicationBatches: 71;
  }>;
}>;

export class Idn03PublicationRunnerError extends Error {
  readonly code: string;
  constructor(code: string) {
    super("IDN-03 publication operation failed closed.");
    this.name = "Idn03PublicationRunnerError";
    this.code = code;
  }
}

function fail(code: string): never {
  throw new Idn03PublicationRunnerError(code);
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

async function readProduct(client: SupabaseServerClient, productId: string) {
  return callCloudApi<CatalogAdminProduct | null>(client, "catalog_admin_product", {
    p_id: productId,
  });
}

async function readProjection(client: SupabaseServerClient) {
  return parsePublishedCatalogProjection(await callCloudApi<unknown>(
    client,
    "cloud_published_storefront_catalog_v1",
    {},
  ));
}

function assertManifest() {
  const [entry] = IDN_03_PUBLICATION_MANIFEST.entries;
  const checksum = /^[a-f0-9]{64}$/u;
  if (
    calculateIdn03PublicationManifestSha256() !== IDN_03_PUBLICATION_MANIFEST_SHA256
    || IDN_03_PUBLICATION_MANIFEST.productCount !== 1
    || IDN_03_APPROVAL_IDEMPOTENCY_KEY !== "idn-03-approval-v1"
    || !entry
    || entry.productId !== "24ac72fc-5c64-4f4e-9f92-cd4eca58e426"
    || entry.revisionId !== "5801cde4-9341-4fe9-9e35-da47627754f9"
    || entry.reviewItemId !== "a0654fd4-d65f-450d-b8ed-2270408fdcbe"
    || !checksum.test(entry.candidatePayloadChecksum)
    || !checksum.test(entry.payloadChecksum)
    || !checksum.test(entry.productIdentityChecksum)
  ) fail("manifest_scope_invalid");
}

function assertProduct(product: CatalogAdminProduct | null, published: boolean) {
  const [entry] = IDN_03_PUBLICATION_MANIFEST.entries;
  if (
    !product
    || product.id !== entry.productId
    || product.model !== entry.model
    || typeof product.slug !== "string"
    || product.published !== published
    || product.publicationStatus !== (published ? "published" : "in_review")
    || product.reviewState !== (published ? "published" : "in_review")
    || product.immutable?.sourceUid !== entry.sourceUid
    || typeof product.immutable?.sourceChecksum !== "string"
  ) fail("product_scope_drift");
  return product as CatalogAdminProduct & { slug: string };
}

export async function executeProductionIdn03Publication(
  actorId: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Idn03PublicationResult> {
  const configuredReviewerId = environment["CYBERMEDICA_IDN03_REVIEWER_ID"]?.trim();
  if (
    !configuredReviewerId
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(configuredReviewerId)
    || actorId !== configuredReviewerId
  ) fail("actor_identity_invalid");
  assertManifest();
  const [entry] = IDN_03_PUBLICATION_MANIFEST.entries;
  const client = createProjectBoundSupabaseServerClient();
  if (client.access !== "service_role") fail("service_role_required");

  const [beforeProduct, beforeProjection] = await Promise.all([
    readProduct(client, entry.productId),
    readProjection(client),
  ]);
  if (beforeProjection.products.length !== 70 && beforeProjection.products.length !== 71) {
    fail("published_total_drift");
  }
  const alreadyComplete = beforeProjection.products.length === 71;
  const product = assertProduct(beforeProduct, alreadyComplete);
  const targetAlreadyPublic = beforeProjection.products.some(({ slug }) => slug === product.slug);
  if (targetAlreadyPublic !== alreadyComplete) fail("publication_binding_drift");

  const approval = await approveProductPublicationRevision({
    candidateRevisionId: entry.revisionId,
    reviewDecisionId: entry.decisionId,
  }, client);
  if (
    approval.candidateRevisionId !== entry.revisionId
    || approval.productId !== entry.productId
    || approval.payloadChecksum !== entry.payloadChecksum
  ) fail("approval_result_drift");

  const approvalReplay = await approveProductPublicationRevision({
    candidateRevisionId: entry.revisionId,
    reviewDecisionId: entry.decisionId,
  }, client);
  if (!approvalReplay.idempotent || approvalReplay.approvalId !== approval.approvalId) {
    fail("approval_replay_failed");
  }

  const publication = await publishProduct({
    candidateRevisionId: entry.revisionId,
    idempotencyKey: IDN_03_PUBLICATION_MANIFEST.operationKey,
  }, client);
  if (
    publication.productId !== entry.productId
    || publication.candidateRevisionId !== entry.revisionId
    || publication.action !== "publish"
    || publication.state !== "published"
  ) fail("publication_result_drift");

  const publicationReplay = await publishProduct({
    candidateRevisionId: entry.revisionId,
    idempotencyKey: IDN_03_PUBLICATION_MANIFEST.operationKey,
  }, client);
  if (
    !publicationReplay.idempotent
    || publicationReplay.publicationBatchId !== publication.publicationBatchId
    || publicationReplay.publicationVersion !== publication.publicationVersion
  ) fail("publication_replay_failed");

  const [afterProduct, afterProjection] = await Promise.all([
    readProduct(client, entry.productId),
    readProjection(client),
  ]);
  assertProduct(afterProduct, true);
  if (
    afterProjection.products.length !== 71
    || !afterProjection.products.some(({ slug }) => slug === product.slug)
  ) fail("publication_not_durable");

  return {
    status: alreadyComplete ? "already_complete" : "completed",
    approvalId: approval.approvalId,
    publicationBatchId: publication.publicationBatchId,
    productUrl: `/catalog/${product.slug}`,
    publicationVersion: publication.publicationVersion,
    totals: {
      products: 79,
      published: 71,
      revisions: 71,
      decisions: 71,
      approvals: 71,
      publicationBatches: 71,
    },
  };
}
