import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedManifestSha =
  "45694001e0652a23977de759a5b6ca86dbfe893fd8c38a1c151739be13c42405";

test("Wave 1 manifest is immutable, exact and server-only", async () => {
  const manifest = await readFile(
    "lib/operations/catalog-wave-1-manifest.ts",
    "utf8",
  );
  assert.match(manifest, /^import "server-only";/u);
  assert.match(manifest, new RegExp(expectedManifestSha, "u"));
  assert.match(manifest, /catalog-publication-wave-1-v1/u);
  assert.equal((manifest.match(/productId: "/gu) ?? []).length, 10);
  assert.equal((manifest.match(/revisionId: "/gu) ?? []).length, 10);
  assert.equal((manifest.match(/reviewItemId: "/gu) ?? []).length, 10);
  assert.equal((manifest.match(/decisionId: "/gu) ?? []).length, 10);
  assert.equal((manifest.match(/candidatePayloadChecksum: "/gu) ?? []).length, 10);
  assert.equal((manifest.match(/payloadChecksum: "/gu) ?? []).length, 10);
  assert.equal((manifest.match(/productIdentityChecksum: "/gu) ?? []).length, 10);
  assert.match(manifest, /Object\.keys\(record\)\.length === 2/u);
  assert.doesNotMatch(manifest, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("runner uses only the project-bound service client and approved lifecycle RPC adapters", async () => {
  const runner = await readFile(
    "lib/operations/catalog-wave-1-runner.ts",
    "utf8",
  );
  assert.match(runner, /^import "server-only";/u);
  assert.match(runner, /createProjectBoundSupabaseServerClient/u);
  assert.match(runner, /approveProductPublicationRevision/u);
  assert.match(runner, /publishProduct/u);
  assert.match(runner, /access !== "service_role"/u);
  assert.doesNotMatch(runner, /createClient\(|localStorage|persistSession|autoRefreshToken/u);
  assert.doesNotMatch(runner, /insert into|update cloud\.|delete from|\.from\([^)]*\)\.insert/iu);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("runner fails closed on stale, missing, extra or checksum-drifted scope", async () => {
  const runner = await readFile(
    "lib/operations/catalog-wave-1-runner.ts",
    "utf8",
  );
  const lifecycle = await readFile(
    "supabase/migrations/202607260001_product_publication_foundation_corrective_v1.sql",
    "utf8",
  );
  assert.match(runner, /productIds\.size !== 10/u);
  assert.match(runner, /revisionIds\.size !== 10/u);
  assert.match(runner, /decisionIds\.size !== 10/u);
  assert.match(runner, /reviewItemIds\.size !== 10/u);
  assert.match(runner, /entry\.candidatePayloadChecksum/u);
  assert.match(runner, /entry\.payloadChecksum/u);
  assert.match(runner, /entry\.productIdentityChecksum/u);
  assert.match(runner, /catalog_product_scope_drift/u);
  assert.match(runner, /published_target_scope_drift/u);
  assert.match(lifecycle, /decision\.approved_payload_checksum is distinct from revision\.payload_checksum/u);
  assert.match(lifecycle, /decision\.product_identity_checksum is distinct from revision\.product_identity_checksum/u);
  assert.match(lifecycle, /current_payload is distinct from revision\.candidate_payload/u);
});

test("approval and publication are durable, idempotent and replay-safe", async () => {
  const runner = await readFile(
    "lib/operations/catalog-wave-1-runner.ts",
    "utf8",
  );
  assert.match(runner, /already_completed/u);
  assert.match(runner, /catalog-wave-1-publish-\$\{entry\.productId\}/u);
  assert.match(runner, /cloud_published_storefront_catalog_v1/u);
  assert.match(runner, /catalog_admin_product/u);
  assert.match(runner, /catalog_admin_products/u);
  assert.match(runner, /approval_durable_verification_failed/u);
  assert.match(runner, /publication_durable_verification_failed/u);
  assert.match(runner, /wave_not_fully_published/u);
  assert.match(runner, /remainingReviewedUnpublished: 23/u);
  assert.match(runner, /for \(const entry of CATALOG_WAVE_1_MANIFEST\.entries\)/u);
  assert.doesNotMatch(runner, /Accept-Profile": "cloud"/u);
});

test("POST route re-authorizes exact admin and never exposes a generic publication API", async () => {
  const route = await readFile(
    "app/internal/operations/catalog-publication-wave/route.ts",
    "utf8",
  );
  assert.match(route, /export async function POST/u);
  assert.doesNotMatch(route, /export async function (GET|PUT|PATCH|DELETE)/u);
  assert.match(route, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.match(route, /sec-fetch-site/u);
  assert.match(route, /same-origin/u);
  assert.match(route, /readActiveTrustedReviewer\(auth\.client\)/u);
  assert.match(route, /active\.access\.role !== "admin"/u);
  assert.doesNotMatch(route, /EXPECTED_ADMIN_ID|APPROVED_REVIEWER/u);
  assert.match(route, /validateCatalogWave1OperationRequest/u);
  assert.match(route, /service_configuration_missing/u);
  assert.match(route, /rawBody\.length > 512/u);
  assert.match(route, /application\/x-www-form-urlencoded/u);
  assert.match(route, /Object\.fromEntries\(form\.entries\(\)\)/u);
  assert.doesNotMatch(route, /productId|revisionId|decisionId/u);
  assert.doesNotMatch(route, /serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY[^?]/u);
});

test("execution page submits only the immutable Wave 1 manifest", async () => {
  const page = await readFile(
    "app/internal/operations/catalog-publication-wave/execute/page.tsx",
    "utf8",
  );
  assert.match(page, /CatalogWave1ExecutionAction/u);
  assert.doesNotMatch(page, /productId|revisionId|decisionId|serviceRole/u);
});

test("execution Server Action re-authorizes the exact Production admin", async () => {
  const action = await readFile(
    "app/internal/operations/catalog-publication-wave/execute/actions.ts",
    "utf8",
  );
  const component = await readFile(
    "components/internal/CatalogWave1ExecutionAction.tsx",
    "utf8",
  );
  assert.match(action, /^"use server";/u);
  assert.match(action, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.match(action, /getTrustedAdmin/u);
  assert.match(action, /if \(!user \|\| !productionEnvironmentPresent\(\)\)/u);
  assert.doesNotMatch(action, /EXPECTED_ADMIN_ID|APPROVED_REVIEWER/u);
  assert.match(action, /executeProductionCatalogWave1\(\)/u);
  assert.match(component, /useActionState/u);
  assert.match(component, /executeCatalogWave1Action/u);
  assert.doesNotMatch(component, /productId|revisionId|decisionId|serviceRole/u);
});
