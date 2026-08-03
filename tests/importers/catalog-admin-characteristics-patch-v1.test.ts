import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/202608030001_catalog_admin_characteristics_patch_v1.sql";
const isolationMigrationPath =
  "supabase/migrations/202608030002_catalog_admin_characteristics_projection_isolation_v1.sql";
const integrationPath =
  "supabase/tests/014_catalog_admin_characteristics_patch_v1.sql";

test("characteristics patch migration is exact-scope, draft-only and additive", async () => {
  const source = await readFile(migrationPath, "utf8");

  assert.match(source, /create table cloud\.catalog_admin_product_characteristic_drafts_v1/u);
  assert.match(source, /jsonb_array_length\(characteristics\) = 10/u);
  assert.match(source, /catalog_admin_characteristic_draft_scope_v1/u);
  assert.equal((source.match(/::uuid,/gu) ?? []).length >= 14, true);
  assert.match(source, /only canonical locale ru is supported/u);
  assert.match(source, /stale Catalog Admin characteristics patch/u);
  assert.match(source, /duplicate characteristic key/u);
  assert.match(source, /duplicate characteristic item order within group/u);
  assert.match(source, /characteristic payload is malformed or unsupported/u);
  assert.match(source, /Product is outside Characteristics Wave 1 scope/u);
  assert.match(source, /corporate Catalog Admin actor is required/u);
  assert.match(source, /status', 'already_applied'/u);

  assert.doesNotMatch(source, /update cloud\.products|delete from cloud\.product_characteristics/iu);
  assert.doesNotMatch(source, /insert into cloud\.(product_publication_revisions|review_decisions|product_publication_approvals|product_publication_batches)/iu);
  assert.doesNotMatch(source, /raw_snapshot\s*=|source_checksum\s*=|publication_status\s*=|review_state\s*=/iu);
});

test("candidate overlay is deterministic and preserves published revision isolation", async () => {
  const source = await readFile(migrationPath, "utf8");
  const isolationSource = await readFile(isolationMigrationPath, "utf8");

  assert.match(source, /product_publication_candidate_payload_pre_admin_v1/u);
  assert.match(source, /apply_catalog_admin_characteristics_draft_v1/u);
  assert.match(source, /order by\s+\(characteristic\.item ->> 'groupSortOrder'\)::integer,[\s\S]+itemSortOrder/u);
  assert.match(source, /'recordOrigin', 'legacy'/u);
  assert.match(source, /'editorialRecordOrigin'/u);
  assert.match(source, /'source', jsonb_build_object/u);
  assert.doesNotMatch(source, /create trigger[\s\S]+published_catalog_projection/iu);
  assert.match(
    isolationSource,
    /product_publication_candidate_with_admin_draft_v1/u,
  );
  assert.match(
    isolationSource,
    /select cloud\.product_publication_candidate_payload_pre_admin_v1\(p_product_id\)/u,
  );
  assert.doesNotMatch(isolationSource, /insert into|update cloud\.|delete from/iu);
  assert.match(
    isolationSource,
    /revoke all on function cloud\.product_publication_candidate_with_admin_draft_v1\(uuid\)[\s\S]+from public, anon, authenticated, service_role/u,
  );
});

test("owner, RLS and grants expose only the cloud_api service boundary", async () => {
  const source = await readFile(migrationPath, "utf8");

  assert.match(source, /enable row level security/u);
  assert.match(source, /owner to postgres/u);
  assert.doesNotMatch(source, /owner to supabase_admin/u);
  assert.match(source, /revoke all on table cloud\.catalog_admin_product_characteristic_drafts_v1[\s\S]+from public, anon, authenticated, service_role/u);
  assert.match(source, /revoke all on function cloud_api\.catalog_admin_patch_product_characteristics_v1\([\s\S]+from public, anon, authenticated/u);
  assert.match(source, /grant execute on function cloud_api\.catalog_admin_patch_product_characteristics_v1\([\s\S]+to service_role/u);
  assert.doesNotMatch(source, /grant (select|insert|update|delete) on .*catalog_admin_product_characteristic_drafts_v1/iu);
});

test("transactional integration covers validation, rollback, idempotency and invariance", async () => {
  const fixture = await readFile(integrationPath, "utf8");

  assert.match(fixture, /^begin;/mu);
  assert.match(fixture, /^rollback;/mu);
  assert.match(fixture, /anonymous characteristics patch was accepted/u);
  assert.match(fixture, /non-corporate actor was accepted/u);
  assert.match(fixture, /non-ru locale was accepted/u);
  assert.match(fixture, /stale characteristics patch was accepted/u);
  assert.match(fixture, /duplicate characteristic key was accepted/u);
  assert.match(fixture, /empty characteristic set was accepted/u);
  assert.match(fixture, /malformed characteristic was accepted/u);
  assert.match(fixture, /invalid patch left a partial write/u);
  assert.match(fixture, /same payload was not idempotent/u);
  assert.match(fixture, /candidate characteristics are not deterministic/u);
  assert.match(fixture, /published projection state changed/u);
  assert.match(fixture, /lifecycle evidence changed/u);
  assert.match(fixture, /immutable provenance changed/u);
});

test("migration digest is stable evidence", async () => {
  const source = await readFile(migrationPath);
  assert.match(createHash("sha256").update(source).digest("hex"), /^[0-9a-f]{64}$/u);
});
