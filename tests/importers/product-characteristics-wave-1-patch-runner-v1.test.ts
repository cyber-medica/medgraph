import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();

type ManifestCharacteristic = {
  key: string;
  contentKind: string;
  recordOrigin: string;
  confidence: string;
  sourceUrl: string;
  evidenceLocation: string;
};

type ManifestEntry = {
  productId: string;
  sourceUid: string;
  expectedCurrentCharacteristics: number;
  expectedDraftCharacteristics: number;
  characteristics: ManifestCharacteristic[];
};

type PatchManifest = {
  manifestSha256: string;
  operationKey: string;
  productCount: number;
  entries: ManifestEntry[];
  [key: string]: unknown;
};

test("Characteristics Wave 1 manifest is immutable and exact-scope", async () => {
  const manifest = JSON.parse(await readFile(
    `${root}/lib/operations/product-characteristics-wave-1-patch-manifest.json`,
    "utf8",
  )) as PatchManifest;
  const { manifestSha256, ...digestInput } = manifest;
  assert.equal(
    createHash("sha256").update(JSON.stringify(digestInput)).digest("hex"),
    manifestSha256,
  );
  assert.equal(manifestSha256, "8d045b48864c2ca1d4de0c4403edb7eb6e508345cc84afa2594cd42a69db24c1");
  assert.equal(manifest.operationKey, "product-characteristics-wave-1-patch-v1");
  assert.equal(manifest.productCount, 15);
  assert.equal(manifest.entries.length, 15);
  assert.equal(new Set(manifest.entries.map((entry) => entry.productId)).size, 15);
  assert.equal(new Set(manifest.entries.map((entry) => entry.sourceUid)).size, 15);
  assert.equal(manifest.entries.reduce(
    (count, entry) => count + entry.characteristics.length,
    0,
  ), 150);
  for (const entry of manifest.entries) {
    assert.equal(entry.expectedCurrentCharacteristics, 3);
    assert.equal(entry.expectedDraftCharacteristics, 10);
    assert.equal(entry.characteristics.length, 10);
    assert.equal(new Set(entry.characteristics.map(({ key }) => key.toLowerCase())).size, 10);
    for (const characteristic of entry.characteristics) {
      assert.equal(characteristic.contentKind, "technical_specification");
      assert.equal(characteristic.recordOrigin, "authoritative_wave_1_preparation");
      assert.equal(characteristic.confidence, "High");
      assert.match(characteristic.sourceUrl, /^https:\/\//u);
      assert.ok(characteristic.evidenceLocation.trim());
    }
  }
});

test("runner uses only the closed RPC and preserves published projection", async () => {
  const source = await readFile(
    `${root}/lib/operations/product-characteristics-wave-1-patch-runner.ts`,
    "utf8",
  );
  assert.match(source, /catalog_admin_patch_product_characteristics_v1/u);
  assert.match(source, /mapWithConcurrency\(manifest\.entries, 2/u);
  assert.match(source, /projectionHashAfter !== projectionHashBefore/u);
  assert.match(source, /canonical_source_row_changed/u);
  assert.match(source, /patch_replay_failed/u);
  assert.doesNotMatch(source, /createProductPublicationRevision|approveProductPublication|publishProduct/u);
  assert.doesNotMatch(source, /product_publication_(revisions|approvals|batches)/u);
});

test("Production route requires exact corporate session and immutable request", async () => {
  const source = await readFile(
    `${root}/app/internal/operations/product-characteristics-wave-1/route.ts`,
    "utf8",
  );
  assert.match(source, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.match(source, /readActiveTrustedReviewer/u);
  assert.match(source, /APPROVED_REVIEWER\.userId/u);
  assert.match(source, /APPROVED_REVIEWER\.email/u);
  assert.match(source, /APPROVED_REVIEWER\.role !== "admin"/u);
  assert.match(source, /same_origin_required/u);
  assert.match(source, /validateProductCharacteristicsWave1PatchOperationRequest/u);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/u);
});
