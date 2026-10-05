import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const removedReviewerUuidSha256 =
  "6e22fa8ff53dc7d6fa39ec8e1c170231a0cc656b907e7c133904c9db10b1ecc1";
const removedReviewerEmailSha256 =
  "df676f6364888f91b6bd84aa90dfbceef3503cae5a3ae0fc6a373449b98891a1";
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/giu;
const gmailPattern = /[a-z0-9._%+-]+@(?:gmail|googlemail)\.[a-z]{2,}/giu;
const forbiddenIdentitySymbols = [
  "APPROVED_REVIEWER",
  "EXPECTED_ADMIN_ID",
  "CORPORATE_ACTOR_ID",
] as const;

function sha256(value: string) {
  return createHash("sha256").update(value.toLowerCase()).digest("hex");
}

async function filesUnder(pathname: string): Promise<string[]> {
  const entries = await readdir(pathname, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(pathname, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function scanFiles(
  files: readonly string[],
  options: { rejectAnyGmail?: boolean } = {},
) {
  const findings: string[] = [];
  for (const path of files) {
    let tail = "";
    for await (const chunk of createReadStream(path, { highWaterMark: 1024 * 1024 })) {
      const content = `${tail}${Buffer.from(chunk).toString("utf8")}`;
      for (const symbol of forbiddenIdentitySymbols) {
        if (content.includes(symbol)) findings.push(`${path}:forbidden-symbol`);
      }
      for (const email of content.match(gmailPattern) ?? []) {
        if (options.rejectAnyGmail || sha256(email) === removedReviewerEmailSha256) {
          findings.push(`${path}:person-linked-reviewer-email`);
        }
      }
      for (const uuid of content.match(uuidPattern) ?? []) {
        if (sha256(uuid) === removedReviewerUuidSha256) {
          findings.push(`${path}:person-linked-reviewer-uuid`);
        }
      }
      tail = content.slice(-128);
    }
  }
  return findings;
}

test("build-reachable application source contains no compiled reviewer identity", async () => {
  const roots = ["app", "components", "lib"];
  const files = (await Promise.all(roots.map(filesUnder))).flat();
  files.push("proxy.ts", "next.config.ts");
  assert.deepEqual(await scanFiles(files, { rejectAnyGmail: true }), []);
});

test("recursive Next build and deployable artifacts contain no person-linked identity", {
  skip: !existsSync(".next"),
}, async () => {
  const allBuildFiles = await filesUnder(".next");
  assert.deepEqual(await scanFiles(allBuildFiles), []);
  const deployableFiles = allBuildFiles.filter((path) => !path.startsWith(".next/cache/"));
  assert.deepEqual(await scanFiles(deployableFiles, { rejectAnyGmail: true }), []);
});
