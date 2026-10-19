import { createHash } from "node:crypto";
import {
  constants as fsConstants,
  access,
  chown,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { verifyBuiltReleaseHeader } from "./release-provenance.mjs";

export const RUNTIME_DIRECTORY_MODE = 0o755;
export const RUNTIME_FILE_MODE = 0o644;
export const RUNTIME_EXECUTABLE_MODE = 0o755;
export const RUNTIME_STATE_DIRECTORY_MODE = 0o750;
export const RUNTIME_STATE_FILE_MODE = 0o640;
export const DEFAULT_RUNTIME_STATE_ROOT = "/var/lib/cybermedica-web/next-runtime";

export const REQUIRED_RUNTIME_PATHS = Object.freeze([
  { path: ".next", type: "directory" },
  { path: ".next/BUILD_ID", type: "file" },
  { path: ".next/server", type: "directory" },
  { path: ".next/static", type: "directory" },
  { path: "public", type: "directory" },
  { path: "package.json", type: "file" },
  { path: "package-lock.json", type: "file" },
  { path: "next.config.ts", type: "file" },
  { path: "lib/runtime/next-runtime-cache-handler.cjs", type: "file" },
  { path: "node_modules/next/dist/bin/next", type: "file" },
]);

const secretPathPatterns = Object.freeze([
  /(^|\/)\.env(?:\.|$)/u,
  /(^|\/)(?:id_(?:rsa|dsa|ecdsa|ed25519)|authorized_keys|known_hosts)$/u,
  /\.(?:pem|p12|pfx|key)$/u,
]);
const privateKeyPattern = /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/u;
const secretKeyPattern = /sb_secret_[A-Za-z0-9_-]{16,}/u;
const githubTokenPattern = /(?:github_pat_|gh[oprsu]_)[A-Za-z0-9_]{16,}/u;
const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu;
const buildOnlyPaths = Object.freeze([
  ".next/cache",
  ".next/diagnostics",
  "node_modules/next/dist/docs",
]);

function portablePath(path) {
  return path.split(sep).join("/");
}

function modeOf(stats) {
  return stats.mode & 0o777;
}

function isInside(root, target) {
  const relation = relative(root, target);
  return relation === "" || (!relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation));
}

function validatedBuildId(value) {
  const buildId = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(buildId)) throw new Error("Runtime BUILD_ID is invalid.");
  return buildId;
}

export async function runtimeStatePath(root, stateRoot = DEFAULT_RUNTIME_STATE_ROOT) {
  const absoluteStateRoot = resolve(stateRoot);
  if (!isAbsolute(stateRoot)) throw new Error("Runtime state root must be absolute.");
  const absoluteReleaseRoot = resolve(root);
  if (isInside(absoluteReleaseRoot, absoluteStateRoot) || isInside(absoluteStateRoot, absoluteReleaseRoot)) {
    throw new Error("Runtime state root must be outside the immutable release tree.");
  }
  const buildId = validatedBuildId(await readFile(join(absoluteReleaseRoot, ".next/BUILD_ID"), "utf8"));
  return { buildId, path: join(absoluteStateRoot, buildId), stateRoot: absoluteStateRoot };
}

export async function prepareRuntimeState(root, stateRoot = DEFAULT_RUNTIME_STATE_ROOT, owner = {}) {
  const state = await runtimeStatePath(root, stateRoot);
  await mkdir(state.stateRoot, { recursive: true, mode: RUNTIME_DIRECTORY_MODE });
  await chmod(state.stateRoot, RUNTIME_DIRECTORY_MODE);
  await mkdir(state.path, { recursive: true, mode: RUNTIME_STATE_DIRECTORY_MODE });
  await chmod(state.path, RUNTIME_STATE_DIRECTORY_MODE);
  if (Number.isInteger(owner.uid) && Number.isInteger(owner.gid)) {
    await chown(state.path, owner.uid, owner.gid);
  }
  return state;
}

