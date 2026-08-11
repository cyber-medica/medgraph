import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/202607290003_hamilton_storefront_projection_completeness_v1.sql";

test("projection completeness is revision-bound, targeted and service-only", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /cloud_published_storefront_catalog_source_pre_completeness_v1/u);
  assert.match(migration, /revision\.candidate_payload #> '\{product,seoTitle\}'/u);
  assert.match(migration, /revision\.candidate_payload #> '\{product,seoDescription\}'/u);
  assert.match(migration, /revision\.candidate_payload -> 'characteristics'/u);
  assert.match(migration, /published_characteristic_groups_from_revision_v1/u);
  assert.match(migration, /current_product_publication_revision_id/u);
  assert.match(migration, /decision\.approved_value = revision\.candidate_payload/u);
  assert.match(migration, /batch\.action = 'publish'/u);
  assert.match(migration, /published Product projection refresh would affect another Product/u);
  assert.match(migration, /published projection refresh checksum mismatch/u);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/u);
  assert.match(migration, /grant execute on function cloud_api\.refresh_published_product_projection_completeness_v1\(uuid\)[\s\S]+to service_role/u);
  assert.match(migration, /revoke all on function cloud_api\.refresh_published_product_projection_completeness_v1\(uuid\)[\s\S]+from public, anon, authenticated/u);
  assert.doesNotMatch(migration, /execute format|execute immediate/iu);
  assert.doesNotMatch(migration, /update cloud\.products|insert into cloud\.product_publication|delete from cloud\.product/iu);
});

test("published read model preserves projection SEO and Product metadata uses the public contract", async () => {
  const [contracts, mapper, productPage] = await Promise.all([
    readFile("lib/published-catalog/contracts.ts", "utf8"),
    readFile("lib/storefront/cloud-published-mapper.ts", "utf8"),
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
  ]);

  assert.match(contracts, /seoTitle: nullablePublicTextSchema/u);
  assert.match(contracts, /seoDescription: nullablePublicTextSchema/u);
  assert.match(contracts, /recordOrigin: z\.enum\(\["legacy", "structured_product_detail"\]\)/u);
  assert.match(mapper, /seoTitle: row\.seoTitle \?\? null/u);
  assert.match(mapper, /seoDescription: row\.seoDescription \?\? null/u);
  assert.match(productPage, /buildProductSeoMetadataV3/u);
  assert.match(productPage, /fallbackDescription: presentation\.shortDescription \?\? product\.description/u);
});

test("local projection QA proves exact Product SEO, three characteristics and refresh retry", async () => {
  const fixture = await readFile(
    "supabase/tests/006_published_catalog_projection.sql",
    "utf8",
  );

  assert.match(fixture, /Projection A approved SEO title/u);
  assert.match(fixture, /immutable Product SEO\/characteristic projection is incomplete/u);
  assert.match(fixture, /insert into cloud\.product_characteristics[\s\S]+local:weight/u);
  assert.match(fixture, /targeted_completeness_refresh/u);
  assert.match(fixture, /refresh_result ->> 'idempotent' <> 'false'/u);
  assert.match(fixture, /retry_result ->> 'idempotent' <> 'true'/u);
});
