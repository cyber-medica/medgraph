import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SYSTEMD_RUNTIME_STATE_ROOT = "/var/lib/cybermedica-web/next-runtime";
export const SYSTEMD_RELEASE_ROOT = "/opt/cybermedica-web";
export const SYSTEMD_SERVICE_USER = "cybermedica-web";
export const SYSTEMD_SERVICE_GROUP = "cybermedica-web";

const trackedDirectives = new Set([
  "BindPaths",
  "Group",
  "ProtectSystem",
  "ReadOnlyPaths",
  "ReadWritePaths",
  "User",
  "WorkingDirectory",
]);

function logicalLines(source) {
  const lines = [];
  let pending = "";
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = pending ? `${pending}${rawLine.trimStart()}` : rawLine;
    if (/\\\s*$/u.test(line)) {
      pending = line.replace(/\\\s*$/u, " ");
      continue;
    }
    lines.push(line);
    pending = "";
  }
  if (pending) lines.push(pending);
  return lines;
}

export function parseSystemdServiceDirectives(source) {
  const directives = new Map();
  let section = "";
  for (const rawLine of logicalLines(source)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = /^\[([^\]]+)\]$/u.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    if (section !== "Service") continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (!trackedDirectives.has(key)) continue;
    const values = directives.get(key) ?? [];
    values.push(line.slice(separator + 1).trim());
    directives.set(key, values);
  }
  return directives;
}

function finalScalar(directives, key) {
  const values = directives.get(key) ?? [];
  return values.at(-1) ?? "";
}

function evaluatedList(directives, key) {
  const values = directives.get(key) ?? [];
  let entries = [];
  let resetSeen = false;
  for (const value of values) {
    if (!value) {
      entries = [];
      resetSeen = true;
      continue;
    }
    entries.push(...value.split(/\s+/u).filter(Boolean));
  }
  return { entries, resetSeen };
}

function isReleaseSpecificWritablePath(path) {
  return path.startsWith(`${SYSTEMD_RELEASE_ROOT}/releases/`)
    || path.startsWith(`${SYSTEMD_RELEASE_ROOT}/current/`)
    || path.includes("/.next/")
    || path.endsWith("/.next");
}

export function auditSystemdRuntimeStatePolicy(source) {
  const directives = parseSystemdServiceDirectives(source);
  const readWrite = evaluatedList(directives, "ReadWritePaths");
  const readOnly = evaluatedList(directives, "ReadOnlyPaths");
  const bind = evaluatedList(directives, "BindPaths");
  const oldReleaseSpecificReadWritePaths = readWrite.entries.filter(isReleaseSpecificWritablePath);
  const unexpectedReadWritePaths = readWrite.entries.filter(
    (path) => path !== SYSTEMD_RUNTIME_STATE_ROOT,
  );
  const report = {
    pass: false,
    protectSystem: finalScalar(directives, "ProtectSystem"),
    user: finalScalar(directives, "User"),
    group: finalScalar(directives, "Group"),
    workingDirectory: finalScalar(directives, "WorkingDirectory"),
    readWritePaths: readWrite.entries,
    readWritePathsReset: readWrite.resetSeen,
    readOnlyPaths: readOnly.entries,
    bindPaths: bind.entries,
    oldReleaseSpecificReadWritePaths,
    unexpectedReadWritePaths,
    immutableReleaseReadOnly: readOnly.entries.includes(SYSTEMD_RELEASE_ROOT),
  };
  report.pass = report.protectSystem === "strict"
    && report.user === SYSTEMD_SERVICE_USER
    && report.group === SYSTEMD_SERVICE_GROUP
    && report.readWritePathsReset
    && report.readWritePaths.length === 1
    && report.readWritePaths[0] === SYSTEMD_RUNTIME_STATE_ROOT
    && report.oldReleaseSpecificReadWritePaths.length === 0
    && report.unexpectedReadWritePaths.length === 0
    && report.immutableReleaseReadOnly
    && report.bindPaths.length === 0;
  return report;
}

async function main() {
  const [command, path] = process.argv.slice(2);
  if (command !== "audit" || !path) {
    throw new Error("Usage: systemd-runtime-state-policy.mjs audit <drop-in-path>");
  }
  const report = auditSystemdRuntimeStatePolicy(await readFile(resolve(path), "utf8"));
  console.log(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
