import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const expectedManifestSha =
  "666b2ec919182fce60c625d2642db1f1b2daba522833e7a583e58e8bca78963f";
const targetProductId = "24ac72fc-5c64-4f4e-9f92-cd4eca58e426";
const excludedProductIds = [
  "d7506879-32fc-48ae-9ea6-8561f2c5868a",
  "860306a1-e01e-4f10-b980-93490e446d37",
  "db6da513-24dc-45e3-8e18-c6033825adce",
  "5c41e1d8-6311-4a63-bb99-41b8ae17d8a1",
  "f3053ed8-d29a-41ff-b9e1-a873dd6b77f1",
  "46340003-dffa-4321-b5c1-cb3f4a5cf317",
  "7efe1eb2-6551-4f0b-9310-c898cbcfdf7a",
  "e7a54ec6-986d-422a-aca8-862d4d00a421",
];

test("IDN-03 revision manifest is exact and digest-bound", async () => {
  const source = await readFile("lib/operations/idn-03-revision-manifest.ts", "utf8");
  assert.match(source, /^import "server-only";/u);
  assert.match(source, new RegExp(expectedManifestSha, "u"));
  assert.match(source, /idn-03-revision-creation-v1/u);
  assert.match(source, /idn-03-initial-revision-v1|sourceArtifacts/u);
  assert.equal((source.match(/productId: "/gu) ?? []).length, 2);
  assert.equal((source.match(/sourceUid: "/gu) ?? []).length, 1);
  assert.match(source, new RegExp(targetProductId, "u"));
  assert.match(source, /productCount: 1/u);
  assert.match(source, /5801cde4-9341-4fe9-9e35-da47627754f9/u);
  assert.match(source, /a0654fd4-d65f-450d-b8ed-2270408fdcbe/u);
  assert.match(source, /Object\.keys\(record\)\.length === 2/u);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);

  const runnable = ts.transpileModule(
    source.replace(/^import "server-only";\n\n/u, ""),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const runtimeModule = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(runnable, {
    exports: runtimeModule.exports,
    module: runtimeModule,
    require: (specifier: string) => {
      if (specifier === "node:crypto") return { createHash };
      throw new Error(`Unexpected module: ${specifier}`);
    },
    Object,
    JSON,
  });
  const input = (runtimeModule.exports.idn03RevisionManifestDigestInput as () => unknown)();
  assert.equal(createHash("sha256").update(JSON.stringify(input)).digest("hex"), expectedManifestSha);
  const validate = runtimeModule.exports.validateIdn03RevisionOperationRequest as (value: unknown) => boolean;
  assert.equal(validate({ operationKey: "idn-03-revision-creation-v1", manifestSha256: expectedManifestSha }), true);
  assert.equal(validate({ operationKey: "wrong", manifestSha256: expectedManifestSha }), false);
  assert.equal(validate({ operationKey: "idn-03-revision-creation-v1", manifestSha256: `${expectedManifestSha}0` }), false);
});

test("IDN-03 runner uses only the approved one-Product RPC scope", async () => {
  const runner = await readFile("lib/operations/idn-03-revision-runner.ts", "utf8");
  assert.match(runner, /^import "server-only";/u);
  assert.match(runner, /createProjectBoundSupabaseServerClient/u);
  assert.match(runner, /createProductPublicationRevision/u);
  assert.match(runner, /access !== "service_role"/u);
  assert.match(runner, /idn-03-initial-revision-v1/u);
  assert.match(runner, /revisionNumber !== 1/u);
  assert.match(runner, /candidate_nondeterministic/u);
  assert.match(runner, /for \(let read = 0; read < 10; read \+= 1\)/u);
  assert.match(runner, /projection\.products\.length !== 70/u);
  assert.match(runner, /preexisting_revision/u);
  assert.match(runner, /revision_idempotency_failed/u);
  assert.match(runner, new RegExp(targetProductId, "u"));
  for (const productId of excludedProductIds) assert.match(runner, new RegExp(productId, "u"));
  assert.doesNotMatch(runner, /approveProduct|publishProduct|record.*decision/iu);
  assert.doesNotMatch(runner, /insert into|update cloud\.|delete from|Accept-Profile": "cloud"/iu);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("IDN-03 route requires a corporate same-origin Production session", async () => {
  const route = await readFile("app/internal/operations/idn-03-revision/route.ts", "utf8");
  const component = await readFile("components/internal/Idn03RevisionExecution.tsx", "utf8");
  assert.match(route, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.ok(route.indexOf('process.env.VERCEL_ENV !== "production"') < route.indexOf("createInternalAuthRouteClient(request)"));
  assert.match(route, /readActiveTrustedReviewer/u);
  assert.match(route, /active\.access\.role !== "admin"/u);
  assert.doesNotMatch(route, /APPROVED_REVIEWER|EXPECTED_ADMIN_ID/u);
  assert.match(route, /sec-fetch-site/u);
  assert.match(route, /validateIdn03RevisionOperationRequest/u);
  assert.match(route, /executeProductionIdn03RevisionCreation/u);
  assert.match(component, new RegExp(expectedManifestSha, "u"));
  assert.match(component, /operationKey: OPERATION_KEY/u);
  assert.match(component, /manifestSha256: MANIFEST_SHA256/u);
  assert.doesNotMatch(component, /body: JSON\.stringify\(\{[^}]*productId/iu);
  assert.doesNotMatch(route, /armansmarkosyan@gmail\.com|0a5270ac/iu);
});

test("IDN-03 execution page stops before Human Review", async () => {
  const page = await readFile("app/internal/operations/idn-03-revision/execute/page.tsx", "utf8");
  assert.match(page, /requireTrustedReviewer/u);
  assert.match(page, /Human Review/u);
  assert.match(page, /Approval/u);
  assert.match(page, /Publication/u);
  assert.doesNotMatch(page, /reviewDecision|approveProduct|publishProduct/u);
});

test("generic Review Queue contains the exact durable IDN-03 binding", async () => {
  const manifest = await readFile("lib/review/publication-revision-manifest.ts", "utf8");
  for (const value of [
    targetProductId,
    "363181290312",
    "5801cde4-9341-4fe9-9e35-da47627754f9",
    "a0654fd4-d65f-450d-b8ed-2270408fdcbe",
    "85dda33600089199c2075edf08cd75f77b474e9bcee424de254f3431b3347540",
    "de5abe9eff70f515ab3d2908ff91f02888b46e60c0667c3b96c83fffe09a4b80",
    "855dff5fab9e9531e2063550b4bf9641f0ef12efac50d26adb743dd902faa561",
  ]) {
    assert.equal((manifest.match(new RegExp(value, "gu")) ?? []).length, 1);
  }
});
