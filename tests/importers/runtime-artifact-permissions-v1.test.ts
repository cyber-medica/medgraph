import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  applyProductionArtifactContract,
  auditProductionArtifactContract,
  auditRuntimePermissions,
  auditRuntimeState,
  createRuntimeInventory,
  MAX_EMAIL_DOMAIN_LENGTH,
  MAX_EMAIL_LOCAL_LENGTH,
  MAX_SCANNED_FILE_SIZE_BYTES,
  normalizeRuntimePermissions,
  prepareRuntimeState,
  scanEmailCandidates,
  verifyRuntimeInventory,
} from "../../scripts/release/runtime-artifact-permissions.mjs";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const RuntimeCacheHandler = require("../../lib/runtime/next-runtime-cache-handler.cjs");
const fixtureReleaseSha = "a".repeat(40);
const removedPersonLinkedEmailHash = "df676f6364888f91b6bd84aa90dfbceef3503cae5a3ae0fc6a373449b98891a1";

function normalizedHash(value: string) {
  return createHash("sha256").update(value.toLowerCase()).digest("hex");
}

async function historicalRemovedEmail() {
  const historicalMigration = await readFile(
    "supabase/migrations/202608110001_production_launch_release_v1.sql",
    "utf8",
  );
  const candidates: string[] = [];
  scanEmailCandidates(historicalMigration, (candidate) => candidates.push(candidate));
  const identity = candidates.find((candidate) => normalizedHash(candidate) === removedPersonLinkedEmailHash);
  assert.ok(identity, "historical fixture must still contain the removed person-linked identity");
  return identity;
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cybermedica-runtime-permissions-"));
  const directories = [
    ".next/server/app",
    ".next/static/chunks",
    "public",
    "node_modules/next/dist/bin",
    "node_modules/.bin",
    "data",
    "lib/runtime",
    "infra/systemd/cybermedica-web.service.d",
    "scripts/qa",
    "scripts/release",
    "supabase/migrations",
    "tests/importers",
    "docs/reports",
  ];
  for (const path of directories) await mkdir(join(root, path), { recursive: true, mode: 0o700 });
  const files = new Map([
    [".next/BUILD_ID", "build-id\n"],
    [".next/routes-manifest.json", `${JSON.stringify({ headers: [{ source: "/(.*)", headers: [{ key: "X-CyberMedica-Release", value: fixtureReleaseSha }] }] })}\n`],
    [".next/server/app/page.js", "export default {};\n"],
    [".next/server/app/index.html", "<main>seed</main>\n"],
    [".next/server/app/index.meta", "{\"headers\":{},\"status\":200}\n"],
    [".next/server/app/index.rsc", "seed-rsc\n"],
    [".next/static/chunks/app.js", "console.log('fixture');\n"],
    ["public/robots.txt", "User-agent: *\n"],
    ["package.json", "{\"dependencies\":{\"next\":\"16.3.6\"}}\n"],
    ["package-lock.json", "{}\n"],
    ["next.config.ts", "export default {};\n"],
    ["lib/runtime/next-runtime-cache-handler.cjs", "module.exports = class FixtureCacheHandler {};\n"],
    ["infra/systemd/cybermedica-web.service.d/20-next-runtime-state.conf", "[Service]\nProtectSystem=strict\nReadWritePaths=\nReadWritePaths=/var/lib/cybermedica-web/next-runtime\n"],
    ["scripts/release/cutover-readiness.sh", "#!/bin/sh\nexit 0\n"],
    ["scripts/release/runtime-artifact-permissions.mjs", "export {};\n"],
    ["scripts/release/systemd-runtime-state-policy.mjs", "export {};\n"],
    ["scripts/release/systemd-runtime-state-probe.mjs", "export {};\n"],
    ["scripts/release/systemd-runtime-state-sandbox.sh", "#!/bin/sh\nexit 0\n"],
    ["scripts/qa/canonical-routing-gate.ts", "export const fixture = true;\n"],
    ["scripts/qa/product-publication-local-integration.ts", "throw new Error('CI only');\n"],
    ["supabase/migrations/202608030001_catalog_admin_characteristics_patch_v1.sql", "-- source-only migration\n"],
    ["supabase/migrations/202608110001_production_launch_release_v1.sql", "-- source-only migration\n"],
    ["tests/importers/source-only.test.ts", "export {};\n"],
    ["docs/reports/source-only.md", "# Source only\n"],
    ["node_modules/next/dist/bin/next", "#!/usr/bin/env node\n"],
    ["data/published-catalog-last-known-good.json", "{\"capturedAt\":\"2026-01-01T00:00:00.000Z\",\"projectionVersion\":1,\"projectionChecksum\":\"fixture\",\"projection\":{\"products\":[]}}\n"],
  ]);
  for (const [path, content] of files) {
    const executable = path.endsWith("/next") || path.endsWith(".sh");
    await writeFile(join(root, path), content, { mode: executable ? 0o700 : 0o600 });
    await chmod(join(root, path), executable ? 0o700 : 0o600);
  }
  await symlink("../next/dist/bin/next", join(root, "node_modules/.bin/next"));
  return root;
}

