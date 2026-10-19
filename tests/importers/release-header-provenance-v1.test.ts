import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  assertReleaseIdentity,
  assertRoutesManifestReleaseSha,
  releaseHeaderValue,
} from "../../scripts/release/release-provenance.mjs";

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

function routesManifest(releaseSha: string) {
  return {
    headers: [{
      source: "/(.*)",
      headers: [{ key: "X-CyberMedica-Release", value: releaseSha }],
    }],
  };
}

test("valid exact release identity and baked routes manifest pass", () => {
  assert.deepEqual(assertReleaseIdentity({
    sourceHead: SHA,
    targetSha: SHA,
    releaseSha: SHA,
  }), { sourceHead: SHA, targetSha: SHA, releaseSha: SHA });
  assert.equal(releaseHeaderValue({ CYBERMEDICA_RELEASE_SHA: SHA }), SHA);
  assert.equal(assertRoutesManifestReleaseSha(routesManifest(SHA), SHA), SHA);
});

test("missing release SHA fails closed", () => {
  assert.throws(() => assertReleaseIdentity({
    sourceHead: SHA,
    targetSha: SHA,
    releaseSha: undefined,
  }), /CYBERMEDICA_RELEASE_SHA must be an exact 40-character lowercase Git SHA/u);
});

test("untracked release SHA fails closed", () => {
  assert.throws(() => assertReleaseIdentity({
    sourceHead: SHA,
    targetSha: SHA,
    releaseSha: "untracked",
  }), /CYBERMEDICA_RELEASE_SHA must be an exact 40-character lowercase Git SHA/u);
});

test("malformed release SHA fails closed", () => {
  assert.throws(() => assertReleaseIdentity({
    sourceHead: SHA,
    targetSha: SHA,
    releaseSha: "A".repeat(40),
  }), /CYBERMEDICA_RELEASE_SHA must be an exact 40-character lowercase Git SHA/u);
  assert.throws(() => assertRoutesManifestReleaseSha(routesManifest("short"), SHA));
});

test("mismatched release SHA fails closed", () => {
  assert.throws(() => assertReleaseIdentity({
    sourceHead: SHA,
    targetSha: SHA,
    releaseSha: OTHER_SHA,
  }), /CYBERMEDICA_RELEASE_SHA does not match TARGET_SHA/u);
  assert.throws(
    () => assertRoutesManifestReleaseSha(routesManifest(OTHER_SHA), SHA),
    /does not match TARGET_SHA/u,
  );
});

test("application header has no Vercel or untracked fallback", async () => {
  const source = await readFile("next.config.ts", "utf8");
  assert.doesNotMatch(source, /VERCEL_GIT_COMMIT_SHA/u);
  assert.doesNotMatch(source, /["']untracked["']/u);
  assert.equal(releaseHeaderValue({}), "local");
});
