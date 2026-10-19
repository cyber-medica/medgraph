import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXACT_GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
export const RELEASE_SHA_ENV = "CYBERMEDICA_RELEASE_SHA";
export const TARGET_SHA_ENV = "TARGET_SHA";

export function requireExactGitSha(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!EXACT_GIT_SHA_PATTERN.test(normalized)) {
    throw new Error(`${label} must be an exact 40-character lowercase Git SHA.`);
  }
  return normalized;
}

/** @param {Readonly<Record<string, string | undefined>>} environment */
export function releaseHeaderValue(environment = process.env) {
  const value = environment[RELEASE_SHA_ENV];
  if (value === undefined || value.trim() === "") return "local";
  return requireExactGitSha(value, RELEASE_SHA_ENV);
}

export function assertReleaseIdentity({ sourceHead, targetSha, releaseSha }) {
  const source = requireExactGitSha(sourceHead, "SOURCE_HEAD");
  const target = requireExactGitSha(targetSha, TARGET_SHA_ENV);
  const release = requireExactGitSha(releaseSha, RELEASE_SHA_ENV);
  if (source !== target) {
    throw new Error(`SOURCE_HEAD does not match ${TARGET_SHA_ENV}.`);
  }
  if (release !== target) {
    throw new Error(`${RELEASE_SHA_ENV} does not match ${TARGET_SHA_ENV}.`);
  }
  return { sourceHead: source, targetSha: target, releaseSha: release };
}

export function assertRoutesManifestReleaseSha(manifest, expectedSha) {
  const expected = requireExactGitSha(expectedSha, TARGET_SHA_ENV);
  const releaseHeaders = Array.isArray(manifest?.headers)
    ? manifest.headers.flatMap((rule) => (
      Array.isArray(rule?.headers)
        ? rule.headers.filter((header) => header?.key?.toLowerCase() === "x-cybermedica-release")
        : []
    ))
    : [];
  if (releaseHeaders.length !== 1) {
    throw new Error("routes-manifest.json must contain exactly one X-CyberMedica-Release header.");
  }
  const actual = requireExactGitSha(
    releaseHeaders[0].value,
    "routes-manifest X-CyberMedica-Release",
  );
  if (actual !== expected) {
    throw new Error("routes-manifest X-CyberMedica-Release does not match TARGET_SHA.");
  }
  return actual;
}

export function readSourceHead(root = process.cwd()) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: resolve(root),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error("Unable to resolve SOURCE_HEAD from the build workspace.");
  }
  return requireExactGitSha(result.stdout, "SOURCE_HEAD");
}

export function verifySourceReleaseIdentity(
  root = process.cwd(),
  environment = process.env,
) {
  return assertReleaseIdentity({
    sourceHead: readSourceHead(root),
    targetSha: environment[TARGET_SHA_ENV],
    releaseSha: environment[RELEASE_SHA_ENV],
  });
}

export async function verifyBuiltReleaseHeader(
  root = process.cwd(),
  expectedSha = process.env[TARGET_SHA_ENV],
) {
  const manifestPath = resolve(root, ".next/routes-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return {
    manifestPath,
    releaseSha: assertRoutesManifestReleaseSha(manifest, expectedSha),
  };
}

async function main() {
  const command = process.argv[2];
  if (command === "verify-source") {
    const identity = verifySourceReleaseIdentity();
    console.log(JSON.stringify({ event: "release_source_identity_verified", ...identity }));
    return;
  }
  if (command === "verify-manifest") {
    const identity = verifySourceReleaseIdentity();
    const manifest = await verifyBuiltReleaseHeader(process.cwd(), identity.targetSha);
    console.log(JSON.stringify({
      event: "release_routes_manifest_verified",
      ...identity,
      ...manifest,
    }));
    return;
  }
  throw new Error("Usage: release-provenance.mjs <verify-source|verify-manifest>");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