test("production artifact contract removes repository source trees and preserves deploy requirements", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await applyProductionArtifactContract(root);
  assert.equal(result.pass, true);
  assert.equal((await auditProductionArtifactContract(root)).pass, true);
  await assert.rejects(() => lstat(join(root, "supabase/migrations")), /ENOENT/u);
  await assert.rejects(() => lstat(join(root, "tests")), /ENOENT/u);
  await assert.rejects(() => lstat(join(root, "docs")), /ENOENT/u);
  await assert.rejects(
    () => lstat(join(root, "scripts/qa/product-publication-local-integration.ts")),
    /ENOENT/u,
  );
  assert.equal((await readFile(join(root, ".next/BUILD_ID"), "utf8")).trim(), "build-id");
  assert.match(
    await readFile(join(root, ".next/routes-manifest.json"), "utf8"),
    new RegExp(fixtureReleaseSha, "u"),
  );
  assert.match(
    await readFile(join(root, "scripts/release/cutover-readiness.sh"), "utf8"),
    /exit 0/u,
  );
  assert.match(
    await readFile(join(root, "scripts/qa/canonical-routing-gate.ts"), "utf8"),
    /fixture/u,
  );
  assert.match(
    await readFile(join(root, "lib/runtime/next-runtime-cache-handler.cjs"), "utf8"),
    /FixtureCacheHandler/u,
  );
  assert.match(
    await readFile(
      join(root, "infra/systemd/cybermedica-web.service.d/20-next-runtime-state.conf"),
      "utf8",
    ),
    /\/var\/lib\/cybermedica-web\/next-runtime/u,
  );
});

test("artifact privacy gate still rejects a removed runtime identity in an allowed deployable file", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const historicalMigration = await readFile(
    "supabase/migrations/202608110001_production_launch_release_v1.sql",
    "utf8",
  );
  await writeFile(join(root, "scripts/qa/canonical-routing-gate.ts"), historicalMigration, { mode: 0o600 });
  await applyProductionArtifactContract(root);
  await assert.rejects(() => normalizeRuntimePermissions(root), /forbidden sensitive material/u);
});

