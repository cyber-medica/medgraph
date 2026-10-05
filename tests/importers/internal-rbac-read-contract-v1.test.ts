import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/202608010001_internal_rbac_read_contract_v1.sql";

test("internal access RPC is auth.uid-only, argument-free and read-only", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /create function cloud_api\.current_internal_access_v1\(\)/u);
  assert.match(migration, /returns jsonb/u);
  assert.match(migration, /security definer/u);
  assert.match(migration, /stable/u);
  assert.match(migration, /set search_path = pg_catalog, auth, cloud/u);
  assert.match(migration, /select auth\.uid\(\) as user_id/u);
  assert.match(migration, /profile\.id = caller\.user_id/u);
  assert.match(migration, /profile\.role in \('admin', 'reviewer'\)/u);
  assert.match(migration, /'userId', caller\.user_id/u);
  assert.match(migration, /'role', allowed_profile\.role/u);
  assert.match(migration, /'displayName', allowed_profile\.display_name/u);
  assert.match(migration, /'allowed', allowed_profile\.id is not null/u);

  assert.doesNotMatch(migration, /current_internal_access_v1\([^)]*(user|email|role)/u);
  assert.doesNotMatch(migration, /\b(insert|update|delete|merge)\b/iu);
  assert.doesNotMatch(migration, /execute\s+format/iu);
  assert.doesNotMatch(migration, /email|token|metadata/iu);
});

test("internal access owner and grants remain inside the approved Supabase boundary", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(
    migration,
    /alter function cloud_api\.current_internal_access_v1\(\)[\s\S]+owner to postgres/u,
  );
  assert.match(
    migration,
    /revoke all on function cloud_api\.current_internal_access_v1\(\)[\s\S]+from public, anon, service_role/u,
  );
  assert.match(
    migration,
    /grant execute on function cloud_api\.current_internal_access_v1\(\)[\s\S]+to authenticated/u,
  );
  assert.doesNotMatch(migration, /grant select on (table )?cloud\.user_profiles to authenticated/u);
  assert.doesNotMatch(migration, /create policy[\s\S]+to authenticated/u);
});

test("internal routes require verified session claims and live profile access", async () => {
  const [session, callback, constants] = await Promise.all([
    readFile("lib/internal-auth/session.ts", "utf8"),
    readFile("app/auth/callback/route.ts", "utf8"),
    readFile("lib/internal-auth/constants.ts", "utf8"),
  ]);

  assert.doesNotMatch(constants, /APPROVED_REVIEWER|gmail\.com/iu);
  assert.match(session, /current_internal_access_v1/u);
  assert.match(session, /isApprovedInternalAccess/u);
  assert.match(session, /access/u);
  assert.match(session, /getClaims\(\)/u);
  assert.match(session, /session_id/u);
  assert.match(callback, /readActiveTrustedReviewer/u);
  assert.match(callback, /signOut\(\{ scope: "local" \}\)/u);
  assert.doesNotMatch(`${session}\n${callback}`, /service_role|SUPABASE_SERVICE_ROLE_KEY/u);
});
