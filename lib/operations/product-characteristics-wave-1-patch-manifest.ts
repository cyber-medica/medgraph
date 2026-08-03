import "server-only";

import { createHash } from "node:crypto";

import manifest from "./product-characteristics-wave-1-patch-manifest.json";

export const PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_OPERATION_KEY =
  "product-characteristics-wave-1-patch-v1";
export const PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST_SHA256 =
  "8d045b48864c2ca1d4de0c4403edb7eb6e508345cc84afa2594cd42a69db24c1";

export type ProductCharacteristicsWave1Characteristic = Readonly<{
  key: string;
  label: string;
  value: string;
  unit: string | null;
  group: string;
  groupSortOrder: number;
  itemSortOrder: number;
  contentKind: "technical_specification";
  recordOrigin: "authoritative_wave_1_preparation";
  sourceUrl: string;
  evidenceLocation: string;
  confidence: "High";
  configurationDependency: string | null;
  optional: boolean;
  notes: string | null;
}>;

export type ProductCharacteristicsWave1PatchEntry = Readonly<{
  productId: string;
  sourceUid: string;
  slug: string;
  productName: string;
  model: string;
  currentPublishedRevision: Readonly<{ id: string; number: number }>;
  currentPublishedBatch: string;
  expectedCurrentCharacteristics: 3;
  expectedDraftCharacteristics: 10;
  expectedNextRevisionNumber: number;
  productPatch: Readonly<Record<string, string>>;
  descriptionPatch: Readonly<Record<string, string>>;
  characteristics: readonly ProductCharacteristicsWave1Characteristic[];
  requestId: string;
}>;

export const PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST = Object.freeze(
  manifest as unknown as Readonly<{
    version: string;
    operationKey: string;
    productCount: 15;
    sourceArtifactSha256: string;
    entries: readonly ProductCharacteristicsWave1PatchEntry[];
    manifestSha256: string;
  }>,
);

export function calculateProductCharacteristicsWave1PatchManifestSha256() {
  const digestInput = {
    version: PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST.version,
    operationKey: PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST.operationKey,
    productCount: PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST.productCount,
    sourceArtifactSha256: PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST.sourceArtifactSha256,
    entries: PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST.entries,
  };
  return createHash("sha256").update(JSON.stringify(digestInput)).digest("hex");
}

export function validateProductCharacteristicsWave1PatchOperationRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2
    && record.operationKey === PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_OPERATION_KEY
    && record.manifestSha256 === PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST_SHA256;
}