async function assertPersonLinkedIdentityRejected(content: string) {
  const root = await fixture();
  try {
    await writeFile(join(root, "scripts/qa/canonical-routing-gate.ts"), content, { mode: 0o600 });
    await applyProductionArtifactContract(root);
    await assert.rejects(
      () => normalizeRuntimePermissions(root),
      /person_linked_email/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("bounded email scanner preserves removed identity detection across artifact positions", async (t) => {
  const identity = await historicalRemovedEmail();
  const mixedCaseIdentity = [...identity]
    .map((character, index) => index % 2 === 0 ? character.toUpperCase() : character.toLowerCase())
    .join("");
  const variants = new Map([
    ["beginning", `${identity};${"x".repeat(256)}`],
    ["middle", `${"x;".repeat(128)}${identity}${";x".repeat(128)}`],
    ["end", `${"x;".repeat(256)}${identity}`],
    ["punctuation", `const owner = (\"${identity}\");`],
    ["mixed-case", `const owner = '${mixedCaseIdentity}';`],
  ]);

  for (const [name, content] of variants) {
    await t.test(name, async () => assertPersonLinkedIdentityRejected(content));
  }
});

test("bounded email scanner completes linearly on a 6.3 MB minified artifact", { timeout: 30_000 }, async (t) => {
  const content = "a".repeat(6_300_000);
  const stats = scanEmailCandidates(content);
  assert.equal(stats.bytesExamined, 6_300_000);
  assert.equal(stats.atSignsExamined, 0);
  assert.equal(stats.candidateWindowsExamined, 0);
  assert.equal(stats.candidatesFound, 0);

  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "scripts/qa/canonical-routing-gate.ts"), content, { mode: 0o600 });
  await applyProductionArtifactContract(root);
  await normalizeRuntimePermissions(root);
});

test("bounded email scanner limits adversarial allowed-character windows around at signs", { timeout: 30_000 }, () => {
  const content = `${"a".repeat(3_949_000)}@!x@${"b".repeat(3_949_000)}`;
  const stats = scanEmailCandidates(content);
  assert.equal(stats.bytesExamined, 7_898_004);
  assert.equal(stats.atSignsExamined, 2);
  assert.equal(stats.candidateWindowsExamined, stats.atSignsExamined);
  assert.equal(stats.candidatesFound, 0);
  assert.ok(
    stats.candidateCodeUnitsExamined
      <= stats.atSignsExamined * (MAX_EMAIL_LOCAL_LENGTH + MAX_EMAIL_DOMAIN_LENGTH + 2),
  );
});

test("bounded email scanner remains linear with many at signs", { timeout: 30_000 }, () => {
  const content = "a@".repeat(1_000_000);
  const stats = scanEmailCandidates(content);
  assert.equal(stats.bytesExamined, 2_000_000);
  assert.equal(stats.atSignsExamined, 1_000_000);
  assert.equal(stats.candidateWindowsExamined, stats.atSignsExamined);
  assert.equal(stats.candidatesFound, 0);
  assert.ok(
    stats.candidateCodeUnitsExamined
      <= stats.atSignsExamined * (MAX_EMAIL_LOCAL_LENGTH + MAX_EMAIL_DOMAIN_LENGTH + 2),
  );
});

test("privacy gate rejects a removed identity near the end of a large minified artifact", { timeout: 30_000 }, async () => {
  const identity = await historicalRemovedEmail();
  const content = `${"a;".repeat(3_149_000)}\"${identity}\"`;
  const candidates: string[] = [];
  const stats = scanEmailCandidates(content, (candidate) => candidates.push(candidate));
  assert.equal(stats.bytesExamined, Buffer.byteLength(content, "utf8"));
  assert.equal(stats.atSignsExamined, 1);
  assert.equal(stats.candidateWindowsExamined, 1);
  assert.ok(candidates.some((candidate) => normalizedHash(candidate) === removedPersonLinkedEmailHash));
  await assertPersonLinkedIdentityRejected(content);
});

test("privacy scanner keeps the 8 MiB artifact file boundary", () => {
  assert.equal(MAX_SCANNED_FILE_SIZE_BYTES, 8 * 1024 * 1024);
});

test("bounded email scanner completes on the real napi wasm runtime artifact", { timeout: 30_000 }, async (t) => {
  const path = join(process.cwd(), "node_modules/@napi-rs/wasm-runtime/dist/fs.js");
  const details = await stat(path);
  assert.equal(details.size, 6_239_581);
  assert.ok(details.size < MAX_SCANNED_FILE_SIZE_BYTES);
  const content = await readFile(path, "utf8");
  const startedAt = process.hrtime.bigint();
  const stats = scanEmailCandidates(content);
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  assert.equal(stats.bytesExamined, details.size);
  assert.equal(stats.candidateWindowsExamined, stats.atSignsExamined);
  assert.ok(
    stats.candidateCodeUnitsExamined
      <= stats.atSignsExamined * (MAX_EMAIL_LOCAL_LENGTH + MAX_EMAIL_DOMAIN_LENGTH + 2),
  );
  assert.ok(durationMs < 30_000, `real artifact scan exceeded deadlock guard: ${durationMs}ms`);

  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const artifactPath = join(root, "node_modules/@napi-rs/wasm-runtime/dist/fs.js");
  await mkdir(join(root, "node_modules/@napi-rs/wasm-runtime/dist"), { recursive: true, mode: 0o700 });
  await writeFile(artifactPath, content, { mode: 0o600 });
  await applyProductionArtifactContract(root);
  const privacyGateStartedAt = process.hrtime.bigint();
  await normalizeRuntimePermissions(root);
  const privacyGateDurationMs = Number(process.hrtime.bigint() - privacyGateStartedAt) / 1_000_000;
  assert.ok(
    privacyGateDurationMs < 30_000,
    `real artifact privacy gate exceeded deadlock guard: ${privacyGateDurationMs}ms`,
  );
  t.diagnostic(JSON.stringify({
    realFileSize: details.size,
    durationMs,
    privacyGateDurationMs,
    ...stats,
  }));
});

test("historical identity-bearing migrations remain byte-for-byte unchanged", async () => {
  const expected = new Map([
    [
      "supabase/migrations/202608030001_catalog_admin_characteristics_patch_v1.sql",
      "e59e6c45b17f07612ee0029d61dcea9501f84b370d65f34e169fbebce3397479",
    ],
    [
      "supabase/migrations/202608110001_production_launch_release_v1.sql",
      "6143e71c390dff3b8f9c33fa2ffed74300433810cc5a52e67e0d20f0312534e5",
    ],
  ]);
  for (const [path, hash] of expected) {
    assert.equal(createHash("sha256").update(await readFile(path)).digest("hex"), hash);
  }
});

async function freezeFixture(root: string) {
  async function freeze(path: string) {
    const details = await lstat(path);
    if (details.isSymbolicLink()) return;
    if (details.isDirectory()) {
      for (const child of await readdir(path)) await freeze(join(path, child));
      await chmod(path, 0o555);
      return;
    }
    await chmod(path, 0o444);
  }
  await freeze(root);
}

async function findWorldWritableRealEntries(root: string) {
  const matches: Array<{ path: string; type: string; mode: number }> = [];

  async function inspect(path: string, relativePath: string) {
    const details = await lstat(path);
    if (details.isSymbolicLink()) return;
    if ((details.mode & 0o002) !== 0) {
      matches.push({
        path: relativePath,
        type: details.isFile() ? "file" : details.isDirectory() ? "directory" : "other",
        mode: details.mode & 0o777,
      });
    }
    if (!details.isDirectory()) return;
    for (const child of await readdir(path)) {
      await inspect(join(path, child), relativePath === "." ? child : join(relativePath, child));
    }
  }

  await inspect(root, ".");
  return matches;
}

test("restrictive build umask is rejected before immutable packaging", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const report = await auditRuntimePermissions(root);
  assert.equal(report.pass, false);
  assert.ok(report.unexpected0600Files.includes(".next/BUILD_ID"));
  assert.ok(report.unexpected0700Directories.includes(".next"));
  assert.ok(report.unreadableFiles.length > 0);
  assert.ok(report.untraversableDirectories.length > 0);
});

