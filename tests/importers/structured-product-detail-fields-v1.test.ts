import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  STRUCTURED_PRODUCT_DETAIL_SCHEMA_VERSION,
  publishStructuredProductDetailInputSchema,
  structuredProductDetailCandidateSchema,
  structuredProductDetailPublicationResultSchema,
  structuredProductDetailRevisionResultSchema,
} from "../../lib/product-detail-publication/contracts.ts";
import {
  mapCloudPreviewSnapshot,
  type CloudPreviewCatalogSnapshot,
} from "../../lib/storefront/cloud-preview-mapper.ts";

const timestamp = "2026-07-23T10:00:00.000Z";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function candidate() {
  return {
    schemaVersion: STRUCTURED_PRODUCT_DETAIL_SCHEMA_VERSION,
    product: { id: productId, sourceUid: "source-product-1" },
    keyFeatures: [{
      key: "autonomy",
      text: "Автономная работа до 9 часов",
      sortOrder: 20,
      source: {
        type: "official_datasheet",
        ref: "datasheet:page-2",
        url: "https://manufacturer.example/product/datasheet.pdf",
      },
    }],
    specifications: [{
      key: "weight",
      label: "Масса",
      value: "6.5",
      unit: "кг",
      sortOrder: 10,
      group: { key: "dimensions", title: "Габариты и масса", sortOrder: 20 },
      source: {
        type: "official_datasheet",
        ref: "datasheet:page-4",
        url: "https://manufacturer.example/product/datasheet.pdf",
      },
    }],
  };
}

test("candidate contract accepts atomic provenance-bearing structured fields", () => {
  assert.deepEqual(structuredProductDetailCandidateSchema.parse(candidate()), candidate());
});

test("candidate contract permits mathematical comparison signs without permitting HTML", () => {
  const comparison = candidate();
  comparison.specifications[0].value = "< 30 Ватт";
  assert.equal(structuredProductDetailCandidateSchema.safeParse(comparison).success, true);

  const html = candidate();
  html.specifications[0].value = "<script>alert(1)</script>";
  assert.equal(structuredProductDetailCandidateSchema.safeParse(html).success, false);
});

test("candidate contract fails closed for metadata, missing provenance and duplicate keys", () => {
  const metadata = candidate();
  metadata.specifications[0].label = "Категория";
  assert.equal(structuredProductDetailCandidateSchema.safeParse(metadata).success, false);

  const missingProvenance = candidate();
  missingProvenance.keyFeatures[0].source.ref = "";
  assert.equal(structuredProductDetailCandidateSchema.safeParse(missingProvenance).success, false);

  const duplicate = candidate();
  duplicate.keyFeatures.push({ ...duplicate.keyFeatures[0] });
  assert.equal(structuredProductDetailCandidateSchema.safeParse(duplicate).success, false);

  const insecureSource = candidate();
  insecureSource.specifications[0].source.url = "http://manufacturer.example/specification.pdf";
  assert.equal(structuredProductDetailCandidateSchema.safeParse(insecureSource).success, false);

  assert.equal(structuredProductDetailCandidateSchema.safeParse({
    ...candidate(),
    schemaVersion: 2,
  }).success, false);
});

test("publication contracts require immutable revision identity", () => {
  const candidateRevisionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal(publishStructuredProductDetailInputSchema.safeParse({
    candidateRevisionId,
    schemaVersion: 1,
    idempotencyKey: "structured-publication-v2",
    actorId: productId,
  }).success, true);
  assert.equal(publishStructuredProductDetailInputSchema.safeParse({
    candidateId: candidateRevisionId,
    schemaVersion: 1,
    idempotencyKey: "structured-publication-v2",
    actorId: productId,
  }).success, false);

  assert.equal(structuredProductDetailRevisionResultSchema.safeParse({
    candidateRevisionId,
    candidateId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    productId,
    revisionNumber: 1,
    schemaVersion: 1,
    payloadChecksum: "a".repeat(64),
    productIdentityChecksum: "b".repeat(64),
    idempotent: false,
  }).success, true);
  assert.equal(structuredProductDetailPublicationResultSchema.safeParse({
    publicationBatchId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    candidateId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    candidateRevisionId,
    productId,
    status: "published",
    keyFeatureCount: 1,
    specificationCount: 1,
    idempotent: false,
  }).success, true);
});

