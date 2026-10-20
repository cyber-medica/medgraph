import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const helper = resolve("scripts/release/cutover-readiness.sh");

async function unusedPort() {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return port;
}

async function listen(server: Server, port: number) {
  await new Promise<void>((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));
}

async function close(server: Server) {
  if (!server.listening) return;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
}

async function harness(body: string, environment: Record<string, string | undefined> = {}) {
  const root = await mkdtemp(join(tmpdir(), "cybermedica-cutover-readiness-"));
  const script = join(root, "harness.sh");
  const rollbackMarker = join(root, "rollback.marker");
  await writeFile(script, `#!/usr/bin/env bash\nset -Eeuo pipefail\nsource "${helper}"\nrollback_on_error() {\n  local rc=$?\n  trap - ERR\n  printf 'ROLLBACK_TRIGGERED=%s\\n' "$rc" >> "$ROLLBACK_MARKER"\n  exit 90\n}\ntrap rollback_on_error ERR\n${body}\n`, { mode: 0o700 });
  await chmod(script, 0o700);
  try {
    const result = await execFileAsync("bash", [script], {
      env: { ...process.env, ...environment, ROLLBACK_MARKER: rollbackMarker },
      timeout: 15_000,
    }).then(
      ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
      (error: NodeJS.ErrnoException & { code?: number; stdout?: string; stderr?: string }) => ({
        code: typeof error.code === "number" ? error.code : -1,
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? "",
      }),
    );
    const marker = await readFile(rollbackMarker, "utf8").catch(() => "");
    return { ...result, marker };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("legacy command-substitution probe reproduces inherited ERR false rollback", async () => {
  const port = await unusedPort();
  const result = await harness(`
status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --connect-timeout 1 --max-time 1 "http://127.0.0.1:${port}/")"
printf 'LEGACY_STATUS=%s\\n' "$status"
`);
  assert.equal(result.code, 90);
  assert.match(result.marker, /ROLLBACK_TRIGGERED=/u);
});

test("connection refused is retried and later readiness succeeds without rollback", async (t) => {
  const port = await unusedPort();
  const server = createServer((_request, response) => {
    response.writeHead(200).end("ready");
  });
  t.after(() => close(server));
  const delayedListen = setTimeout(() => void listen(server, port), 350);
  t.after(() => clearTimeout(delayedListen));

  const result = await harness(`
cutover_wait_for_http --url "http://127.0.0.1:${port}/" --attempts 20 --interval-seconds 0.1 --connect-timeout-seconds 1 --request-timeout-seconds 1
printf 'TRANSIENT_CONNECTION_REFUSED_HANDLED=PASS\\n'
printf 'LATER_READINESS_SUCCESS=PASS\\n'
printf 'FALSE_ROLLBACK=0\\n'
`);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.marker, "");
  assert.match(result.stdout, /READINESS_RESULT=PASS/u);
  assert.match(result.stdout, /TRANSIENT_CONNECTION_REFUSED_HANDLED=PASS/u);
  assert.match(result.stdout, /LATER_READINESS_SUCCESS=PASS/u);
  assert.match(result.stdout, /FALSE_ROLLBACK=0/u);
});

test("bounded connection refusal timeout triggers rollback", async () => {
  const port = await unusedPort();
  const result = await harness(`
cutover_wait_for_http --url "http://127.0.0.1:${port}/" --attempts 3 --interval-seconds 0.05 --connect-timeout-seconds 1 --request-timeout-seconds 1
`);
  assert.equal(result.code, 90);
  assert.match(result.stderr, /READINESS_RESULT=TIMEOUT ATTEMPTS=3/u);
  assert.match(result.marker, /ROLLBACK_TRIGGERED=73/u);
});

test("HTTP 500 is classified critical and triggers rollback", async (t) => {
  const server = createServer((_request, response) => {
    response.writeHead(500).end("not ready");
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  t.after(() => close(server));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const result = await harness(`
cutover_wait_for_http --url "http://127.0.0.1:${address.port}/" --attempts 10 --interval-seconds 0.1
`);
  assert.equal(result.code, 90);
  assert.match(result.stderr, /CLASS=CRITICAL_HTTP_5XX/u);
  assert.match(result.marker, /ROLLBACK_TRIGGERED=70/u);
});

test("process exit before readiness triggers rollback", async () => {
  const port = await unusedPort();
  const result = await harness(`
sleep 0.25 &
candidate_pid=$!
cutover_wait_for_http --url "http://127.0.0.1:${port}/" --attempts 20 --interval-seconds 0.1 --connect-timeout-seconds 1 --request-timeout-seconds 1 --process-pid "$candidate_pid"
`);
  assert.equal(result.code, 90);
  assert.match(result.stderr, /CLASS=PROCESS_EXITED/u);
  assert.match(result.marker, /ROLLBACK_TRIGGERED=72/u);
});

test("unrelated shell failure still reaches the global ERR rollback trap", async (t) => {
  const server = createServer((_request, response) => {
    response.writeHead(200).end("ready");
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  t.after(() => close(server));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const result = await harness(`
cutover_wait_for_http --url "http://127.0.0.1:${address.port}/" --attempts 2 --interval-seconds 0.05
false
`);
  assert.equal(result.code, 90);
  assert.match(result.stdout, /READINESS_RESULT=PASS/u);
  assert.match(result.marker, /ROLLBACK_TRIGGERED=1/u);
});
