import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import test from "node:test";

import nextConfig from "../../next.config.ts";

interface ObservedResponse {
  body: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  rawHeaders: readonly string[];
  status: number;
}

function observeResponse(
  origin: string,
  path: string,
  input: Readonly<{
    body?: string;
    headers?: Readonly<Record<string, string>>;
    method?: string;
  }> = {},
) {
  return new Promise<ObservedResponse>((resolve, reject) => {
    const url = new URL(path, origin);
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = send(url, {
      method: input.method ?? "GET",
      headers: input.headers,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({
        body: Buffer.concat(chunks).toString("utf8"),
        headers: response.headers,
        rawHeaders: response.rawHeaders,
        status: response.statusCode ?? 0,
      }));
    });
    request.setTimeout(10_000, () => request.destroy(new Error("self_hosted_request_timeout")));
    request.on("error", reject);
    if (input.body) request.write(input.body);
    request.end();
  });
}

function rawHeaderValues(response: ObservedResponse, name: string) {
  const values: string[] = [];
  for (let index = 0; index < response.rawHeaders.length; index += 2) {
    if (response.rawHeaders[index]?.toLowerCase() === name.toLowerCase()) {
      values.push(response.rawHeaders[index + 1] ?? "");
    }
  }
  return values;
}

function assertSensitiveHeaders(response: ObservedResponse) {
  assert.deepEqual(rawHeaderValues(response, "Referrer-Policy"), ["no-referrer"]);
  assert.match(String(response.headers["cache-control"] ?? ""), /(?:^|,|\s)no-store(?:$|,|\s)/u);
  assert.equal(response.headers.pragma, "no-cache");
  assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
}

test("local-auth path rule overrides only the global referrer policy", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers!();
  const globalIndex = rules.findIndex((rule) => rule.source === "/(.*)");
  const localIndexes = rules
    .map((rule, index) => ({ index, rule }))
    .filter(({ rule }) => rule.source === "/internal/auth/local/:path*");

  assert.equal(localIndexes.length, 1);
  assert.ok(globalIndex >= 0);
  assert.ok(localIndexes[0]!.index > globalIndex);

  const globalHeaders = new Map(
    rules[globalIndex]!.headers.map((header) => [header.key.toLowerCase(), header.value]),
  );
  const localHeaders = new Map(
    localIndexes[0]!.rule.headers.map((header) => [header.key.toLowerCase(), header.value]),
  );
  assert.equal(globalHeaders.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(localHeaders.get("referrer-policy"), "no-referrer");
});

const selfHostedOrigin = process.env.P2C_SELF_HOSTED_ORIGIN;

test("self-hosted local-auth responses expose exactly one no-referrer header", {
  skip: selfHostedOrigin ? false : "set P2C_SELF_HOSTED_ORIGIN for next start acceptance",
}, async () => {
  assert.ok(selfHostedOrigin);
  const requestBody = JSON.stringify({ email: "synthetic.invalid@example.test" });
  const cases = [
    {
      name: "request accepted without disclosing account state",
      path: "/internal/auth/local/request",
      input: {
        method: "POST",
        headers: {
          "Content-Length": String(Buffer.byteLength(requestBody)),
          "Content-Type": "application/json",
        },
        body: requestBody,
      },
      status: 202,
    },
    {
      name: "request method rejection",
      path: "/internal/auth/local/request",
      input: {},
      status: 405,
    },
    {
      name: "callback clean redirect",
      path: "/internal/auth/local/callback",
      input: {},
      status: 303,
    },
    {
      name: "callback invalid-token rejection",
      path: "/internal/auth/local/callback?token=invalid",
      input: {},
      status: 303,
    },
    {
      name: "logout clean redirect",
      path: "/internal/auth/local/logout",
      input: { method: "POST" },
      status: 303,
    },
    {
      name: "completion response",
      path: "/internal/auth/local/complete",
      input: {},
      status: 200,
    },
    {
      name: "unknown local-auth path",
      path: "/internal/auth/local/not-found",
      input: {},
      status: 404,
    },
  ] as const;

  for (const scenario of cases) {
    const response = await observeResponse(selfHostedOrigin, scenario.path, scenario.input);
    assert.equal(response.status, scenario.status, scenario.name);
    assertSensitiveHeaders(response);
  }

  const normal = await observeResponse(selfHostedOrigin, "/about");
  assert.equal(normal.status, 200);
  assert.deepEqual(
    rawHeaderValues(normal, "Referrer-Policy"),
    ["strict-origin-when-cross-origin"],
  );
});
