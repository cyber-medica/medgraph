import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();
const manifestPath = `${root}/data/operations/production-launch-release-v1-manifest.json`;
const migrationPath =
  `${root}/supabase/migrations/202608110001_production_launch_release_v1.sql`;

test("Production launch manifest is immutable and exact 43-Product scope", async () => {
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as {
    version: string;
    operationKey: string;
    candidateCount: number;
    expectedFinalPublishedCount: number;
    products: Array<{
      id: string;
      sourceUid: string;
      slug: string;
      structuredDetail: { keyFeatures: unknown[]; specifications: unknown[] };
      media: unknown[];
    }>;
  };
  assert.equal(
    createHash("sha256").update(raw).digest("hex"),
    "aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309",
  );
  assert.equal(manifest.version, "production-launch-release-v1");
  assert.equal(manifest.operationKey, "production-launch-catalog-import-v1");
  assert.equal(manifest.candidateCount, 43);
  assert.equal(manifest.expectedFinalPublishedCount, 114);
  assert.equal(manifest.products.length, 43);
  assert.equal(new Set(manifest.products.map(({ id }) => id)).size, 43);
  assert.equal(new Set(manifest.products.map(({ sourceUid }) => sourceUid)).size, 43);
  assert.equal(new Set(manifest.products.map(({ slug }) => slug)).size, 43);
  assert.equal(manifest.products.reduce(
    (total, product) => total + product.structuredDetail.keyFeatures.length,
    0,
  ), 255);
  assert.equal(manifest.products.reduce(
    (total, product) => total + product.structuredDetail.specifications.length,
    0,
  ), 294);
  assert.equal(manifest.products.reduce(
    (total, product) => total + product.media.length,
    0,
  ), 155);
});

test("migration exposes only a closed role-separated lifecycle contract", async () => {
  const source = await readFile(migrationPath, "utf8");
  assert.match(source, /production_launch_release_scope_v1/u);
  assert.match(source, /production_launch_release_assert_manifest_v1/u);
  assert.match(source, /production_launch_release_assert_corporate_reviewer_v1/u);
  assert.match(source, /auth\.uid\(\) is distinct from reviewer_id/u);
  assert.match(source, /auth\.role\(\) <> 'authenticated'/u);
  assert.match(source, /Production launch import requires service role/u);
  assert.match(source, /Product publication requires service role/u);
  assert.match(source, /Structured revision state is partial or duplicated/u);
  assert.match(source, /Structured publication state is partial or duplicated/u);
  assert.match(source, /Product revision state is partial or duplicated/u);
  assert.match(source, /already_complete/u);
  assert.match(source, /inserted_decisions <> 549/u);
  assert.match(source, /totalPublished', 114/u);
  assert.match(source, /grant execute on function cloud_api\.production_launch_release_review_products_v1\(text\)[\s\S]+to authenticated/u);
  assert.match(source, /grant execute on function cloud_api\.production_launch_release_publish_products_v1\(text\)[\s\S]+to service_role/u);
  assert.doesNotMatch(source, /grant execute on function cloud_api\.production_launch_release_import_v1\(jsonb, text\)[\s\S]+to anon/u);
});

test("server operation surface accepts no browser Product scope", async () => {
  const [manifestModule, runner, route, component] = await Promise.all([
    readFile(`${root}/lib/operations/production-launch-release-manifest.ts`, "utf8"),
    readFile(`${root}/lib/operations/production-launch-release-runner.ts`, "utf8"),
    readFile(`${root}/app/internal/operations/production-launch-release/route.ts`, "utf8"),
    readFile(`${root}/components/internal/ProductionLaunchReleaseExecution.tsx`, "utf8"),
  ]);
  assert.match(manifestModule, /^import "server-only";/u);
  assert.match(manifestModule, /Object\.keys\(record\)\.length === 3/u);
  assert.match(manifestModule, /products\.length !== 43/u);
  assert.match(runner, /^import "server-only";/u);
  assert.match(runner, /createProjectBoundSupabaseServerClient/u);
  assert.match(runner, /schema\("cloud_api"\)/u);
  assert.match(runner, /operation_count_drift/u);
  assert.doesNotMatch(runner, /p_product_id|productIds:/u);
  assert.match(route, /process\.env\.VERCEL_ENV !== "production"/u);
  assert.match(route, /readActiveTrustedReviewer/u);
  assert.match(route, /APPROVED_REVIEWER\.userId/u);
  assert.match(route, /APPROVED_REVIEWER\.email/u);
  assert.match(route, /same_origin_required/u);
  assert.match(route, /validateProductionLaunchOperationRequest/u);
  assert.match(component, /operationKey: OPERATION_KEY/u);
  assert.match(component, /manifestSha256: MANIFEST_SHA256/u);
  assert.doesNotMatch(component, /sourceUid|productId|SUPABASE_SERVICE_ROLE_KEY/u);
});

test("canonical production synthetic uses the lockfile playwright-core CLI", async () => {
  const [workflow, packageJson, lockfile] = await Promise.all([
    readFile(`${root}/.github/workflows/catalog-production-synthetic.yml`, "utf8"),
    readFile(`${root}/package.json`, "utf8").then(JSON.parse) as Promise<{
      devDependencies: Record<string, string>;
    }>,
    readFile(`${root}/package-lock.json`, "utf8"),
  ]);
  assert.equal(packageJson.devDependencies["playwright-core"], "1.61.0");
  assert.match(lockfile, /"node_modules\/playwright-core"[\s\S]+"version": "1\.61\.0"/u);
  assert.match(
    workflow,
    /npx --no-install playwright-core install --with-deps webkit/u,
  );
  assert.doesNotMatch(workflow, /npx playwright install/u);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/u);
});
