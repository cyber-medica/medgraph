import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { structuredProductDetailCandidateSchema } from "../../lib/product-detail-publication/contracts.ts";

const migrationRoot = "supabase/migrations";
const migrationManifestPath = "supabase/tests/structured-fields-migration-chain-v1.json";
const hamiltonRoot = "data/review/product-detail-data-recovery-v1/hamilton-t1";

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

test("the recovered Structured Fields migration chain is complete and checksum-pinned", async () => {
  const manifest = JSON.parse(await readFile(migrationManifestPath, "utf8")) as {
    schemaVersion: string;
    migrations: Array<{ version: string; file: string; sha256: string }>;
  };
  const migrationFiles = (await readdir(migrationRoot))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  assert.equal(manifest.schemaVersion, "cybermedica-migration-chain-manifest-v1");
  assert.deepEqual(manifest.migrations.map(({ file }) => file), migrationFiles);
  assert.deepEqual(manifest.migrations.map(({ version }) => version), [
    "202607020001",
    "202607030001",
    "202607180001",
    "202607200001",
    "202607200002",
    "202607200003",
    "202607200004",
    "202607200005",
    "202607200006",
    "202607210001",
    "202607210002",
    "202607230001",
    "202607230002",
    "202607230003",
    "202607250001",
    "202607260001",
    "202607260002",
    "202607260003",
    "202607260004",
    "202607270001",
    "202607270002",
    "202607280001",
    "202607280002",
    "202607290001",
    "202607290002",
    "202607290003",
    "202608010001",
    "202608030001",
    "202608030002",
  ]);

  for (const migration of manifest.migrations) {
    const contents = await readFile(path.join(migrationRoot, migration.file));
    assert.equal(sha256(contents), migration.sha256, `${migration.file} checksum drifted`);
  }
});

test("the recovered Hamilton-T1 package preserves 6/15/21 review-only evidence", async () => {
  const [manifest, candidate, provenance, currentVsProposed, research, sourceArtifact] = await Promise.all([
    readFile(path.join(hamiltonRoot, "manifest.json"), "utf8").then(JSON.parse),
    readFile(path.join(hamiltonRoot, "review-candidate.json"), "utf8").then(JSON.parse),
    readFile(path.join(hamiltonRoot, "provenance.json"), "utf8").then(JSON.parse),
    readFile(path.join(hamiltonRoot, "current-vs-proposed.json"), "utf8").then(JSON.parse),
    readFile("docs/research/hamilton-t1.md", "utf8"),
    readFile("data/legacy/products/330695211247.json", "utf8"),
  ]);

  assert.equal(manifest.status, "needs_manual_approval");
  assert.equal(manifest.publishable, false);
  assert.equal(candidate.status, "needs_manual_approval_and_schema_change");
  assert.equal(candidate.cloudWriteEligibility.eligibleNow, false);
  assert.equal(candidate.proposedKeyFeatures.length, 6);
  assert.equal(candidate.proposedTechnicalSpecifications.length, 15);
  assert.equal(provenance.keyFeatures.length + provenance.technicalSpecifications.length, 21);
  assert.match(currentVsProposed.proposedReviewedState.keyFeatures.operation, /6 reviewed feature records/u);
  assert.match(
    currentVsProposed.proposedReviewedState.technicalSpecifications.operation,
    /15 reviewed characteristic records/u,
  );
  assert.deepEqual(candidate.documents.proposed, []);
  assert.deepEqual(candidate.registrations.proposed, []);

  const featureEvidence = new Set(provenance.keyFeatures.map((item: { id: string }) => item.id));
  const specificationEvidence = new Set(
    provenance.technicalSpecifications.map((item: { id: string }) => item.id),
  );
  for (const feature of candidate.proposedKeyFeatures) {
    assert.equal(feature.reviewStatus, "needs_manual_approval");
    assert.equal(featureEvidence.has(feature.provenanceId), true);
  }
  for (const specification of candidate.proposedTechnicalSpecifications) {
    assert.equal(specification.reviewStatus, "needs_manual_approval");
    assert.equal(specificationEvidence.has(specification.provenanceId), true);
  }
  for (const item of [...provenance.keyFeatures, ...provenance.technicalSpecifications]) {
    assert.equal(typeof item.rawEvidence, "string");
    assert.notEqual(item.rawEvidence.trim(), "");
  }

  assert.equal(candidate.candidateId, provenance.candidateId);
  assert.equal(candidate.target.sourceUid, manifest.sourceUid);
  assert.equal(candidate.target.immutableSnapshot.payloadSha256, manifest.sourcePayloadSha256);
  assert.equal(provenance.source.payloadSha256, manifest.sourcePayloadSha256);
  assert.equal(sha256(sourceArtifact), manifest.sourceArtifact.fileSha256);
  assert.equal(JSON.parse(sourceArtifact).payloadSha256, manifest.sourcePayloadSha256);
  assert.equal(manifest.sourceArtifact.recoveredFromCommit, "5ca5fe24c308fd636743eaf78874f4647749dc21");

  const packageHashInput: string[] = [];
  for (const file of manifest.files as Array<{ path: string; sha256: string }>) {
    const fullPath = path.join(hamiltonRoot, file.path);
    assert.equal(sha256(await readFile(fullPath)), file.sha256, `${file.path} checksum drifted`);
    packageHashInput.push(`${file.sha256}  ${fullPath}\n`);
  }
  assert.equal(sha256(packageHashInput.join("")), manifest.packageSha256);

  assert.match(research, /4 h with one battery \/ 8 h with two batteries/u);
  assert.equal(
    candidate.proposedKeyFeatures.some(
      ({ value }: { value: string }) => value === "Более 9 часов работы от аккумулятора",
    ),
    true,
  );

  const provenanceById = new Map(
    [...provenance.keyFeatures, ...provenance.technicalSpecifications]
      .map((item: { id: string; rawEvidence: string }) => [item.id, item]),
  );
  const reviewOnlyRevisionPayload = {
    schemaVersion: 1 as const,
    product: {
      id: "20000000-0000-4000-8000-000000000003",
      sourceUid: manifest.sourceUid,
    },
    keyFeatures: candidate.proposedKeyFeatures.map((feature: {
      id: string;
      value: string;
      position: number;
      provenanceId: string;
    }) => ({
      key: feature.id,
      text: feature.value,
      sortOrder: feature.position,
      source: {
        type: "immutable_snapshot",
        ref: `${manifest.sourceArtifact.path}#${feature.provenanceId}`,
        url: candidate.target.immutableSnapshot.sourceUrl,
      },
    })),
    specifications: candidate.proposedTechnicalSpecifications.map((specification: {
      key: string;
      group: string;
      displayName: string;
      normalizedValue: string;
      unit: string | null;
      sortOrder: number;
      provenanceId: string;
    }, index: number) => ({
      key: specification.key,
      label: specification.displayName,
      value: specification.normalizedValue,
      unit: specification.unit,
      sortOrder: specification.sortOrder,
      group: {
        key: `review-group-${index}`,
        title: specification.group,
        sortOrder: specification.sortOrder,
      },
      source: {
        type: "immutable_snapshot",
        ref: `${manifest.sourceArtifact.path}#${specification.provenanceId}`,
        url: candidate.target.immutableSnapshot.sourceUrl,
      },
    })),
  };
  assert.deepEqual(
    structuredProductDetailCandidateSchema.parse(reviewOnlyRevisionPayload),
    reviewOnlyRevisionPayload,
  );
  assert.equal(reviewOnlyRevisionPayload.keyFeatures.length, 6);
  assert.equal(reviewOnlyRevisionPayload.specifications.length, 15);
  assert.equal(provenanceById.size, 21);
  assert.equal(candidate.approvalRequirements.length, 3);
  assert.equal(
    candidate.proposedKeyFeatures.every(
      ({ reviewStatus }: { reviewStatus: string }) => reviewStatus === "needs_manual_approval",
    ),
    true,
  );
});