test("normalization creates a readable, traversable, non-writable runtime tree", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await normalizeRuntimePermissions(root);
  const report = await auditRuntimePermissions(root, { checkCurrentPrincipal: true });
  assert.equal(report.pass, true);
  assert.equal((await lstat(join(root, ".next/BUILD_ID"))).mode & 0o777, 0o644);
  assert.equal((await lstat(join(root, ".next"))).mode & 0o777, 0o755);
  assert.equal((await lstat(join(root, "node_modules/next/dist/bin/next"))).mode & 0o777, 0o755);
  assert.equal(report.unsafeWritableEntries.length, 0);
});

test("normalization refuses env files and private key material before chmod", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const envPath = join(root, ".env.production");
  await writeFile(envPath, "SUPABASE_SECRET_KEY=not-a-real-key\n", { mode: 0o600 });
  await assert.rejects(() => normalizeRuntimePermissions(root), /forbidden sensitive material/u);
  assert.equal((await lstat(envPath)).mode & 0o777, 0o600);
});

test("recursive inventory detects any post-manifest byte or mode drift", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await normalizeRuntimePermissions(root);
  const inventory = await createRuntimeInventory(root);
  assert.equal((await verifyRuntimeInventory(root, inventory)).pass, true);
  await writeFile(join(root, ".next/BUILD_ID"), "changed-build-id\n", { mode: 0o644 });
  assert.equal((await verifyRuntimeInventory(root, inventory)).pass, false);
});

