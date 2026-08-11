import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { parsePublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";

const outputPath = new URL(
  "../../data/published-catalog-last-known-good.json",
  import.meta.url,
);
const productionProjectRef = "clbzibuusyuajsylcbvl";
const minimumProductionProductCount = 70;
const checksumPattern = /^[a-f0-9]{64}$/u;

class TransientSnapshotCaptureError extends Error {
  constructor() {
    super("Production snapshot transport is temporarily unavailable.");
    this.name = "TransientSnapshotCaptureError";
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function validateExistingSnapshot(production = false) {
  const envelope = JSON.parse(await readFile(outputPath, "utf8")) as {
    schemaVersion?: unknown;
    projectionVersion?: unknown;
    projectionChecksum?: unknown;
    projectionDocumentChecksum?: unknown;
    capturedAt?: unknown;
    projection?: unknown;
  };
  if (
    envelope.schemaVersion !== 1
    || !Number.isSafeInteger(envelope.projectionVersion)
    || Number(envelope.projectionVersion) < 1
    || typeof envelope.projectionChecksum !== "string"
    || !checksumPattern.test(envelope.projectionChecksum)
    || typeof envelope.projectionDocumentChecksum !== "string"
    || !checksumPattern.test(envelope.projectionDocumentChecksum)
    || typeof envelope.capturedAt !== "string"
    || !Number.isFinite(Date.parse(envelope.capturedAt))
  ) throw new Error("Published catalog LKG envelope is invalid.");
  const projection = parsePublishedCatalogProjection(envelope.projection);
  if (production && projection.products.length < minimumProductionProductCount) {
    throw new Error("Published catalog LKG is unexpectedly incomplete.");
  }
  const projectionDocumentChecksum = createHash("sha256")
    .update(canonicalJson({ ...projection, generatedAt: undefined }))
    .digest("hex");
  if (projectionDocumentChecksum !== envelope.projectionDocumentChecksum) {
    throw new Error("Published catalog LKG checksum is invalid.");
  }
  console.info(JSON.stringify({
    event: "published_catalog_lkg_validated",
    productCount: projection.products.length,
    projectionChecksumPrefix: envelope.projectionChecksum.slice(0, 12),
    production,
  }));
}

async function captureProductionSnapshot() {
  const origin = process.env.CYBERMEDICA_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!origin || !serviceRole) throw new Error("Production snapshot configuration is missing.");
  const url = new URL(origin);
  if (
    url.protocol !== "https:"
    || url.hostname !== `${productionProjectRef}.supabase.co`
    || url.pathname !== "/"
  ) throw new Error("Production snapshot project binding is invalid.");

  let response: Response;
  try {
    response = await fetch(
      new URL("/rest/v1/rpc/cloud_published_storefront_catalog_v1", url),
      {
        method: "POST",
        redirect: "error",
        headers: {
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
          "Accept-Profile": "cloud_api",
          "Content-Profile": "cloud_api",
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "TimeoutError")
      || error instanceof TypeError
    ) throw new TransientSnapshotCaptureError();
    throw error;
  }
  if (response.status >= 500) throw new TransientSnapshotCaptureError();
  if (!response.ok) throw new Error("Production snapshot capture was rejected.");
  const projection = parsePublishedCatalogProjection(await response.json());
  if (projection.products.length < minimumProductionProductCount) {
    throw new Error("Production snapshot is unexpectedly incomplete.");
  }
  const checksumInput = { ...projection, generatedAt: undefined };
  const projectionDocumentChecksum = createHash("sha256")
    .update(canonicalJson(checksumInput))
    .digest("hex");
  const existing = JSON.parse(await readFile(outputPath, "utf8")) as {
    projectionVersion?: unknown;
    projectionChecksum?: unknown;
  };
  const projectionVersion = Number.isSafeInteger(existing.projectionVersion)
    ? Number(existing.projectionVersion)
    : 1;
  const projectionChecksum = typeof existing.projectionChecksum === "string"
    && /^[a-f0-9]{64}$/u.test(existing.projectionChecksum)
    ? existing.projectionChecksum
    : null;
  if (!projectionChecksum) {
    throw new Error("Authoritative Production projection checksum is missing.");
  }
  const envelope = {
    schemaVersion: 1,
    projectionVersion,
    projectionChecksum,
    projectionDocumentChecksum,
    capturedAt: new Date().toISOString(),
    projection,
  };
  await writeFile(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o644 });
  console.info(JSON.stringify({
    event: "published_catalog_lkg_captured",
    productCount: projection.products.length,
    projectionChecksumPrefix: projectionChecksum.slice(0, 12),
    documentChecksumPrefix: projectionDocumentChecksum.slice(0, 12),
  }));
}

if (process.env.VERCEL_ENV === "production") {
  try {
    await captureProductionSnapshot();
  } catch (error) {
    if (!(error instanceof TransientSnapshotCaptureError)) throw error;
    await validateExistingSnapshot(true);
    console.warn(JSON.stringify({
      event: "published_catalog_lkg_build_fallback",
      errorClass: "transport",
    }));
  }
} else await validateExistingSnapshot();
