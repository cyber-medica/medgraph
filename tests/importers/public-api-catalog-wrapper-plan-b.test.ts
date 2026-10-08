import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/202610080001_public_api_published_catalog_wrapper_plan_b.sql";

test("Plan B migration creates an atomic, service-only SECURITY INVOKER wrapper", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /^begin;$/mu);
  assert.match(migration, /^commit;$/mu);
  assert.match(
    migration,
    /create or replace function public_api\.cloud_published_storefront_catalog_v1\(\)\s+returns jsonb\s+language sql\s+stable\s+security invoker\s+set search_path = pg_catalog/iu,
  );
  assert.match(
    migration,
    /as \$\$\s+select cloud_api\.cloud_published_storefront_catalog_v1\(\)\s+\$\$;/u,
  );
  assert.match(
    migration,
    /alter function public_api\.cloud_published_storefront_catalog_v1\(\)\s+owner to postgres;/u,
  );
  assert.match(migration, /grant usage on schema public_api to service_role;/u);
  assert.match(
    migration,
    /revoke all on function public_api\.cloud_published_storefront_catalog_v1\(\)\s+from public, anon, authenticated;/u,
  );
  assert.match(
    migration,
    /grant execute on function public_api\.cloud_published_storefront_catalog_v1\(\)\s+to service_role;/u,
  );

  const createPosition = migration.indexOf("create or replace function public_api");
  const revokePosition = migration.indexOf("revoke all on function public_api");
  const commitPosition = migration.lastIndexOf("commit;");
  assert.ok(createPosition >= 0 && revokePosition > createPosition && commitPosition > revokePosition);

  assert.doesNotMatch(migration, /create or replace function (?:cloud|cloud_api)\./u);
  assert.doesNotMatch(migration, /\b(?:insert|update|delete)\b|execute\s+(?:format|immediate)/iu);
});
