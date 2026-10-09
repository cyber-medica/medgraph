import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  classifyNextImageIntegration,
} from "../../scripts/qa/next-image-integration-policy.ts";

const execFileAsync = promisify(execFile);
const approvedEvidence = {
  approvedSourceHost: true,
  routeResponded: true,
  contentType: "text/plain; charset=utf-8",
};

test("ETIMEDOUT from approved remote media degrades without a hard failure", () => {
  assert.deepEqual(
    classifyNextImageIntegration({
      ...approvedEvidence,
      status: 500,
      serverEvidence: "TypeError: fetch failed\nAggregateError code: ETIMEDOUT",
    }),
    {
      outcome: "DEGRADED_EXTERNAL_UPSTREAM",
      failureClass: "REMOTE_MEDIA_UPSTREAM_FAILURE",
      reason: "REMOTE_MEDIA_UPSTREAM_UNAVAILABLE",
      transportClass: "ETIMEDOUT",
    },
  );
});

test("ENOTFOUND from approved remote media degrades without a hard failure", () => {
  assert.equal(
    classifyNextImageIntegration({
      ...approvedEvidence,
      status: 500,
      serverEvidence: "cause code: ENOTFOUND",
    }).outcome,
    "DEGRADED_EXTERNAL_UPSTREAM",
  );
});

test("optimizer configuration rejection remains a hard failure", () => {
  const decision = classifyNextImageIntegration({
    ...approvedEvidence,
    status: 400,
    serverEvidence: "url parameter is not allowed; unrelated code: ETIMEDOUT",
  });
  assert.equal(decision.outcome, "HARD_FAIL");
  assert.equal(decision.failureClass, "LOCAL_OPTIMIZER_OR_CONFIG_FAILURE");
});

test("unsupported media host remains a hard failure", () => {
  const decision = classifyNextImageIntegration({
    ...approvedEvidence,
    approvedSourceHost: false,
    status: 500,
    serverEvidence: "code: ETIMEDOUT",
  });
  assert.equal(decision.outcome, "HARD_FAIL");
  assert.equal(decision.reason, "UNSUPPORTED_MEDIA_HOST");
});

test("local optimizer 500 without transport evidence remains a hard failure", () => {
  const decision = classifyNextImageIntegration({
    ...approvedEvidence,
    status: 500,
    serverEvidence: "Internal Server Error",
  });
  assert.equal(decision.outcome, "HARD_FAIL");
  assert.equal(decision.reason, "UNPROVEN_UPSTREAM_FAILURE");
});

test("successful optimizer image response passes", () => {
  assert.equal(
    classifyNextImageIntegration({
      ...approvedEvidence,
      status: 200,
      contentType: "image/webp",
      serverEvidence: "",
    }).outcome,
    "PASS",
  );
});

type ProbeServerOptions = {
  status: number;
  contentType: string;
  serverLog?: string;
};

async function runProbe(options: ProbeServerOptions) {
  const directory = await mkdtemp(join(tmpdir(), "next-image-integration-"));
  const serverLogPath = join(directory, "server.log");
  await writeFile(serverLogPath, "startup complete\n", "utf8");
  const server = createServer(async (_request, response) => {
    if (options.serverLog) {
      await appendFile(serverLogPath, options.serverLog, "utf8");
    }
    response.writeHead(options.status, { "content-type": options.contentType });
    response.end(options.status === 200 ? Buffer.from([0x89, 0x50, 0x4e, 0x47]) : "failed");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    return await execFileAsync(
      process.execPath,
      ["scripts/qa/ios-webkit-smoke.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          WEBKIT_SMOKE_MODE: "next-image",
          WEBKIT_SMOKE_ORIGIN: `http://127.0.0.1:${address.port}`,
          WEBKIT_SMOKE_NEXT_IMAGE_SOURCE: "https://static.tildacdn.com/test.png",
          WEBKIT_SMOKE_NEXT_IMAGE_TIMEOUT_MS: "2000",
          WEBKIT_SMOKE_SERVER_LOG: serverLogPath,
        },
      },
    );
  } finally {
    server.close();
    await once(server, "close");
    await rm(directory, { recursive: true, force: true });
  }
}

test("command integration passes a successful deterministic optimizer fixture", async () => {
  const result = await runProbe({ status: 200, contentType: "image/png" });
  assert.match(result.stdout, /NEXT_IMAGE_INTEGRATION=PASS/u);
});

test("command integration reports a synthetic upstream timeout without failing", async () => {
  const result = await runProbe({
    status: 500,
    contentType: "text/plain",
    serverLog: "TypeError: fetch failed\nAggregateError code = ETIMEDOUT\n",
  });
  assert.match(result.stderr, /NEXT_IMAGE_INTEGRATION=DEGRADED_EXTERNAL_UPSTREAM/u);
  assert.match(result.stderr, /transport=ETIMEDOUT/u);
});

test("command integration keeps an unproven local 500 blocking", async () => {
  await assert.rejects(
    runProbe({ status: 500, contentType: "text/plain" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /LOCAL_OPTIMIZER_OR_CONFIG_FAILURE/u);
      return true;
    },
  );
});