export async function auditRuntimeState(root, stateRoot = DEFAULT_RUNTIME_STATE_ROOT, options = {}) {
  const { checkCurrentPrincipal = false } = options;
  const state = await runtimeStatePath(root, stateRoot);
  const report = {
    pass: false,
    requiredWritablePathsExist: false,
    serviceUserCanWriteRequiredPaths: false,
    serviceUserCannotWriteImmutablePaths: false,
    worldWritablePaths: /** @type {string[]} */ ([]),
    unexpectedWritablePaths: /** @type {string[]} */ ([]),
    statePath: state.path,
  };
  try {
    const details = await lstat(state.path);
    report.requiredWritablePathsExist = details.isDirectory()
      && !details.isSymbolicLink()
      && modeOf(details) === RUNTIME_STATE_DIRECTORY_MODE;
  } catch {
    return report;
  }

  const { entries } = await walk(state.path);
  for (const entry of entries) {
    const mode = modeOf(entry.details);
    if ((mode & 0o002) !== 0) report.worldWritablePaths.push(portablePath(entry.path));
    if ((mode & 0o020) !== 0) report.unexpectedWritablePaths.push(`state:${portablePath(entry.path)}`);
  }

  if (checkCurrentPrincipal) {
    try {
      await access(state.path, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK);
      const probe = join(state.path, `.release-gate-write-probe-${process.pid}`);
      await writeFile(probe, "runtime-state-write-probe\n", { mode: RUNTIME_STATE_FILE_MODE });
      await rm(probe, { force: true });
      report.serviceUserCanWriteRequiredPaths = true;
    } catch {
      report.serviceUserCanWriteRequiredPaths = false;
    }

    const immutable = await walk(root);
    const results = await Promise.all(immutable.entries.map(async (entry) => {
      if (entry.type === "symlink") return true;
      try {
        await access(entry.absolutePath, fsConstants.W_OK);
        report.unexpectedWritablePaths.push(`release:${portablePath(entry.path)}`);
        return false;
      } catch {
        return true;
      }
    }));
    report.serviceUserCannotWriteImmutablePaths = results.every(Boolean);
  }

  report.pass = report.requiredWritablePathsExist
    && (!checkCurrentPrincipal || (
      report.serviceUserCanWriteRequiredPaths
      && report.serviceUserCannotWriteImmutablePaths
    ))
    && report.worldWritablePaths.length === 0
    && report.unexpectedWritablePaths.length === 0;
  return report;
}

async function walk(root) {
  const absoluteRoot = resolve(root);
  const entries = [];

  async function visit(absolutePath, relativePath) {
    const details = await lstat(absolutePath);
    const type = details.isDirectory()
      ? "directory"
      : details.isFile()
        ? "file"
        : details.isSymbolicLink()
          ? "symlink"
          : "other";
    entries.push({
      absolutePath,
      path: relativePath || ".",
      details,
      type,
    });
    if (type !== "directory") return;
    const children = await readdir(absolutePath);
    children.sort((left, right) => left.localeCompare(right));
    for (const child of children) {
      await visit(join(absolutePath, child), relativePath ? join(relativePath, child) : child);
    }
  }

  await visit(absoluteRoot, "");
  return { absoluteRoot, entries };
}

async function validateSymlink(root, entry) {
  const link = await readlink(entry.absolutePath);
  if (isAbsolute(link)) return { valid: false, link };
  const target = resolve(dirname(entry.absolutePath), link);
  return { valid: isInside(root, target), link };
}

async function findSensitiveMaterial(entries) {
  const findings = [];
  for (const entry of entries) {
    if (entry.path === "." || entry.type === "directory" || entry.type === "symlink") continue;
    const path = portablePath(entry.path);
    if (secretPathPatterns.some((pattern) => pattern.test(path))) {
      findings.push({ path, reason: "forbidden_secret_path" });
      continue;
    }
    if (entry.type !== "file") continue;
    if (entry.details.size > 8 * 1024 * 1024) continue;
    const content = await readFile(entry.absolutePath);
    const text = content.toString("utf8");
    if (privateKeyPattern.test(text)) findings.push({ path, reason: "private_key_material" });
    if (secretKeyPattern.test(text)) findings.push({ path, reason: "supabase_secret_key_value" });
    if (githubTokenPattern.test(text)) findings.push({ path, reason: "github_token_value" });
    for (const candidate of text.match(jwtPattern) ?? []) {
      try {
        const payload = JSON.parse(Buffer.from(candidate.split(".")[1], "base64url").toString("utf8"));
        if (payload?.role === "service_role") {
          findings.push({ path, reason: "legacy_service_role_value" });
          break;
        }
      } catch {
        // Not every JWT-shaped public string is a valid token.
      }
    }
  }
  return findings;
}

