import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const expectedManifestSha =
  "33b32702f4c433c07a8bb568d8a97f815be2afbb59d750ebddf989a0c01785be";

test("Group C Batch 2 publication manifest is immutable and exact", async () => {
  const source = await readFile(
    "lib/operations/group-c-batch-2-publication-manifest.ts",
    "utf8",
  );
  assert.match(source, /^import "server-only";/u);
  assert.match(source, new RegExp(expectedManifestSha, "u"));
  assert.match(source, /group-c-batch-2-publication-v1/u);
  assert.equal((source.match(/productId: "/gu) ?? []).length, 13);
  assert.equal((source.match(/revisionId: "/gu) ?? []).length, 13);
  assert.equal((source.match(/reviewItemId: "/gu) ?? []).length, 13);
  assert.equal((source.match(/decisionId: "/gu) ?? []).length, 13);
  assert.equal((source.match(/reviewedAt: "/gu) ?? []).length, 13);
  assert.match(source, /Object\.keys\(record\)\.length === 2/u);
  for (const excluded of [
    "46340003-dffa-4321-b5c1-cb3f4a5cf317",
    "f3053ed8-d29a-41ff-b9e1-a873dd6b77f1",
    "d7506879-32fc-48ae-9ea6-8561f2c5868a",
    "860306a1-e01e-4f10-b980-93490e446d37",
    "7efe1eb2-6551-4f0b-9310-c898cbcfdf7a",
    "e7a54ec6-986d-422a-aca8-862d4d00a421",
  ]) assert.doesNotMatch(source, new RegExp(excluded, "u"));
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);

  const runnable = ts.transpileModule(
    source.replace(/^import "server-only";\n/u, ""),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const runtimeModule = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(runnable, {
    exports: runtimeModule.exports,
    module: runtimeModule,
    require: (specifier: string) => {
      assert.equal(specifier, "node:crypto");
      return { createHash };
    },
    Object,
    JSON,
  });
  const value = runtimeModule.exports.GROUP_C_BATCH_2_PUBLICATION_MANIFEST as {
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
  assert.equal(createHash("sha256").update(JSON.stringify(input)).digest("hex"), expectedManifestSha);
});

test("Group C Batch 2 runner remains exact and service-only", async () => {
  const runner = await readFile(
    "lib/operations/group-c-batch-2-publication-runner.ts",
    "utf8",
  );
  assert.match(runner, /^import "server-only";/u);
  assert.match(runner, /createProjectBoundSupabaseServerClient/u);
  assert.match(runner, /approveProductPublicationRevision/u);
  assert.match(runner, /publishProduct/u);
  assert.match(runner, /access !== "service_role"/u);
  assert.match(runner, /productIds\.size !== 13/u);
  assert.match(runner, /decisionIds\.size !== 13/u);
  assert.match(runner, /group-c-batch-2-approval-\$\{entry\.revisionId\}/u);
  assert.match(runner, /group-c-batch-2-publish-\$\{entry\.productId\}/u);
  assert.match(runner, /projection\.products\.length !== 50/u);
  assert.match(runner, /projection\.products\.length !== 63/u);
  assert.match(runner, /already_complete/u);
  assert.match(runner, /approval_durable_verification_failed/u);
  assert.match(runner, /publication_durable_verification_failed/u);
  assert.match(runner, /wave_not_fully_published/u);
  assert.doesNotMatch(runner, /insert into|update cloud\.|delete from|Accept-Profile": "cloud"/iu);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("Group C Batch 2 operation surface re-authorizes corporate admin", async () => {
  const route = await readFile(
    "app/internal/operations/group-c-batch-2-publication/route.ts",
    "utf8",
  );
  const page = await readFile(
    "app/internal/operations/group-c-batch-2-publication/execute/page.tsx",
    "utf8",
  );
  const component = await readFile(
    "components/internal/GroupCBatch2PublicationExecution.tsx",
    "utf8",
  );
  assert.match(route, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.match(route, /readActiveTrustedReviewer/u);
  assert.match(route, /active\.access\.role !== "admin"/u);
  assert.doesNotMatch(route, /APPROVED_REVIEWER|EXPECTED_ADMIN_ID/u);
  assert.match(route, /same_origin_required/u);
  assert.match(route, /validateGroupCBatch2PublicationOperationRequest/u);
  assert.match(page, /requireTrustedReviewer/u);
  assert.match(component, /operationKey: OPERATION_KEY/u);
  assert.match(component, /manifestSha256: MANIFEST_SHA256/u);
  assert.doesNotMatch(component, /050240d2|08b210a6|4fe1c393|serviceRole/u);
});
