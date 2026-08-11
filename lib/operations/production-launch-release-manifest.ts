import "server-only";

import { createHash } from "node:crypto";

import manifest from "@/data/operations/production-launch-release-v1-manifest.json";

export const PRODUCTION_LAUNCH_RELEASE_OPERATION_KEY =
  "production-launch-catalog-import-v1";
export const PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256 =
  "aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309";

export const PRODUCTION_LAUNCH_RELEASE_PHASES = Object.freeze([
  "import",
  "create_structured_revisions",
  "review_structured",
  "publish_structured",
  "create_product_revisions",
  "review_products",
  "publish_products",
] as const);

export type ProductionLaunchReleasePhase =
  (typeof PRODUCTION_LAUNCH_RELEASE_PHASES)[number];

type ProductionLaunchManifest = typeof manifest;

export const PRODUCTION_LAUNCH_RELEASE_MANIFEST = Object.freeze(manifest);

export function calculateProductionLaunchManifestSha256() {
  return createHash("sha256")
    .update(`${JSON.stringify(PRODUCTION_LAUNCH_RELEASE_MANIFEST, null, 2)}\n`)
    .digest("hex");
}

export function assertProductionLaunchManifest(): ProductionLaunchManifest {
  const productIds = new Set(manifest.products.map(({ id }) => id));
  const sourceUids = new Set(manifest.products.map(({ sourceUid }) => sourceUid));
  const slugs = new Set(manifest.products.map(({ slug }) => slug));
  if (
    calculateProductionLaunchManifestSha256()
      !== PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256
    || manifest.version !== "production-launch-release-v1"
    || manifest.operationKey !== PRODUCTION_LAUNCH_RELEASE_OPERATION_KEY
    || manifest.candidateCount !== 43
    || manifest.expectedFinalPublishedCount !== 114
    || manifest.products.length !== 43
    || productIds.size !== 43
    || sourceUids.size !== 43
    || slugs.size !== 43
  ) {
    throw new Error("Production launch manifest integrity check failed.");
  }
  return manifest;
}

export function validateProductionLaunchOperationRequest(value: unknown): value is {
  operationKey: typeof PRODUCTION_LAUNCH_RELEASE_OPERATION_KEY;
  manifestSha256: typeof PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256;
  phase: ProductionLaunchReleasePhase;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 3
    && record.operationKey === PRODUCTION_LAUNCH_RELEASE_OPERATION_KEY
    && record.manifestSha256 === PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256
    && PRODUCTION_LAUNCH_RELEASE_PHASES.includes(
      record.phase as ProductionLaunchReleasePhase,
    );
}