export async function normalizeRuntimePermissions(root) {
  const { absoluteRoot, entries } = await walk(root);
  const sensitiveMaterial = await findSensitiveMaterial(entries);
  if (sensitiveMaterial.length > 0) {
    throw new Error(`Runtime artifact contains forbidden sensitive material: ${JSON.stringify(sensitiveMaterial)}`);
  }

  let files = 0;
  let directories = 0;
  let symlinks = 0;
  for (const entry of entries) {
    if (entry.type === "directory") {
      await chmod(entry.absolutePath, RUNTIME_DIRECTORY_MODE);
      directories += 1;
      continue;
    }
    if (entry.type === "file") {
      const executable = (modeOf(entry.details) & 0o111) !== 0;
      await chmod(entry.absolutePath, executable ? RUNTIME_EXECUTABLE_MODE : RUNTIME_FILE_MODE);
      files += 1;
      continue;
    }
    if (entry.type === "symlink") {
      const result = await validateSymlink(absoluteRoot, entry);
      if (!result.valid) throw new Error(`Runtime symlink escapes artifact root: ${entry.path}`);
      symlinks += 1;
      continue;
    }
    throw new Error(`Unsupported runtime artifact entry: ${entry.path}`);
  }

  return { files, directories, symlinks };
}

async function requiredPathFailures(root) {
  const failures = [];
  for (const requirement of REQUIRED_RUNTIME_PATHS) {
    const absolutePath = join(root, requirement.path);
    try {
      const details = await stat(absolutePath);
      const validType = requirement.type === "directory" ? details.isDirectory() : details.isFile();
      if (!validType) failures.push({ path: requirement.path, reason: `expected_${requirement.type}` });
      if (requirement.path === ".next/BUILD_ID") {
        const buildId = (await readFile(absolutePath, "utf8")).trim();
        if (!buildId) failures.push({ path: requirement.path, reason: "empty_build_id" });
      }
    } catch (error) {
      failures.push({
        path: requirement.path,
        reason: error && typeof error === "object" && "code" in error ? String(error.code) : "unavailable",
      });
    }
  }
  return failures;
}