test("archive extraction retains the corrected runtime permission policy", async (t) => {
  const root = await fixture();
  const extraction = await mkdtemp(join(tmpdir(), "cybermedica-runtime-extraction-"));
  const archive = join(extraction, "runtime.tar.gz");
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(extraction, { recursive: true, force: true }));
  await normalizeRuntimePermissions(root);
  await execFileAsync("tar", ["-czf", archive, "-C", root, "."]);
  const extracted = join(extraction, "extracted");
  await mkdir(extracted);
  await execFileAsync("tar", ["-xzf", archive, "-C", extracted]);
  const report = await auditRuntimePermissions(extracted);
  assert.equal(report.pass, true);
  assert.equal((await readFile(join(extracted, ".next/BUILD_ID"), "utf8")).trim(), "build-id");
});

test("immutable packager preserves one release root and removes build-only Next docs", async (t) => {
  const { stdout: tarVersion } = await execFileAsync("tar", ["--version"]);
  if (!tarVersion.includes("GNU tar")) {
    t.skip("GNU tar is required for immutable packaging; exercised on the Linux build host.");
    return;
  }
  const root = await fixture();
  const output = await mkdtemp(join(tmpdir(), "cybermedica-runtime-package-"));
  const docsPath = join(root, "node_modules/next/dist/docs/private-key-example.md");
  const archive = join(output, "runtime.tar.gz");
  const manifest = join(output, "runtime.manifest.json");
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(output, { recursive: true, force: true }));
  await mkdir(join(root, "node_modules/next/dist/docs"), { recursive: true, mode: 0o700 });
  await writeFile(docsPath, "-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----\n", { mode: 0o600 });

  const script = join(process.cwd(), "scripts/release/runtime-artifact-permissions.mjs");
  const { stdout } = await execFileAsync(process.execPath, [
    script,
    "package",
    "--root",
    root,
    "--archive",
    archive,
    "--manifest",
    manifest,
    "--target-sha",
    "a".repeat(40),
    "--tree-sha",
    "b".repeat(40),
    "--build-timestamp",
    "2026-10-13T00:00:00Z",
    "--deployment-id",
    "runtime-permissions-fixture",
  ]);
  const result = JSON.parse(stdout);
  const { stdout: listing } = await execFileAsync("tar", ["-tzf", archive]);
  const rootName = basename(root);
  assert.equal(result.permissionAudit.pass, true);
  assert.match(listing, new RegExp(`^${rootName}/`, "mu"));
  assert.doesNotMatch(listing, /node_modules\/next\/dist\/docs/u);
  assert.doesNotMatch(listing, /supabase\/migrations/u);
  assert.doesNotMatch(listing, /202608030001_catalog_admin_characteristics_patch_v1\.sql/u);
  assert.doesNotMatch(listing, /202608110001_production_launch_release_v1\.sql/u);
  assert.doesNotMatch(listing, /tests\/importers/u);
  assert.doesNotMatch(listing, /docs\/reports/u);
  assert.doesNotMatch(listing, /product-publication-local-integration\.ts/u);
  assert.match(listing, /scripts\/release\/cutover-readiness\.sh/u);
  assert.match(listing, /scripts\/qa\/canonical-routing-gate\.ts/u);
  assert.match(listing, /lib\/runtime\/next-runtime-cache-handler\.cjs/u);
  assert.match(listing, /20-next-runtime-state\.conf/u);
  assert.equal(result.artifactContract.pass, true);
  assert.equal((await lstat(archive)).mode & 0o777, 0o444);
  assert.equal((await lstat(manifest)).mode & 0o777, 0o444);
});

