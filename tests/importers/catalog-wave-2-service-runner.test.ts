import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedManifestSha =
  "b19fda10991a2ae81db9bf87bb1565e1dcb7e1e2eea582a97cca3097495a8204";

test("Wave 2 manifest is immutable, exact and server-only", async () => {
  const manifest = await readFile(
    "lib/operations/catalog-wave-2-manifest.ts",
    "utf8",
  );
  assert.match(manifest, /^import "server-only";/u);
  assert.match(manifest, new RegExp(expectedManifestSha, "u"));
  assert.match(manifest, /catalog-publication-wave-2-v1/u);
  assert.equal((manifest.match(/productId: "/gu) ?? []).length, 15);
  assert.equal((manifest.match(/revisionId: "/gu) ?? []).length, 15);
  assert.equal((manifest.match(/reviewItemId: "/gu) ?? []).length, 15);
  assert.equal((manifest.match(/decisionId: "/gu) ?? []).length, 15);
  assert.equal((manifest.match(/candidatePayloadChecksum: "/gu) ?? []).length, 15);
  assert.equal((manifest.match(/payloadChecksum: "/gu) ?? []).length, 15);
  assert.equal((manifest.match(/productIdentityChecksum: "/gu) ?? []).length, 15);
  assert.match(manifest, /Object\.keys\(record\)\.length === 2/u);
  assert.doesNotMatch(manifest, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("Wave 2 runner remains inside approved service-only boundaries", async () => {
  const runner = await readFile(
    "lib/operations/catalog-wave-2-runner.ts",
    "utf8",
  );
  assert.match(runner, /^import "server-only";/u);
  assert.match(runner, /createProjectBoundSupabaseServerClient/u);
  assert.match(runner, /approveProductPublicationRevision/u);
  assert.match(runner, /publishProduct/u);
  assert.match(runner, /access !== "service_role"/u);
  assert.match(runner, /productIds\.size !== 15/u);
  assert.match(runner, /revisionIds\.size !== 15/u);
  assert.match(runner, /decisionIds\.size !== 15/u);
  assert.match(runner, /reviewItemIds\.size !== 15/u);
  assert.match(runner, /catalog-wave-2-publish-\$\{entry\.productId\}/u);
  assert.match(runner, /projection\.products\.length !== 13/u);
  assert.match(runner, /projection\.products\.length !== 28/u);
  assert.match(runner, /remainingReviewedUnpublished: 8/u);
  assert.match(runner, /already_completed/u);
  assert.match(runner, /approval_durable_verification_failed/u);
  assert.match(runner, /publication_durable_verification_failed/u);
  assert.match(runner, /wave_not_fully_published/u);
  assert.doesNotMatch(runner, /createClient\(|localStorage|persistSession|autoRefreshToken/u);
  assert.doesNotMatch(runner, /insert into|update cloud\.|delete from|Accept-Profile": "cloud"/iu);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("Wave 2 execution surface re-authorizes Production admin", async () => {
  const action = await readFile(
    "app/internal/operations/catalog-publication-wave-2/execute/actions.ts",
    "utf8",
  );
  const page = await readFile(
    "app/internal/operations/catalog-publication-wave-2/execute/page.tsx",
    "utf8",
  );
  const component = await readFile(
    "components/internal/CatalogWave2ExecutionAction.tsx",
    "utf8",
  );
  assert.match(action, /^"use server";/u);
  assert.match(action, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.match(action, /getTrustedAdmin/u);
  assert.match(action, /if \(!user \|\| !productionEnvironmentPresent\(\)\)/u);
  assert.doesNotMatch(action, /EXPECTED_ADMIN_ID|APPROVED_REVIEWER/u);
  assert.match(action, /executeProductionCatalogWave2\(\)/u);
  assert.match(component, /useActionState/u);
  assert.match(component, /executeCatalogWave2Action/u);
  assert.match(page, /CatalogWave2ExecutionAction/u);
  assert.doesNotMatch(component, /productId|revisionId|decisionId|serviceRole/u);
  assert.doesNotMatch(page, /productId|revisionId|decisionId|serviceRole/u);
});

test("Wave 1 tracked operation files are not modified by Wave 2", async () => {
  const manifest = await readFile("lib/operations/catalog-wave-1-manifest.ts", "utf8");
  const runner = await readFile("lib/operations/catalog-wave-1-runner.ts", "utf8");
  assert.match(manifest, /45694001e0652a23977de759a5b6ca86dbfe893fd8c38a1c151739be13c42405/u);
  assert.match(runner, /remainingReviewedUnpublished: 23/u);
});
