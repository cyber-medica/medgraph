import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const manifestSha = "ddac576c6a5b5d9322e15d9f109d91120ca5bf3145de1b6a6a4afd4d8a20e4c2";

test("IDN-03 publication manifest is exact and immutable", async () => {
  const source = await readFile("lib/operations/idn-03-publication-manifest.ts", "utf8");
  assert.match(source, /^import "server-only";/u);
  assert.match(source, new RegExp(manifestSha, "u"));
  assert.equal((source.match(/productId: "/gu) ?? []).length, 1);
  assert.equal((source.match(/revisionId: "/gu) ?? []).length, 1);
  assert.match(source, /idn-03-approval-v1/u);
  assert.match(source, /idn-03-publication-v1/u);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);

  const runnable = ts.transpileModule(source.replace(/^import "server-only";\n/u, ""), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleValue = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(runnable, {
    exports: moduleValue.exports,
    module: moduleValue,
    require: (specifier: string) => {
      assert.equal(specifier, "node:crypto");
      return { createHash };
    },
    Object,
    JSON,
  });
  assert.equal(
    (moduleValue.exports.calculateIdn03PublicationManifestSha256 as () => string)(),
    manifestSha,
  );
});

test("IDN-03 runner is narrow, replay-safe and service-only", async () => {
  const runner = await readFile("lib/operations/idn-03-publication-runner.ts", "utf8");
  assert.match(runner, /^import "server-only";/u);
  assert.match(runner, /createProjectBoundSupabaseServerClient/u);
  assert.match(runner, /approveProductPublicationRevision/u);
  assert.match(runner, /publishProduct/u);
  assert.match(runner, /already_complete/u);
  assert.match(runner, /approval_replay_failed/u);
  assert.match(runner, /publication_replay_failed/u);
  assert.match(runner, /afterProjection\.products\.length !== 71/u);
  assert.match(runner, /environment\["CYBERMEDICA_IDN03_REVIEWER_ID"\]/u);
  assert.match(runner, /actorId !== configuredReviewerId/u);
  assert.match(runner, /actor_identity_invalid/u);
  assert.doesNotMatch(runner, /reviewerId:/u);
  assert.doesNotMatch(runner, /insert into|update cloud\.|delete from/iu);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY|Authorization|Bearer/u);
});

test("IDN-03 operation route re-authorizes corporate admin and exact body", async () => {
  const route = await readFile("app/internal/operations/idn-03-publication/route.ts", "utf8");
  const page = await readFile(
    "app/internal/operations/idn-03-publication/execute/page.tsx",
    "utf8",
  );
  const component = await readFile(
    "components/internal/Idn03PublicationExecution.tsx",
    "utf8",
  );
  assert.match(route, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.match(route, /readActiveTrustedReviewer/u);
  assert.match(route, /active\.access\.role !== "admin"/u);
  assert.match(route, /executeProductionIdn03Publication\(active\.user\.id\)/u);
  assert.doesNotMatch(route, /APPROVED_REVIEWER|EXPECTED_ADMIN_ID/u);
  assert.match(route, /same_origin_required/u);
  assert.match(route, /validateIdn03PublicationOperationRequest/u);
  assert.match(page, /requireTrustedReviewer/u);
  assert.match(component, /operationKey: OPERATION_KEY/u);
  assert.match(component, /manifestSha256: MANIFEST_SHA256/u);
  assert.doesNotMatch(component, /24ac72fc|5801cde4|serviceRole/u);
});
