import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  auditRuntimePermissions,
  createRuntimeInventory,
  normalizeRuntimePermissions,
  verifyRuntimeInventory,
} from "../../scripts/release/runtime-artifact-permissions.mjs";

const execFileAsync = promisify(execFile);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cybermedica-runtime-permissions-"));
  const directories = [
    ".next/server/app",
    ".next/static/chunks",
    "public",
    "node_modules/next/dist/bin",
    "node_modules/.bin",
    "data",
  ];
  for (const path of directories) await mkdir(join(root, path), { recursive: true, mode: 0o700 });
  const files = new Map([
    [".next/BUILD_ID", "build-id\n"],
    [".next/server/app/page.js", "export default {};\n"],
    [".next/static/chunks/app.js", "console.log('fixture');\n"],
    ["public/robots.txt", "User-agent: *\n"],
    ["package.json", "{\"dependencies\":{\"next\":\"16.3.6\"}}\n"],
    ["package-lock.json", "{}\n"],
    ["next.config.ts", "export default {};\n"],
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
