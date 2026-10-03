import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const expectedManifestSha =
  "7444e7872b109d4ad86ffe69cc6c04cb9623d56cc574dc6effe82e9197df13a1";

test("Wave 3 manifest is immutable, exact and server-only", async () => {
  const manifest = await readFile(
    "lib/operations/catalog-wave-3-manifest.ts",
    "utf8",
  );
  assert.match(manifest, /^import "server-only";/u);
  assert.match(manifest, new RegExp(expectedManifestSha, "u"));
  assert.match(manifest, /catalog-publication-wave-3-v1/u);
  assert.equal((manifest.match(/productId: "/gu) ?? []).length, 8);
  assert.equal((manifest.match(/revisionId: "/gu) ?? []).length, 8);
  assert.equal((manifest.match(/reviewItemId: "/gu) ?? []).length, 8);
  assert.equal((manifest.match(/decisionId: "/gu) ?? []).length, 8);
  assert.equal((manifest.match(/candidatePayloadChecksum: "/gu) ?? []).length, 8);
  assert.equal((manifest.match(/payloadChecksum: "/gu) ?? []).length, 8);
  assert.equal((manifest.match(/productIdentityChecksum: "/gu) ?? []).length, 8);
  assert.equal((manifest.match(/reviewedAt: "/gu) ?? []).length, 8);
  assert.equal((manifest.match(/warnings: \[/gu) ?? []).length, 8);
  assert.match(manifest, /Object\.keys\(record\)\.length === 2/u);
  assert.doesNotMatch(manifest, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);

  const runnable = ts.transpileModule(
    manifest.replace(/^import "server-only";\n/u, ""),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const runtimeModule = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(runnable, {
    exports: runtimeModule.exports,
    module: runtimeModule,
    Object,
  });
  const value = runtimeModule.exports.CATALOG_WAVE_3_MANIFEST as {
    version: string;
    createdAt: string;
    operationKey: string;
    productCount: number;
    entries: readonly unknown[];
  };
  const input = {
    version: value.version,
    createdAt: value.createdAt,
    operationKey: value.operationKey,
    productCount: value.productCount,
    entries: value.entries,
  };
  assert.equal(
    createHash("sha256").update(JSON.stringify(input)).digest("hex"),
    expectedManifestSha,
  );
});

test("Wave 3 runner remains inside approved service-only boundaries", async () => {
  const runner = await readFile(
    "lib/operations/catalog-wave-3-runner.ts",
    "utf8",
  );
  assert.match(runner, /^import "server-only";/u);
  assert.match(runner, /createProjectBoundSupabaseServerClient/u);
  assert.match(runner, /approveProductPublicationRevision/u);
  assert.match(runner, /publishProduct/u);
  assert.match(runner, /access !== "service_role"/u);
  assert.match(runner, /productIds\.size !== 8/u);
  assert.match(runner, /revisionIds\.size !== 8/u);
  assert.match(runner, /decisionIds\.size !== 8/u);
  assert.match(runner, /reviewItemIds\.size !== 8/u);
  assert.match(runner, /catalog-wave-3-publish-\$\{entry\.productId\}/u);
  assert.match(runner, /projection\.products\.length !== 28/u);
  assert.match(runner, /projection\.products\.length !== 36/u);
  assert.match(runner, /remainingReviewedUnpublished: 0/u);
  assert.match(runner, /already_completed/u);
  assert.match(runner, /approval_durable_verification_failed/u);
  assert.match(runner, /publication_durable_verification_failed/u);
  assert.match(runner, /wave_not_fully_published/u);
  assert.doesNotMatch(runner, /createClient\(|localStorage|persistSession|autoRefreshToken/u);
  assert.doesNotMatch(runner, /insert into|update cloud\.|delete from|Accept-Profile": "cloud"/iu);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("Wave 3 execution surface re-authorizes Production admin", async () => {
  const action = await readFile(
    "app/internal/operations/catalog-publication-wave-3/execute/actions.ts",
    "utf8",
  );
  const page = await readFile(
    "app/internal/operations/catalog-publication-wave-3/execute/page.tsx",
    "utf8",
  );
  const component = await readFile(
    "components/internal/CatalogWave3ExecutionAction.tsx",
    "utf8",
  );
  assert.match(action, /^"use server";/u);
  assert.match(action, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.match(action, /getTrustedAdmin/u);
  assert.match(action, /if \(!user \|\| !productionEnvironmentPresent\(\)\)/u);
  assert.doesNotMatch(action, /EXPECTED_ADMIN_ID|APPROVED_REVIEWER/u);
  assert.match(action, /executeProductionCatalogWave3\(\)/u);
  assert.match(component, /useActionState/u);
  assert.match(component, /executeCatalogWave3Action/u);
  assert.match(page, /CatalogWave3ExecutionAction/u);
  assert.doesNotMatch(component, /productId|revisionId|decisionId|serviceRole/u);
  assert.doesNotMatch(page, /productId|revisionId|decisionId|serviceRole/u);
});

test("Wave 1 and Wave 2 tracked operation files are not modified by Wave 3", async () => {
  const wave1 = await readFile("lib/operations/catalog-wave-1-manifest.ts", "utf8");
  const wave2 = await readFile("lib/operations/catalog-wave-2-manifest.ts", "utf8");
  assert.match(wave1, /45694001e0652a23977de759a5b6ca86dbfe893fd8c38a1c151739be13c42405/u);
  assert.match(wave2, /b19fda10991a2ae81db9bf87bb1565e1dcb7e1e2eea582a97cca3097495a8204/u);
});