export async function auditRuntimePermissions(root, options = {}) {
  const { checkCurrentPrincipal = false } = options;
  const { absoluteRoot, entries } = await walk(root);
  const report = {
    pass: false,
    totalRuntimeFiles: 0,
    totalRuntimeDirectories: 0,
    totalRuntimeSymlinks: 0,
    unreadableFiles: /** @type {string[]} */ ([]),
    untraversableDirectories: /** @type {string[]} */ ([]),
    unexpected0600Files: /** @type {string[]} */ ([]),
    unexpected0700Directories: /** @type {string[]} */ ([]),
    unexpectedModes: /** @type {Array<{ path: string; mode: string; expected: string }>} */ ([]),
    unsafeWritableEntries: /** @type {Array<{ path: string; mode: string }>} */ ([]),
    invalidSymlinks: /** @type {Array<{ path: string; target: string }>} */ ([]),
    requiredPathFailures: await requiredPathFailures(absoluteRoot),
    sensitiveMaterial: /** @type {Array<{ path: string; reason: string }>} */ ([]),
  };

  for (const entry of entries) {
    const path = portablePath(entry.path);
    const mode = modeOf(entry.details);
    if (entry.type === "directory") {
      report.totalRuntimeDirectories += 1;
      if (mode === 0o700) report.unexpected0700Directories.push(path);
      if ((mode & 0o001) === 0) report.untraversableDirectories.push(path);
      if (mode !== RUNTIME_DIRECTORY_MODE) report.unexpectedModes.push({ path, mode: mode.toString(8), expected: "755" });
      if ((mode & 0o022) !== 0) report.unsafeWritableEntries.push({ path, mode: mode.toString(8) });
      if (checkCurrentPrincipal) {
        try {
          await access(entry.absolutePath, fsConstants.X_OK);
        } catch {
          if (!report.untraversableDirectories.includes(path)) report.untraversableDirectories.push(path);
        }
      }
      continue;
    }
    if (entry.type === "file") {
      report.totalRuntimeFiles += 1;
      if (mode === 0o600) report.unexpected0600Files.push(path);
      if ((mode & 0o004) === 0) report.unreadableFiles.push(path);
      const expected = (mode & 0o111) !== 0 ? RUNTIME_EXECUTABLE_MODE : RUNTIME_FILE_MODE;
      if (mode !== expected) report.unexpectedModes.push({ path, mode: mode.toString(8), expected: expected.toString(8) });
      if ((mode & 0o022) !== 0) report.unsafeWritableEntries.push({ path, mode: mode.toString(8) });
      if (checkCurrentPrincipal) {
        try {
          await access(entry.absolutePath, fsConstants.R_OK);
        } catch {
          if (!report.unreadableFiles.includes(path)) report.unreadableFiles.push(path);
        }
      }
      continue;
    }
    if (entry.type === "symlink") {
      report.totalRuntimeSymlinks += 1;
      const result = await validateSymlink(absoluteRoot, entry);
      if (!result.valid) report.invalidSymlinks.push({ path, target: result.link });
      if (checkCurrentPrincipal) {
        try {
          await access(entry.absolutePath, fsConstants.R_OK);
        } catch {
          report.unreadableFiles.push(path);
        }
      }
      continue;
    }
    report.unexpectedModes.push({ path, mode: mode.toString(8), expected: "regular-entry" });
  }
  report.sensitiveMaterial = await findSensitiveMaterial(entries);
  report.pass = [
    report.unreadableFiles,
    report.untraversableDirectories,
    report.unexpected0600Files,
    report.unexpected0700Directories,
    report.unexpectedModes,
    report.unsafeWritableEntries,
    report.invalidSymlinks,
    report.requiredPathFailures,
    report.sensitiveMaterial,
  ].every((items) => items.length === 0);
  return report;
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function createRuntimeInventory(root) {
  const { entries } = await walk(root);
  const inventory = [];
  for (const entry of entries) {
    if (entry.path === "." || entry.type === "directory") continue;
    const path = portablePath(entry.path);
    if (entry.type === "file") {
      inventory.push({
        path,
        type: "file",
        mode: modeOf(entry.details).toString(8).padStart(4, "0"),
        size: entry.details.size,
        sha256: await sha256File(entry.absolutePath),
      });
    } else if (entry.type === "symlink") {
      const target = await readlink(entry.absolutePath);
      inventory.push({
        path,
        type: "symlink",
        mode: "0777",
        size: Buffer.byteLength(target),
        sha256: createHash("sha256").update(target).digest("hex"),
        target,
      });
    }
  }
  inventory.sort((left, right) => left.path.localeCompare(right.path));
  return inventory;
}

export async function verifyRuntimeInventory(root, inventory) {
  const actual = await createRuntimeInventory(root);
  const expectedJson = JSON.stringify(inventory);
  const actualJson = JSON.stringify(actual);
  return {
    pass: actualJson === expectedJson,
    expectedCount: inventory.length,
    actualCount: actual.length,
  };
}

function parseArguments(values) {
  const positional = [];
  const named = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) named.set(name, true);
    else {
      named.set(name, next);
      index += 1;
    }
  }
  return { positional, named };
}

function requireArgument(named, name) {
  const value = named.get(name);
  if (typeof value !== "string" || !value) throw new Error(`--${name} is required.`);
  return value;
}

function assertPass(report, label) {
  if (!report.pass) throw new Error(`${label} failed: ${JSON.stringify(report)}`);
}