test("the local integration fixture is transactional and covers the service-only chain", async () => {
  const [correctiveMigration, integration, regression, runner, packageJson] = await Promise.all([
    readFile("supabase/migrations/202607230003_structured_product_detail_integrity_v1.sql", "utf8"),
    readFile("supabase/tests/002_structured_product_detail_integration.sql", "utf8"),
    readFile("supabase/tests/003_structured_product_detail_integrity_regression.sql", "utf8"),
    readFile("scripts/qa/structured-fields-local-integration.ts", "utf8"),
    readFile("package.json", "utf8").then(JSON.parse),
  ]);

  const retryLookup = correctiveMigration.indexOf("where idempotency_key = p_idempotency_key");
  const newBatchGate = correctiveMigration.indexOf(
    "published candidate cannot create a new publication batch",
  );
  assert.ok(retryLookup >= 0 && newBatchGate > retryLookup);
  assert.match(integration, /^begin;/mu);
  assert.match(integration, /^rollback;/mu);
  assert.match(integration, /cloud_api\.create_structured_product_detail_revision_v1/u);
  assert.match(integration, /cloud_api\.publish_structured_product_detail_v2/u);
  assert.match(integration, /cloud_api\.cloud_storefront_preview_catalog/u);
  assert.match(integration, /cloud_api\.rollback_structured_product_detail_v2/u);
  assert.match(integration, /has_function_privilege\(\s*'anon'/u);
  assert.match(integration, /idempotent retry produced a different result/u);
  assert.match(integration, /rollback left structured fields in Storefront projection/u);
  assert.doesNotMatch(integration, /hamilton|330695211247/iu);
  assert.match(regression, /integrity-stale-candidate-payload/u);
  assert.match(regression, /integrity-stale-provenance/u);
  assert.match(regression, /integrity-stale-ordering/u);
  assert.match(regression, /integrity-stale-product-identity/u);
  assert.match(regression, /legacy and structured display keys were not isolated/u);
  assert.match(regression, /rollback B did not restore exact state after A/u);
  assert.doesNotMatch(regression, /adversarial/iu);
  assert.doesNotMatch(regression, /hamilton|330695211247/iu);
  assert.equal(
    packageJson.scripts["qa:structured-fields:local"],
    "node scripts/qa/structured-fields-local-integration.ts",
  );
  assert.match(runner, /docker", \["image", "inspect", IMAGE\]/u);
  assert.match(runner, /This QA command never pulls images automatically/u);
  assert.match(runner, /"--rm"/u);
  assert.match(runner, /remoteConnections: 0/u);
  assert.match(runner, /migrationCount: MIGRATION_COUNT/u);
  assert.match(runner, /003_structured_product_detail_integrity_regression\.sql/u);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE/u);
});
