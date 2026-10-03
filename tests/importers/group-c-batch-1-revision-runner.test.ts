import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const expectedManifestSha =
  "2e8e165c7b27ac5b64a226916a7a26289711ff46b5bcded109e3029ca9f40ae9";
const excludedProductIds = [
  "d7506879-32fc-48ae-9ea6-8561f2c5868a",
  "860306a1-e01e-4f10-b980-93490e446d37",
  "7efe1eb2-6551-4f0b-9310-c898cbcfdf7a",
  "8bee3a8e-97a7-420a-aa9f-2f082136060d",
  "e7a54ec6-986d-422a-aca8-862d4d00a421",
];

test("Group C Batch 1 revision manifest is exact and digest-bound", async () => {
  const source = await readFile(
    "lib/operations/group-c-batch-1-revision-manifest.ts",
    "utf8",
  );
  assert.match(source, /^import "server-only";/u);
  assert.match(source, new RegExp(expectedManifestSha, "u"));
  assert.match(source, /group-c-batch-1-revision-creation-v1/u);
  assert.equal((source.match(/productId: "/gu) ?? []).length, 16);
  assert.equal((source.match(/sourceUid: "/gu) ?? []).length, 8);
  assert.equal((source.match(/candidatePayloadChecksum:/gu) ?? []).length, 9);
  assert.equal((source.match(/payloadChecksum:/gu) ?? []).length, 9);
  assert.equal((source.match(/productIdentityChecksum:/gu) ?? []).length, 9);
  assert.equal((source.match(/rawSnapshotSha256:/gu) ?? []).length, 9);
  assert.equal((source.match(/expectedUpdatedAt:/gu) ?? []).length, 9);
  assert.match(source, /Object\.keys\(record\)\.length === 2/u);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
  assert.equal((source.match(/revisionId: "/gu) ?? []).length, 8);
  assert.equal((source.match(/reviewItemId: "/gu) ?? []).length, 8);

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
  const input = (runtimeModule.exports.groupCBatch1RevisionManifestDigestInput as () => unknown)();
  assert.equal(
    createHash("sha256").update(JSON.stringify(input)).digest("hex"),
    expectedManifestSha,
  );
});

test("generic Review Queue contains the exact eight durable Batch 1 bindings", async () => {
  const manifest = await readFile(
    "lib/review/publication-revision-manifest.ts",
    "utf8",
  );
  const expectedRevisionIds = [
    "685637b7-471a-4b8e-bd85-95633f6caf03",
    "e87cbd30-ccd5-4418-93ac-2c3817a842c9",
    "650e6150-fada-41ee-a3a3-f8ea2da5b65c",
    "acae1207-9d59-4ad9-94d8-1716a6655812",
    "c4c4cc16-1631-4289-9437-7a908c4b53ed",
    "a7fef268-87c8-44b4-bb38-265befedaed1",
    "8f68bcc0-0822-4a14-ae1f-09b3804a2d6a",
    "181da0a6-fad3-4c2c-aed9-fec7ca06634f",
  ];
  for (const revisionId of expectedRevisionIds) {
    assert.equal((manifest.match(new RegExp(revisionId, "gu")) ?? []).length, 1);
  }
  for (const productId of excludedProductIds) {
    if (productId === "8bee3a8e-97a7-420a-aa9f-2f082136060d") {
      assert.equal((manifest.match(new RegExp(productId, "gu")) ?? []).length, 1);
    } else {
      assert.doesNotMatch(manifest, new RegExp(productId, "u"));
    }
  }
});

test("revision runner uses only approved RPC and exact server-side scope", async () => {
  const runner = await readFile(
    "lib/operations/group-c-batch-1-revision-runner.ts",
    "utf8",
  );
  assert.match(runner, /^import "server-only";/u);
  assert.match(runner, /createProjectBoundSupabaseServerClient/u);
  assert.match(runner, /createProductPublicationRevision/u);
  assert.match(runner, /access !== "service_role"/u);
  assert.match(runner, /group-c-batch-1-\$\{entry\.sourceUid\}-revision-1/u);
  assert.match(runner, /revisionNumber !== 1/u);
  assert.match(runner, /candidate_nondeterministic/u);
  assert.match(runner, /catalog_product_provenance_drift/u);
  assert.match(runner, /typeof product\.immutable\.rawSnapshot !== "object"/u);
  assert.match(runner, /revision_idempotency_failed/u);
  assert.match(runner, /partial_revision_creation/u);
  assert.match(runner, /preexisting_revision/u);
  assert.match(runner, /mixed_revision_state/u);
  assert.match(runner, /revision_completion_evidence_drift/u);
  assert.match(runner, /projection\.products\.length !== 42/u);
  assert.match(runner, /for \(let read = 0; read < 10; read \+= 1\)/u);
  for (const productId of excludedProductIds) {
    assert.match(runner, new RegExp(productId, "u"));
  }
  assert.doesNotMatch(runner, /approveProduct|publishProduct|record.*decision/iu);
  assert.doesNotMatch(runner, /insert into|update cloud\.|delete from|Accept-Profile": "cloud"/iu);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("route requires corporate same-origin Production session and exact request", async () => {
  const route = await readFile(
    "app/internal/operations/group-c-batch-1-revisions/route.ts",
    "utf8",
  );
  const component = await readFile(
    "components/internal/GroupCBatch1RevisionExecution.tsx",
    "utf8",
  );
  assert.match(route, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.ok(
    route.indexOf('process.env.VERCEL_ENV !== "production"')
      < route.indexOf("createInternalAuthRouteClient(request)"),
    "Preview must fail closed before constructing an Auth client",
  );
  assert.match(route, /readActiveTrustedReviewer/u);
  assert.match(route, /active\.access\.role !== "admin"/u);
  assert.doesNotMatch(route, /APPROVED_REVIEWER|EXPECTED_ADMIN_ID/u);
  assert.match(route, /sec-fetch-site/u);
  assert.match(route, /validateGroupCBatch1RevisionOperationRequest/u);
  assert.match(route, /executeProductionGroupCBatch1RevisionCreation/u);
  assert.match(component, new RegExp(expectedManifestSha, "u"));
  assert.match(component, /operationKey: OPERATION_KEY/u);
  assert.match(component, /manifestSha256: MANIFEST_SHA256/u);
  assert.doesNotMatch(component, /body: JSON\.stringify\(\{[^}]*productId/iu);
  assert.doesNotMatch(component, /service.role|serviceRole/iu);
  assert.doesNotMatch(route, /legacy|armansmarkosyan@gmail\.com|0a5270ac/iu);
});