test("external runtime state is build-scoped and the immutable release remains non-writable", async (t) => {
  const root = await fixture();
  const stateRoot = await mkdtemp(join(tmpdir(), "cybermedica-next-runtime-state-"));
  t.after(async () => {
    await execFileAsync("chmod", ["-R", "u+w", root]);
    await rm(root, { recursive: true, force: true });
  });
  t.after(() => rm(stateRoot, { recursive: true, force: true }));
  await normalizeRuntimePermissions(root);
  const state = await prepareRuntimeState(root, stateRoot);
  await freezeFixture(root);
  assert.equal(state.buildId, "build-id");
  const report = await auditRuntimeState(root, stateRoot, { checkCurrentPrincipal: true });
  assert.equal(report.pass, true);
  assert.equal(report.requiredWritablePathsExist, true);
  assert.equal(report.serviceUserCanWriteRequiredPaths, true);
  assert.equal(report.serviceUserCannotWriteImmutablePaths, true);
  assert.deepEqual(report.worldWritablePaths, []);
  assert.deepEqual(report.unexpectedWritablePaths, []);
});

test("custom handler reads immutable seed and writes APP_PAGE state only outside the release", async (t) => {
  const root = await fixture();
  const stateRoot = await mkdtemp(join(tmpdir(), "cybermedica-next-cache-handler-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(stateRoot, { recursive: true, force: true }));
  await normalizeRuntimePermissions(root);
  const state = await prepareRuntimeState(root, stateRoot);
  const immutableBefore = await createRuntimeInventory(root);
  const previousStateRoot = process.env.CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT;
  const previousPhase = process.env.NEXT_PHASE;
  process.env.CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT = stateRoot;
  process.env.NEXT_PHASE = "phase-production-server";
  t.after(() => {
    if (previousStateRoot === undefined) delete process.env.CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT;
    else process.env.CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT = previousStateRoot;
    if (previousPhase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = previousPhase;
  });

  const cacheFs = {
    existsSync: (await import("node:fs")).existsSync,
    readFile,
    readFileSync: (await import("node:fs")).readFileSync,
    writeFile: async (path: string, data: string | Buffer) => { await writeFile(path, data); },
    mkdir: async (path: string) => mkdir(path, { recursive: true }),
    stat: async (path: string) => lstat(path),
  };
  const handler = new RuntimeCacheHandler({
    fs: cacheFs,
    flushToDisk: true,
    serverDistDir: join(root, ".next/server"),
    maxMemoryCacheSize: 0,
    revalidatedTags: [],
    _requestHeaders: {},
  });
  const context = { kind: "APP_PAGE", isFallback: false, isRoutePPREnabled: false };
  const seed = await handler.get("/index", context);
  assert.equal(seed?.value?.kind, "APP_PAGE");
  assert.match(String(seed?.value?.html), /seed/u);
  await handler.set("/index", {
    kind: "APP_PAGE",
    html: "<main>runtime</main>\n",
    rscData: Buffer.from("runtime-rsc\n"),
    headers: {},
    postponed: undefined,
    status: 200,
    segmentData: new Map([
      ["/_tree", Buffer.from("runtime-tree-segment\n")],
    ]),
  }, context);
  const runtime = await handler.get("/index", context);
  assert.match(String(runtime?.value?.html), /runtime/u);
  assert.equal(runtime?.value?.rscData?.toString("utf8"), "runtime-rsc\n");
  assert.equal(runtime?.value?.segmentData?.get("/_tree")?.toString("utf8"), "runtime-tree-segment\n");

  const externalAppRoot = join(state.path, "server/app");
  assert.equal(await readFile(join(externalAppRoot, "index.html"), "utf8"), "<main>runtime</main>\n");
  assert.equal(await readFile(join(externalAppRoot, "index.rsc"), "utf8"), "runtime-rsc\n");
  const metadata = JSON.parse(await readFile(join(externalAppRoot, "index.meta"), "utf8"));
  assert.deepEqual(metadata.segmentPaths, ["/_tree"]);
  assert.equal(
    await readFile(join(externalAppRoot, "index.segments/_tree.segment.rsc"), "utf8"),
    "runtime-tree-segment\n",
  );
  assert.equal((await verifyRuntimeInventory(root, immutableBefore)).pass, true);
});

test("custom handler stores optimized images in external state with no in-release cache", async (t) => {
  const root = await fixture();
  const stateRoot = await mkdtemp(join(tmpdir(), "cybermedica-next-image-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(stateRoot, { recursive: true, force: true }));
  await normalizeRuntimePermissions(root);
  const state = await prepareRuntimeState(root, stateRoot);
  const immutableBefore = await createRuntimeInventory(root);
  const previousStateRoot = process.env.CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT;
  const previousPhase = process.env.NEXT_PHASE;
  process.env.CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT = stateRoot;
  process.env.NEXT_PHASE = "phase-production-server";
  t.after(() => {
    if (previousStateRoot === undefined) delete process.env.CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT;
    else process.env.CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT = previousStateRoot;
    if (previousPhase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = previousPhase;
  });
  const cacheFs = {
    existsSync: (await import("node:fs")).existsSync,
    readFile,
    readFileSync: (await import("node:fs")).readFileSync,
    writeFile: async (path: string, data: string | Buffer) => { await writeFile(path, data); },
    mkdir: async (path: string) => mkdir(path, { recursive: true }),
    stat: async (path: string) => lstat(path),
  };
  const handler = new RuntimeCacheHandler({
    fs: cacheFs,
    flushToDisk: true,
    serverDistDir: join(root, ".next/server"),
    maxMemoryCacheSize: 0,
    revalidatedTags: [],
    _requestHeaders: {},
  });
  await handler.set("image-key", {
    kind: "IMAGE",
    etag: "etag",
    upstreamEtag: "upstream-etag",
    extension: "webp",
    revalidate: 60,
    buffer: Buffer.from("image-bytes"),
  }, { kind: "IMAGE" });
  const entry = await handler.get("image-key", { kind: "IMAGE" });
  assert.equal(entry?.value?.buffer.toString("utf8"), "image-bytes");
  const imageDigest = createHash("sha256").update("image-key").digest("hex");
  const imageRoot = join(state.path, "images-v1", imageDigest);
  const metadata = JSON.parse(await readFile(join(imageRoot, "metadata.json"), "utf8"));
  assert.equal(metadata.kind, "IMAGE");
  assert.equal(await readFile(join(imageRoot, "payload.bin"), "utf8"), "image-bytes");
  await assert.rejects(() => lstat(join(root, ".next/cache/images")), /ENOENT/u);
  assert.equal((await verifyRuntimeInventory(root, immutableBefore)).pass, true);
});

test("custom handler is a no-op for middleware contexts without a Node server directory", async () => {
  const handler = new RuntimeCacheHandler({ revalidatedTags: [], _requestHeaders: {} });
  assert.equal(await handler.get("middleware-key", { kind: "FETCH" }), null);
  await handler.set("middleware-key", { kind: "FETCH" }, { kind: "FETCH" });
  await handler.revalidateTag("middleware-tag");
  handler.resetRequestCache();
});

test("world-writable mode gate ignores safe symlink metadata", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "cybermedica-world-writable-symlink-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "target"), "safe\n", { mode: 0o644 });
  await symlink("target", join(root, "safe-link"));
  assert.deepEqual(await findWorldWritableRealEntries(root), []);
});

test("world-writable mode gate blocks a regular file", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "cybermedica-world-writable-file-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "unsafe.txt");
  await writeFile(path, "unsafe\n", { mode: 0o644 });
  await chmod(path, 0o646);
  assert.deepEqual(await findWorldWritableRealEntries(root), [
    { path: "unsafe.txt", type: "file", mode: 0o646 },
  ]);
});

test("world-writable mode gate blocks a directory", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "cybermedica-world-writable-directory-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "unsafe-directory");
  await mkdir(path, { mode: 0o755 });
  await chmod(path, 0o757);
  assert.deepEqual(await findWorldWritableRealEntries(root), [
    { path: "unsafe-directory", type: "directory", mode: 0o757 },
  ]);
});

test("service-audit permission contract still rejects an escaping symlink", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await normalizeRuntimePermissions(root);
  await symlink("../../../outside-runtime", join(root, "node_modules/.bin/escape"));
  const report = await auditRuntimePermissions(root);
  assert.equal(report.pass, false);
  assert.deepEqual(report.invalidSymlinks, [
    { path: "node_modules/.bin/escape", target: "../../../outside-runtime" },
  ]);
});

test("CI blocks release regressions with the real cybermedica-web principal", async () => {
  const workflow = await readFile(
    join(process.cwd(), ".github/workflows/catalog-reliability-gate.yml"),
    "utf8",
  );
  assert.match(workflow, /service_user="cybermedica-web"/u);
  assert.match(workflow, /sudo useradd[\s\S]*"\$service_user"/u);
  assert.match(workflow, /--exclude='\.env\*'/u);
  assert.match(workflow, /contract --root "\$release_root"/u);
  assert.match(workflow, /service-audit[\s\S]*--user "\$service_user"/u);
  assert.match(workflow, /sudo -u "\$service_user" env/u);
  assert.match(workflow, /CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT="\$state_root"/u);
  assert.match(workflow, /HOME_HTTP=\$\{home_http\}/u);
  assert.match(workflow, /CATALOG_HTTP=\$\{catalog_http\}/u);
  assert.match(workflow, /HAMILTON_HTTP=\$\{hamilton_http\}/u);
  assert.match(workflow, /FIRST_STARTUP_SMOKE=PASS/u);
  assert.match(workflow, /CACHE_HANDLER_INIT=PASS/u);
  assert.match(workflow, /ENOENT=0/u);
  assert.match(workflow, /FETCH_CACHE_FILES_BEFORE=0/u);
  assert.match(workflow, /FETCH_CACHE_CREATED=YES/u);
  assert.match(workflow, /FETCH_CACHE_REVALIDATED=YES/u);
  assert.match(workflow, /FETCH_CACHE_WRITE=PASS/u);
  assert.match(workflow, /FETCH_CACHE_REVALIDATION=PASS/u);
  assert.match(workflow, /IMAGE_CACHE_METADATA_CREATED=YES/u);
  assert.match(workflow, /IMAGE_CACHE_PAYLOAD_CREATED=YES/u);
  assert.match(workflow, /IMAGE_CACHE_WRITE=PASS/u);
  assert.match(workflow, /APP_PAGE_HANDLER_HTML=PASS/u);
  assert.match(workflow, /APP_PAGE_HANDLER_RSC=PASS/u);
  assert.match(workflow, /APP_PAGE_HANDLER_META=PASS/u);
  assert.match(workflow, /APP_PAGE_HANDLER_SEGMENTS=PASS/u);
  assert.match(
    workflow,
    /revalidation_path="\/catalog\/767632362-330695211247-apparat-ivl-hamilton-t1"/u,
  );
  assert.doesNotMatch(workflow, /runtime_writes=/u);
  assert.doesNotMatch(workflow, /ISR_RUNTIME_WRITE=PASS/u);
  assert.doesNotMatch(workflow, /sudo find "\$build_state\/server\/app"/u);
  assert.doesNotMatch(
    workflow,
    /sleep 65\s+curl --fail --silent "http:\/\/127\.0\.0\.1:\$\{port\}\/"/u,
  );
  assert.match(workflow, /Unexpected EACCES in named-user server log/u);
  assert.match(workflow, /Unexpected MODULE_NOT_FOUND in named-user server log/u);
  assert.match(workflow, /MODULE_NOT_FOUND=0/u);
  assert.match(workflow, /verifyRuntimeInventory/u);
  assert.match(workflow, /IMMUTABLE_FILES_CHANGED=0/u);
  assert.match(
    workflow,
    /find "\$release_root" "\$build_state"[\s\\]*! -type l[\s\\]*-perm -0002/u,
  );
  assert.match(
    workflow,
    /WORLD_WRITABLE_ENTRY\\tpath=%p\\ttype=%y\\tmode=0%m\\towner=%u:%g/u,
  );
  assert.doesNotMatch(
    workflow,
    /find "\$release_root" "\$build_state" -perm -0002 -print -quit/u,
  );
  assert.match(workflow, /WORLD_WRITABLE_PATHS=0/u);
  assert.match(workflow, /NAMED_USER_RUNTIME_GATE=PASS/u);
  assert.match(workflow, /NAMED_USER_GATE=PASS/u);
});