async function serviceAudit(root, stateRoot, user) {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) {
    throw new Error("Service-user audit must be launched as root on the Linux build host.");
  }
  const scriptPath = fileURLToPath(import.meta.url);
  const serviceEnvironment = {
    HOME: tmpdir(),
    NODE_ENV: "production",
    PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
  };
  const result = spawnSync(
    "runuser",
    [
      "--user", user, "--", process.execPath, scriptPath, "principal-audit",
      "--root", resolve(root), "--state-root", resolve(stateRoot),
    ],
    { encoding: "utf8", env: serviceEnvironment },
  );
  if (result.status !== 0) {
    throw new Error(`Service-user audit failed: ${result.stderr || result.stdout}`);
  }
  const report = JSON.parse(result.stdout);
  const runtimeProbe = spawnSync(
    "runuser",
    [
      "--user",
      user,
      "--",
      process.execPath,
      "--input-type=module",
      "--eval",
      [
        "import { readFile } from 'node:fs/promises';",
        "import { createRequire } from 'node:module';",
        "import { join } from 'node:path';",
        "const root = process.argv[1];",
        "await readFile(join(root, '.next/BUILD_ID'), 'utf8');",
        "createRequire(join(root, 'package.json')).resolve('next');",
      ].join(""),
      resolve(root),
    ],
    { encoding: "utf8", env: serviceEnvironment },
  );
  report.serviceUserCanReadBuildId = runtimeProbe.status === 0;
  report.serviceUserCanLoadNextRuntime = runtimeProbe.status === 0;
  report.pass = report.pass && runtimeProbe.status === 0;
  if (runtimeProbe.status !== 0) report.runtimeProbeError = runtimeProbe.stderr || "runtime_probe_failed";
  return report;
}

function resolvePrincipal(name, flag) {
  const result = flag === "-u"
    ? spawnSync("id", ["-u", name], { encoding: "utf8" })
    : spawnSync("getent", ["group", name], { encoding: "utf8" });
  const rawValue = flag === "-u" ? result.stdout.trim() : result.stdout.split(":")[2];
  const value = Number.parseInt(rawValue, 10);
  if (result.status !== 0 || !Number.isInteger(value) || value < 0) {
    throw new Error(`Unable to resolve ${flag === "-u" ? "user" : "group"} ${name}.`);
  }
  return value;
}