test("migration reuses review/publication entities and creates an additive reversible batch", async () => {
  const migration = await readFile(
    "supabase/migrations/202607230001_structured_product_detail_fields_v1.sql",
    "utf8",
  );

  assert.match(migration, /create table cloud\.product_key_features/u);
  assert.match(migration, /alter table cloud\.product_characteristics/u);
  assert.match(migration, /content_kind in \('legacy_metadata', 'technical_specification'\)/u);
  assert.match(migration, /cloud\.publication_candidates%rowtype/u);
  assert.match(migration, /cloud\.review_decisions%rowtype/u);
  assert.match(migration, /decision\.decision <> 'approve'/u);
  assert.match(migration, /decision\.approved_value is distinct from item/u);
  assert.match(migration, /candidate\.validation_status not in \('approved', 'published'\)/u);
  assert.match(migration, /published candidate cannot create a new publication batch/u);
  assert.match(migration, /alter policy product_characteristics_public_read[\s\S]+publication_status = 'published'/u);
  assert.match(migration, /previous_state jsonb not null/u);
  assert.match(migration, /idempotency_key text not null unique/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /only the latest published product-detail batch can be rolled back/u);
  assert.match(migration, /set status = 'rolled_back', rolled_back_at = now\(\)/u);
  assert.doesNotMatch(migration, /\bdelete\s+from\b|\btruncate\b/iu);
  assert.doesNotMatch(migration, /hamilton|apparat-ivl-hamilton/u);
  assert.doesNotMatch(migration, /full_description|short_description/u);
});

test("writer surface is server-only, revision-bound and unavailable to public roles", async () => {
  const [server, migration, correctiveMigration] = await Promise.all([
    readFile("lib/product-detail-publication/server.ts", "utf8"),
    readFile("supabase/migrations/202607230001_structured_product_detail_fields_v1.sql", "utf8"),
    readFile("supabase/migrations/202607230003_structured_product_detail_integrity_v1.sql", "utf8"),
  ]);

  assert.match(server, /^import "server-only";/u);
  assert.match(server, /access: "service_role"/u);
  assert.match(server, /"Accept-Profile": "cloud_api"/u);
  assert.match(server, /"Content-Profile": "cloud_api"/u);
  assert.match(server, /method: "POST"/u);
  assert.match(server, /create_structured_product_detail_revision_v1/u);
  assert.match(server, /publish_structured_product_detail_v2/u);
  assert.match(server, /rollback_structured_product_detail_v2/u);
  assert.match(server, /p_candidate_revision_id/u);
  assert.match(migration, /revoke all on function cloud_api\.publish_structured_product_detail_v1[\s\S]+from public, anon, authenticated/u);
  assert.match(migration, /grant execute on function cloud_api\.publish_structured_product_detail_v1[\s\S]+to service_role/u);
  assert.match(migration, /revoke all on function cloud_api\.rollback_structured_product_detail_v1[\s\S]+from public, anon, authenticated/u);
  assert.match(migration, /grant execute on function cloud_api\.rollback_structured_product_detail_v1[\s\S]+to service_role/u);
  assert.match(correctiveMigration, /revoke execute on function cloud_api\.publish_structured_product_detail_v1[\s\S]+from service_role/u);
  assert.match(correctiveMigration, /grant execute on function cloud_api\.publish_structured_product_detail_v2[\s\S]+to service_role/u);
  assert.match(correctiveMigration, /grant execute on function cloud_api\.rollback_structured_product_detail_v2[\s\S]+to service_role/u);
});

