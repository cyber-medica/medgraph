import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const expectedManifestSha =
  "54cd498122a1cc205f8c071e85d73922a81053fc2913dbeb519fe6126befd3cd";
const excludedProductIds = [
  "46340003-dffa-4321-b5c1-cb3f4a5cf317",
  "f3053ed8-d29a-41ff-b9e1-a873dd6b77f1",
  "d7506879-32fc-48ae-9ea6-8561f2c5868a",
  "860306a1-e01e-4f10-b980-93490e446d37",
  "7efe1eb2-6551-4f0b-9310-c898cbcfdf7a",
  "e7a54ec6-986d-422a-aca8-862d4d00a421",
];

test("Group C Batch 2 revision manifest is exact and digest-bound", async () => {
  const source = await readFile("lib/operations/group-c-batch-2-revision-manifest.ts", "utf8");
  assert.match(source, /^import "server-only";/u);
  assert.match(source, new RegExp(expectedManifestSha, "u"));
  assert.match(source, /group-c-batch-2-revision-creation-v1/u);
  assert.equal((source.match(/productId: "/gu) ?? []).length, 26);
  assert.equal((source.match(/sourceUid: "/gu) ?? []).length, 13);
  assert.equal((source.match(/candidatePayloadChecksum:/gu) ?? []).length, 14);
  assert.equal((source.match(/payloadChecksum:/gu) ?? []).length, 14);
  assert.equal((source.match(/productIdentityChecksum:/gu) ?? []).length, 14);
  assert.equal((source.match(/rawSnapshotSha256:/gu) ?? []).length, 14);
  assert.equal((source.match(/expectedUpdatedAt:/gu) ?? []).length, 14);
  assert.match(source, /Object\.keys\(record\)\.length === 2/u);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
  assert.equal((source.match(/revisionId: "/gu) ?? []).length, 13);
  assert.equal((source.match(/reviewItemId: "/gu) ?? []).length, 13);

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
  const input = (runtimeModule.exports.groupCBatch2RevisionManifestDigestInput as () => unknown)();
  assert.equal(createHash("sha256").update(JSON.stringify(input)).digest("hex"), expectedManifestSha);
});

test("revision runner uses only approved RPC and exact server-side scope", async () => {
  const runner = await readFile("lib/operations/group-c-batch-2-revision-runner.ts", "utf8");
  assert.match(runner, /^import "server-only";/u);
  assert.match(runner, /createProjectBoundSupabaseServerClient/u);
  assert.match(runner, /createProductPublicationRevision/u);
  assert.match(runner, /access !== "service_role"/u);
  assert.match(runner, /group-c-batch-2-\$\{entry\.sourceUid\}-revision-1/u);
  assert.match(runner, /revisionNumber !== 1/u);
  assert.match(runner, /candidate_nondeterministic/u);
  assert.match(runner, /postgresJsonbSha256\(product\.immutable\.rawSnapshot\)/u);
  assert.match(runner, /candidate_payload_checksum|candidatePayloadChecksum/u);
  assert.match(runner, /revision_idempotency_failed/u);
  assert.match(runner, /partial_revision_creation/u);
  assert.match(runner, /preexisting_revision/u);
  assert.match(runner, /mixed_revision_state/u);
  assert.match(runner, /revision_completion_evidence_drift/u);
  assert.match(runner, /projection\.products\.length !== 50/u);
  assert.match(runner, /for \(let read = 0; read < 10; read \+= 1\)/u);
  for (const productId of excludedProductIds) assert.match(runner, new RegExp(productId, "u"));
  assert.doesNotMatch(runner, /approveProduct|publishProduct|record.*decision/iu);
  assert.doesNotMatch(runner, /insert into|update cloud\.|delete from|Accept-Profile": "cloud"/iu);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("route requires corporate same-origin Production session and exact request", async () => {
  const route = await readFile("app/internal/operations/group-c-batch-2-revisions/route.ts", "utf8");
  const component = await readFile("components/internal/GroupCBatch2RevisionExecution.tsx", "utf8");
  assert.match(route, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.ok(route.indexOf('process.env.VERCEL_ENV !== "production"') < route.indexOf("createInternalAuthRouteClient(request)"));
  assert.match(route, /readActiveTrustedReviewer/u);
  assert.match(route, /active\.access\.role !== "admin"/u);
  assert.doesNotMatch(route, /APPROVED_REVIEWER|EXPECTED_ADMIN_ID/u);
  assert.match(route, /sec-fetch-site/u);
  assert.match(route, /validateGroupCBatch2RevisionOperationRequest/u);
  assert.match(route, /executeProductionGroupCBatch2RevisionCreation/u);
  assert.match(component, new RegExp(expectedManifestSha, "u"));
  assert.match(component, /operationKey: OPERATION_KEY/u);
  assert.match(component, /manifestSha256: MANIFEST_SHA256/u);
  assert.doesNotMatch(component, /body: JSON\.stringify\(\{[^}]*productId/iu);
  assert.doesNotMatch(route, /armansmarkosyan@gmail\.com|0a5270ac/iu);
});