async function packageArtifact(named) {
  const root = resolve(requireArgument(named, "root"));
  const archivePath = resolve(requireArgument(named, "archive"));
  const manifestPath = resolve(requireArgument(named, "manifest"));
  const targetSha = requireArgument(named, "target-sha");
  const treeSha = requireArgument(named, "tree-sha");
  const buildTimestamp = requireArgument(named, "build-timestamp");
  const deploymentId = requireArgument(named, "deployment-id");
  if (!/^[a-f0-9]{40}$/u.test(targetSha) || !/^[a-f0-9]{40}$/u.test(treeSha)) {
    throw new Error("Target and tree SHA values must be exact 40-character lowercase hex values.");
  }
  if (!Number.isFinite(Date.parse(buildTimestamp))) throw new Error("Build timestamp must be ISO-8601.");

  await verifyBuiltReleaseHeader(root, targetSha);

  for (const path of buildOnlyPaths) await rm(join(root, path), { recursive: true, force: true });
  await normalizeRuntimePermissions(root);
  const permissionAudit = await auditRuntimePermissions(root);
  assertPass(permissionAudit, "Pre-archive runtime permission gate");
  const inventory = await createRuntimeInventory(root);
  const buildId = validatedBuildId(await readFile(join(root, ".next/BUILD_ID"), "utf8"));
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const lkg = JSON.parse(await readFile(join(root, "data/published-catalog-last-known-good.json"), "utf8"));

  await mkdir(dirname(archivePath), { recursive: true });
  const tarVersion = spawnSync("tar", ["--version"], { encoding: "utf8" });
  if (tarVersion.status !== 0 || !tarVersion.stdout.includes("GNU tar")) {
    throw new Error("Immutable packaging requires GNU tar.");
  }
  const sourceDate = Math.floor(Date.parse(buildTimestamp) / 1000);
  const archive = spawnSync("tar", [
    "--sort=name",
    `--mtime=@${sourceDate}`,
    "--owner=0",
    "--group=0",
    "--numeric-owner",
    "-czf",
    archivePath,
    "-C",
    dirname(root),
    basename(root),
  ], { encoding: "utf8" });
  if (archive.status !== 0) throw new Error(`Archive creation failed: ${archive.stderr}`);

  const archiveSha256 = await sha256File(archivePath);
  const manifest = {
    schemaVersion: "cybermedica-runtime-artifact-v2",
    targetSha,
    treeSha,
    buildTimestamp,
    buildId,
    deploymentId,
    catalogDataSource: "cloud_published",
    runtime: {
      node: process.version,
      next: packageJson.dependencies?.next,
      packageLockSha256: await sha256File(join(root, "package-lock.json")),
      lkg: {
        capturedAt: lkg.capturedAt,
        projectionVersion: lkg.projectionVersion,
        projectionChecksum: lkg.projectionChecksum,
        productCount: lkg.projection?.products?.length,
      },
    },
    permissionPolicy: {
      directories: "0755",
      regularFiles: "0644",
      executables: "0755-only-if-source-executable",
      archiveOwner: "0:0",
      immutableReleaseWrites: "forbidden",
      externalRuntimeState: {
        defaultRoot: DEFAULT_RUNTIME_STATE_ROOT,
        buildScopedDirectory: "<BUILD_ID>",
        owner: "cybermedica-web:cybermedica-web",
        directoryMode: "0750",
        fileMode: "0640",
      },
    },
    permissionAudit,
    inventory,
    archive: {
      rootDirectory: basename(root),
      path: basename(archivePath),
      size: (await stat(archivePath)).size,
      sha256: archiveSha256,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });

  const verificationRoot = await realpath(await mkdtemp(join(tmpdir(), "cybermedica-runtime-verify-")));
  const extractedRoot = join(verificationRoot, basename(root));
  try {
    const extract = spawnSync("tar", ["-xzf", archivePath, "-C", verificationRoot], { encoding: "utf8" });
    if (extract.status !== 0) throw new Error(`Archive verification extraction failed: ${extract.stderr}`);
    const extractedAudit = await auditRuntimePermissions(extractedRoot);
    assertPass(extractedAudit, "Extracted runtime permission gate");
    const inventoryVerification = await verifyRuntimeInventory(extractedRoot, inventory);
    if (!inventoryVerification.pass) {
      throw new Error(`Extracted runtime inventory verification failed: ${JSON.stringify(inventoryVerification)}`);
    }
  } finally {
    await rm(verificationRoot, { recursive: true, force: true });
  }

  const sidecarPath = `${manifestPath}.sha256`;
  const manifestSha256 = await sha256File(manifestPath);
  await writeFile(sidecarPath, `${manifestSha256}  ${basename(manifestPath)}\n`, { mode: 0o444 });
  await chmod(archivePath, 0o444);
  await chmod(manifestPath, 0o444);
  return {
    archivePath,
    archiveSha256,
    manifestPath,
    manifestSha256,
    sidecarPath,
    buildId,
    fileCount: inventory.length,
    payloadBytes: inventory.reduce((total, entry) => total + entry.size, 0),
    permissionAudit,
  };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { named } = parseArguments(rest);
  if (command === "normalize") {
    const root = requireArgument(named, "root");
    console.log(JSON.stringify(await normalizeRuntimePermissions(root)));
    return;
  }
  if (command === "audit" || command === "principal-audit") {
    const root = requireArgument(named, "root");
    const report = await auditRuntimePermissions(root, {
      checkCurrentPrincipal: command === "principal-audit",
    });
    if (named.has("state-root")) {
      report.runtimeState = await auditRuntimeState(
        root,
        requireArgument(named, "state-root"),
        { checkCurrentPrincipal: command === "principal-audit" },
      );
      report.pass = report.pass && report.runtimeState.pass;
    }
    console.log(JSON.stringify(report));
    if (!report.pass) process.exitCode = 1;
    return;
  }
  if (command === "service-audit") {
    const report = await serviceAudit(
      requireArgument(named, "root"),
      requireArgument(named, "state-root"),
      requireArgument(named, "user"),
    );
    console.log(JSON.stringify(report));
    if (!report.pass) process.exitCode = 1;
    return;
  }
  if (command === "prepare-state") {
    if (typeof process.getuid !== "function" || process.getuid() !== 0) {
      throw new Error("Runtime state preparation must be launched as root.");
    }
    const user = requireArgument(named, "user");
    const group = requireArgument(named, "group");
    console.log(JSON.stringify(await prepareRuntimeState(
      requireArgument(named, "root"),
      requireArgument(named, "state-root"),
      { uid: resolvePrincipal(user, "-u"), gid: resolvePrincipal(group, "-g") },
    )));
    return;
  }
  if (command === "package") {
    console.log(JSON.stringify(await packageArtifact(named)));
    return;
  }
  throw new Error("Usage: runtime-artifact-permissions.mjs <normalize|audit|principal-audit|prepare-state|service-audit|package> --root <path> [...]");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