test("corrective migration binds approvals and isolates managed structured rows", async () => {
  const migration = await readFile(
    "supabase/migrations/202607230003_structured_product_detail_integrity_v1.sql",
    "utf8",
  );

  assert.match(migration, /create table cloud\.product_detail_candidate_revisions/u);
  assert.match(migration, /product_identity_checksum/u);
  assert.match(migration, /candidate_payload_checksum/u);
  assert.match(migration, /structured_product_detail_payload_checksum_v1/u);
  assert.match(migration, /product_detail_candidate_revisions_immutable/u);
  assert.match(migration, /candidate_revision_id uuid[\s\S]+approved_payload_checksum text/u);
  assert.match(migration, /candidate changed after immutable revision creation/u);
  assert.match(migration, /product identity changed after candidate review/u);
  assert.match(migration, /candidate approval is not bound to this immutable revision/u);

  const preflightEnd = migration.indexOf("select * into previous_batch");
  const firstBatchMutation = migration.indexOf(
    "insert into cloud.product_detail_publication_batches",
    preflightEnd,
  );
  assert.ok(preflightEnd >= 0 && firstBatchMutation > preflightEnd);

  assert.match(migration, /record_origin in \('legacy', 'structured_product_detail'\)/u);
  assert.match(migration, /product_characteristics_legacy_key_uq/u);
  assert.match(migration, /product_characteristics_structured_batch_item_uq/u);
  assert.match(migration, /record_origin = 'structured_product_detail'[\s\S]+candidate_revision_id is not null/u);
  assert.doesNotMatch(migration, /on conflict \(product_id, key\) do update/u);
  assert.match(migration, /delete from cloud\.product_characteristics[\s\S]+record_origin = 'structured_product_detail'/u);
  assert.match(migration, /created_at = \(before_row ->> 'created_at'\)::timestamptz[\s\S]+updated_at = \(before_row ->> 'updated_at'\)::timestamptz/u);
  assert.doesNotMatch(migration, /hamilton|330695211247/iu);
});

test("projection and mapper expose only approved published structured fields in stable order", async () => {
  const [projection, correctiveProjection] = await Promise.all([
    readFile("supabase/migrations/202607230002_structured_product_detail_projection_v1.sql", "utf8"),
    readFile("supabase/migrations/202607230003_structured_product_detail_integrity_v1.sql", "utf8"),
  ]);
  assert.match(projection, /feature\.review_status = 'approved'/u);
  assert.match(projection, /feature\.publication_status = 'published'/u);
  assert.match(projection, /characteristic\.content_kind = 'technical_specification'/u);
  assert.match(projection, /characteristic\.reviewer_status = 'approved'/u);
  assert.match(projection, /characteristic\.publication_status = 'published'/u);
  assert.doesNotMatch(
    projection,
    /feature\.(?:source_ref|source_url|approval_decision_id)|characteristic\.(?:source_reference|source_url|approval_decision_id)/u,
  );
  assert.match(correctiveProjection, /feature\.candidate_revision_id is not null/u);
  assert.match(correctiveProjection, /characteristic\.record_origin = 'structured_product_detail'/u);
  assert.match(correctiveProjection, /characteristic\.candidate_revision_id is not null/u);

  const snapshot: CloudPreviewCatalogSnapshot = {
    generatedAt: timestamp,
    manufacturers: [],
    categories: [],
    applicationAreas: [],
    products: [{
      id: productId,
      slug: "device",
      title: "Device",
      model: null,
      shortDescription: null,
      description: null,
      manufacturerId: null,
      categoryId: null,
      publicationStatus: "draft",
      published: false,
      reviewState: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
      applicationAreas: [],
      characteristics: [{ name: "Страна производства", value: "Россия", unit: null }],
      keyFeatures: [
        { text: "Второе преимущество", sortOrder: 20 },
        { text: "Первое преимущество", sortOrder: 10 },
        { text: "<b>unsafe</b>", sortOrder: 30 },
      ],
      characteristicGroups: [
        {
          key: "performance",
          title: "Производительность",
          sortOrder: 20,
          items: [
            { label: "Поток", value: "120", unit: "л/мин", sortOrder: 20 },
            { label: "Потребление", value: "< 30", unit: "Вт", sortOrder: 30 },
          ],
        },
        {
          key: "dimensions",
          title: "Габариты",
          sortOrder: 10,
          items: [{ label: "Масса", value: "6.5", unit: "кг", sortOrder: 10 }],
        },
      ],
      media: [],
      documents: [],
      registrations: [],
    }],
  };

  const mapped = mapCloudPreviewSnapshot(snapshot).products[0];
  assert.deepEqual(mapped.keyFeatures, ["Первое преимущество", "Второе преимущество"]);
  assert.deepEqual(mapped.specifications.map(({ group, label }) => [group, label]), [
    ["Габариты", "Масса"],
    ["Производительность", "Поток"],
    ["Производительность", "Потребление"],
  ]);
  assert.equal(mapped.specifications.at(-1)?.value, "< 30");
  assert.equal(mapped.specifications.some(({ label }) => label === "Страна производства"), false);
});
