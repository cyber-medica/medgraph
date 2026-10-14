import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  auditRuntimePermissions,
  auditRuntimeState,
  createRuntimeInventory,
  normalizeRuntimePermissions,
  prepareRuntimeState,
  verifyRuntimeInventory,
} from "../../scripts/release/runtime-artifact-permissions.mjs";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const RuntimeCacheHandler = require("../../lib/runtime/next-runtime-cache-handler.cjs");

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
  ];
  for (const path of directories) await mkdir(join(root, path), { recursive: true, mode: 0o700 });
  const files = new Map([
    [".next/BUILD_ID", "build-id\n"],
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
    ["node_modules/next/dist/bin/next", "#!/usr/bin/env node\n"],
    ["data/published-catalog-last-known-good.json", "{\"capturedAt\":\"2026-01-01T00:00:00.000Z\",\"projectionVersion\":1,\"projectionChecksum\":\"fixture\",\"projection\":{\"products\":[]}}\n"],
  ]);
  for (const [path, content] of files) {
    await writeFile(join(root, path), content, { mode: path.endsWith("/next") ? 0o700 : 0o600 });
    await chmod(join(root, path), path.endsWith("/next") ? 0o700 : 0o600);
  }
  await symlink("../next/dist/bin/next", join(root, "node_modules/.bin/next"));
  return root;
}

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

test("custom handler reads immutable seed and writes ISR state only outside the release", async (t) => {
  const root = await fixture();
  const stateRoot = await mkdtemp(join(tmpdir(), "cybermedica-next-cache-handler-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(stateRoot, { recursive: true, force: true }));
  await normalizeRuntimePermissions(root);
  await prepareRuntimeState(root, stateRoot);
  const immutableBefore = createHash("sha256")
    .update(await readFile(join(root, ".next/server/app/index.html")))
    .digest("hex");
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
    segmentData: undefined,
  }, context);
  const runtime = await handler.get("/index", context);
  assert.match(String(runtime?.value?.html), /runtime/u);
  assert.equal(
    createHash("sha256").update(await readFile(join(root, ".next/server/app/index.html"))).digest("hex"),
    immutableBefore,
  );
});

test("custom handler stores optimized images in external state with no in-release cache", async (t) => {
  const root = await fixture();
  const stateRoot = await mkdtemp(join(tmpdir(), "cybermedica-next-image-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(stateRoot, { recursive: true, force: true }));
  await normalizeRuntimePermissions(root);
  await prepareRuntimeState(root, stateRoot);
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
  await assert.rejects(() => lstat(join(root, ".next/cache/images")), /ENOENT/u);
});

test("custom handler is a no-op for middleware contexts without a Node server directory", async () => {
  const handler = new RuntimeCacheHandler({ revalidatedTags: [], _requestHeaders: {} });
  assert.equal(await handler.get("middleware-key", { kind: "FETCH" }), null);
  await handler.set("middleware-key", { kind: "FETCH" }, { kind: "FETCH" });
  await handler.revalidateTag("middleware-tag");
  handler.resetRequestCache();
});

test("CI blocks release regressions with the real cybermedica-web principal", async () => {
  const workflow = await readFile(
    join(process.cwd(), ".github/workflows/catalog-reliability-gate.yml"),
    "utf8",
  );
  assert.match(workflow, /service_user="cybermedica-web"/u);
  assert.match(workflow, /sudo useradd[\s\S]*"\$service_user"/u);
  assert.match(workflow, /--exclude='\.env\*'/u);
  assert.match(workflow, /service-audit[\s\S]*--user "\$service_user"/u);
  assert.match(workflow, /sudo -u "\$service_user" env/u);
  assert.match(workflow, /CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT="\$state_root"/u);
  assert.match(workflow, /HOME_HTTP=\$\{home_http\}/u);
  assert.match(workflow, /CATALOG_HTTP=\$\{catalog_http\}/u);
  assert.match(workflow, /HAMILTON_HTTP=\$\{hamilton_http\}/u);
  assert.match(workflow, /FETCH_CACHE_WRITE=PASS/u);
  assert.match(workflow, /IMAGE_CACHE_WRITE=PASS/u);
  assert.match(workflow, /ISR_RUNTIME_WRITE=PASS/u);
  assert.match(workflow, /Unexpected EACCES in named-user server log/u);
  assert.match(workflow, /verifyRuntimeInventory/u);
  assert.match(workflow, /IMMUTABLE_FILES_CHANGED=0/u);
  assert.match(workflow, /WORLD_WRITABLE_PATHS=0/u);
  assert.match(workflow, /NAMED_USER_RUNTIME_GATE=PASS/u);
});
