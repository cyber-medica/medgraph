import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PRODUCTION_AVAILABILITY_ATTEMPTS,
  PRODUCTION_AVAILABILITY_ROUTES,
  runProductionAvailability,
} from "../../scripts/qa/production-availability.ts";

function vercelResponse(path: string, status = 200) {
  return new Response(`<html><body>${path}</body></html>`, {
    status,
    headers: {
      server: "Vercel",
      "x-cybermedica-deployment": "dpl_test",
      "x-cybermedica-release": "a".repeat(40),
      "x-vercel-cache": "MISS",
      "x-vercel-id": "fra1::test",
    },
  });
}

test("full GET availability covers every launch-critical route three times", async () => {
  const calls: Array<{ method: string; path: string }> = [];
  const logs: string[] = [];
  let clock = 1_000;
  const result = await runProductionAvailability({
    origin: "https://cyber-medica.ru",
    fetchImpl: async (input, init) => {
      const url = new URL(input.toString());
      calls.push({ method: init?.method ?? "GET", path: url.pathname });
      return vercelResponse(url.pathname);
    },
    delay: async () => undefined,
    now: () => { clock += 5; return clock; },
    log: (value) => logs.push(value),
  });

  assert.equal(result.passed, true);
  assert.equal(result.attemptsPerRoute, DEFAULT_PRODUCTION_AVAILABILITY_ATTEMPTS);
  assert.equal(calls.length, PRODUCTION_AVAILABILITY_ROUTES.length * 3);
  assert.deepEqual(new Set(calls.map(({ method }) => method)), new Set(["GET"]));
  for (const path of PRODUCTION_AVAILABILITY_ROUTES) {
    assert.equal(calls.filter((call) => call.path === path).length, 3);
  }
  assert.equal(result.results.every(({ bytes, ttfbMs, totalMs }) =>
    bytes > 0 && ttfbMs !== null && totalMs >= ttfbMs), true);
  assert.equal(logs.some((line) => line.includes("production_availability_summary")), true);
});

test("one recovered transient remains a failed unstable gate", async () => {
  let calls = 0;
  const result = await runProductionAvailability({
    attempts: 2,
    backoffMs: 0,
    fetchImpl: async (input) => {
      calls += 1;
      const path = new URL(input.toString()).pathname;
      if (calls === 1) throw new DOMException("timed out", "TimeoutError");
      return vercelResponse(path);
    },
    now: Date.now,
    log: () => undefined,
  });

  assert.equal(result.passed, false);
  assert.equal(result.results[0]?.errorClass, "timeout");
  assert.equal(result.results.slice(PRODUCTION_AVAILABILITY_ROUTES.length).every(({ passed }) => passed), true);
});

test("non-200, empty and non-Vercel responses fail closed", async () => {
  const responses = [
    new Response("unavailable", { status: 503 }),
    new Response("", {
      status: 200,
      headers: {
        server: "Vercel",
        "x-cybermedica-release": "a".repeat(40),
        "x-vercel-id": "fra1::test",
      },
    }),
    new Response("ok", { status: 200, headers: { server: "other" } }),
  ];
  let index = 0;
  const result = await runProductionAvailability({
    attempts: 1,
    backoffMs: 0,
    fetchImpl: async (input) => responses[index++] ?? vercelResponse(new URL(input.toString()).pathname),
    log: () => undefined,
  });

  assert.equal(result.passed, false);
  assert.equal(result.results.filter(({ passed }) => !passed).length, 3);
});

test("origin validation rejects credentials, paths and non-HTTPS schemes", async () => {
  for (const origin of [
    "http://cyber-medica.ru",
    "https://user@example.com",
    "https://cyber-medica.ru/catalog",
  ]) {
    await assert.rejects(() => runProductionAvailability({ origin, log: () => undefined }));
  }
});
