import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import nextConfig from "../../next.config.ts";
import {
  CANDIDATE_FRONT_DOOR,
  PRODUCTION_FRONT_DOOR,
  assertCanonicalProductionDelivery,
  assertCanonicalRfqMethodNotAllowed,
  assertCanonicalRfqServiceDelivery,
  assertNoLegacyPageShell,
  assertSameCanonicalFingerprint,
  assertStylesheetResponse,
  extractCatalogProductPaths,
  extractSitemapProductPaths,
  extractStylesheetUrls,
  readCanonicalRouteFingerprint,
  readExpectedCanonicalDeliveryMarker,
  safeRoutingHeaderValue,
} from "../../lib/canonical-routing-gate.ts";

test("legacy shell scanner permits approved Tilda CDN Product media only", () => {
  assert.doesNotThrow(() => assertNoLegacyPageShell(
    '<img src="https://static.tildacdn.com/stor123/image.png"><main>CyberMedica</main>',
    "/catalog",
  ));
  assert.throws(() => assertNoLegacyPageShell("<footer>Made on Tilda</footer>", "/catalog"));
  assert.throws(() => assertNoLegacyPageShell('<a href="https://medvist.ru">legacy</a>', "/catalog"));
});

test("canonical routing fingerprints fail closed on a split deployment", () => {
  const headers = new Headers({
    "x-cybermedica-deployment": "dpl_current",
    "x-cybermedica-origin": "medgraph",
    "x-cybermedica-release": "abc123",
  });
  const expected = readCanonicalRouteFingerprint(headers);
  assert.doesNotThrow(() => assertSameCanonicalFingerprint(expected, expected, "/catalog"));
  assert.throws(() => assertSameCanonicalFingerprint(expected, { ...expected, deployment: "dpl_legacy" }, "/request"));
});

function deliveryHeaders(
  marker: string | undefined,
  release = "abc123".padEnd(40, "0"),
) {
  return new Headers({
    server: "nginx/1.24.0 (Ubuntu)",
    ...(marker ? { "x-cybermedica-front-door": marker } : {}),
    "x-cybermedica-deployment": "dpl_current",
    "x-cybermedica-origin": "medgraph",
    "x-cybermedica-release": release,
    "x-vercel-id": "fra1::upstream",
  });
}

function rfqResponse(
  body = JSON.stringify({ ok: false, error: "Method not allowed" }),
  headers: Record<string, string> = {},
  status = 405,
) {
  return new Response(body, {
    status,
    headers: {
      allow: "POST",
      "cache-control": "private, no-store",
      "content-type": "application/json; charset=utf-8",
      server: "nginx/1.24.0 (Ubuntu)",
      "x-content-type-options": "nosniff",
      "x-cybermedica-front-door": PRODUCTION_FRONT_DOOR,
      "x-cybermedica-origin": "medgraph",
      ...headers,
    },
  });
}

test("candidate and Production delivery markers are explicit and mutually exclusive", () => {
  const candidate = deliveryHeaders(CANDIDATE_FRONT_DOOR);
  const production = deliveryHeaders(PRODUCTION_FRONT_DOOR);
  production.delete("x-vercel-id");

  assert.doesNotThrow(() => assertCanonicalProductionDelivery(
    candidate,
    "/catalog",
    CANDIDATE_FRONT_DOOR,
  ));
  assert.throws(() => assertCanonicalProductionDelivery(
    production,
    "/catalog",
    CANDIDATE_FRONT_DOOR,
  ));
  assert.doesNotThrow(() => assertCanonicalProductionDelivery(
    production,
    "/catalog",
    PRODUCTION_FRONT_DOOR,
  ));
  assert.throws(() => assertCanonicalProductionDelivery(
    candidate,
    "/catalog",
    PRODUCTION_FRONT_DOOR,
  ));
});

test("canonical delivery fails closed on missing, unknown and incomplete fingerprints", () => {
  const headers = deliveryHeaders(CANDIDATE_FRONT_DOOR);
  assert.throws(() => assertCanonicalProductionDelivery(headers, "/catalog", undefined));
  assert.throws(() => assertCanonicalProductionDelivery(headers, "/catalog", "unknown"));
  assert.throws(() => assertCanonicalProductionDelivery(new Headers({
    ...Object.fromEntries(headers),
    server: "Vercel",
    "x-cybermedica-front-door": "",
  }), "/catalog", CANDIDATE_FRONT_DOOR));
  assert.throws(() => assertCanonicalProductionDelivery(new Headers({
    ...Object.fromEntries(headers),
    "x-vercel-id": "",
  }), "/catalog", CANDIDATE_FRONT_DOOR));
});

test("delivery marker and release SHA contracts fail independently", () => {
  const release = "e7d0e53d51d9388f511199ae74b50a5d4701839c";
  const production = deliveryHeaders(PRODUCTION_FRONT_DOOR, release);
  production.delete("x-vercel-id");
  assert.doesNotThrow(() => assertCanonicalProductionDelivery(
    production,
    "/catalog",
    PRODUCTION_FRONT_DOOR,
    release,
  ));
  assert.throws(() => assertCanonicalProductionDelivery(
    production,
    "/catalog",
    PRODUCTION_FRONT_DOOR,
    "0".repeat(40),
  ));
  assert.throws(() => assertCanonicalProductionDelivery(
    production,
    "/catalog",
    CANDIDATE_FRONT_DOOR,
    release,
  ));
});

test("delivery marker configuration is required and restricted", () => {
  assert.equal(
    readExpectedCanonicalDeliveryMarker({
      CYBERMEDICA_EXPECTED_DELIVERY_MARKER: CANDIDATE_FRONT_DOOR,
    }),
    CANDIDATE_FRONT_DOOR,
  );
  assert.equal(
    readExpectedCanonicalDeliveryMarker({
      CYBERMEDICA_EXPECTED_DELIVERY_MARKER: PRODUCTION_FRONT_DOOR,
    }),
    PRODUCTION_FRONT_DOOR,
  );
  assert.throws(() => readExpectedCanonicalDeliveryMarker({}));
  assert.throws(() => readExpectedCanonicalDeliveryMarker({
    CYBERMEDICA_EXPECTED_DELIVERY_MARKER: "unknown",
  }));
});

test("RFQ GET 405 contract accepts semantic JSON and independent service provenance", async () => {
  const response = rfqResponse('{"error":"Method not allowed","ok":false}');
  response.headers.delete("x-cybermedica-release");
  response.headers.delete("x-cybermedica-deployment");
  const body = await response.text();
  assert.doesNotThrow(() => assertCanonicalRfqServiceDelivery(response.headers));
  assert.doesNotThrow(() => assertCanonicalRfqMethodNotAllowed(response, body));
});

test("RFQ GET 405 contract rejects empty, HTML and arbitrary JSON bodies", async () => {
  for (const body of [
    "",
    "<!doctype html><html><body>Method not allowed</body></html>",
    JSON.stringify({ ok: false, error: "Wrong error" }),
  ]) {
    const response = rfqResponse(body);
    assert.throws(() => assertCanonicalRfqMethodNotAllowed(response, body));
  }
});

test("RFQ GET 405 contract fails closed on method and response header drift", () => {
  const cases: Array<[string, Record<string, string>]> = [
    ["missing Allow", { allow: "" }],
    ["missing no-store", { "cache-control": "private" }],
    ["wrong MIME", { "content-type": "text/html; charset=utf-8" }],
    ["missing charset", { "content-type": "application/json" }],
    ["missing nosniff", { "x-content-type-options": "" }],
  ];
  for (const [, headers] of cases) {
    const response = rfqResponse(undefined, headers);
    assert.throws(() => assertCanonicalRfqMethodNotAllowed(response, JSON.stringify({
      ok: false,
      error: "Method not allowed",
    })));
  }
});

test("RFQ GET contract rejects non-405 status codes", () => {
  for (const status of [200, 404, 500]) {
    const response = rfqResponse(undefined, {}, status);
    assert.throws(() => assertCanonicalRfqMethodNotAllowed(response, JSON.stringify({
      ok: false,
      error: "Method not allowed",
    })));
  }
});

test("RFQ service provenance rejects missing or incorrect public delivery headers", () => {
  const cases: Array<[string, Record<string, string>]> = [
    ["missing front door", { "x-cybermedica-front-door": "" }],
    ["candidate front door", { "x-cybermedica-front-door": CANDIDATE_FRONT_DOOR }],
    ["missing origin", { "x-cybermedica-origin": "" }],
    ["wrong origin", { "x-cybermedica-origin": "legacy" }],
    ["non-nginx server", { server: "Vercel" }],
  ];
  for (const [, headers] of cases) {
    const response = rfqResponse(undefined, headers);
    assert.throws(() => assertCanonicalRfqServiceDelivery(response.headers));
  }
});

test("web delivery still requires release provenance and exact expected SHA", () => {
  const release = "cb3d792a29a26062cbdfa9eba239fb5e9527430f";
  const missingRelease = deliveryHeaders(PRODUCTION_FRONT_DOOR, release);
  missingRelease.delete("x-cybermedica-release");
  assert.throws(() => assertCanonicalProductionDelivery(
    missingRelease,
    "/catalog",
    PRODUCTION_FRONT_DOOR,
    release,
  ));
  assert.throws(() => assertCanonicalProductionDelivery(
    deliveryHeaders(PRODUCTION_FRONT_DOOR, "0".repeat(40)),
    "/catalog",
    PRODUCTION_FRONT_DOOR,
    release,
  ));
});

test("catalog and sitemap extract unique canonical Product paths", () => {
  assert.deepEqual(
    [...extractCatalogProductPaths('<a href="/catalog/a"></a><a href="/catalog/a"></a><a href="/catalog/b"></a><a href="/catalog/endoskopiya"></a><a href="/catalog/reanimatsiya/transportnye-apparaty-ivl"></a>')],
    ["/catalog/a", "/catalog/b"],
  );
  assert.deepEqual(
    [...extractSitemapProductPaths('<loc>https://cyber-medica.ru/catalog/a</loc><loc>https://cyber-medica.ru/catalog/b</loc><loc>https://cyber-medica.ru/catalog/endoskopiya/videoendoskopicheskie-sistemy</loc><loc>https://cyber-medica.ru/catalog/anesteziologiya/narkozno-dykhatelnye-apparaty</loc>')],
    ["/catalog/a", "/catalog/b"],
  );
});

test("routing header values reject unsafe or missing environment input", () => {
  assert.equal(safeRoutingHeaderValue("dpl_123", "local"), "dpl_123");
  assert.equal(safeRoutingHeaderValue("bad header", "local"), "local");
  assert.equal(safeRoutingHeaderValue(undefined, "untracked"), "untracked");
});

test("production assets have no external stylesheet rewrite", async () => {
  const source = await readFile("next.config.ts", "utf8");
  assert.equal(nextConfig.rewrites, undefined);
  assert.doesNotMatch(source, /medgraph-qwz6kflq8-medgraph\.vercel\.app/u);
  assert.doesNotMatch(source, /2oenka20_-bmt\.css/u);
});

test("stylesheet gate rejects missing, wrong-MIME and HTML responses", () => {
  const documentUrl = new URL("https://cyber-medica.ru/");
  assert.deepEqual(
    extractStylesheetUrls(
      '<link rel="stylesheet" href="/_next/static/app.css">',
      documentUrl,
    ).map(String),
    ["https://cyber-medica.ru/_next/static/app.css"],
  );
  const css = ".a{color:red}".repeat(100);
  function response(body: string, init: ResponseInit) {
    const value = new Response(body, init);
    Object.defineProperty(value, "url", {
      value: "https://cyber-medica.ru/_next/static/app.css",
    });
    return value;
  }
  assert.doesNotThrow(() => assertStylesheetResponse(
    response(css, {
      status: 200,
      headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public,max-age=31536000,immutable" },
    }),
    css,
    "cyber-medica.ru",
  ));
  assert.throws(() => assertStylesheetResponse(
    response("<!doctype html><html></html>", { status: 200, headers: { "content-type": "text/html" } }),
    "<!doctype html><html></html>",
    "cyber-medica.ru",
  ));
  assert.throws(() => assertStylesheetResponse(
    response("missing", { status: 404, headers: { "content-type": "text/plain" } }),
    "missing",
    "cyber-medica.ru",
  ));
});

test("Next config exposes one canonical fingerprint on every application route", async () => {
  const entries = await nextConfig.headers?.();
  const catchAll = entries?.find((entry) => entry.source === "/(.*)");
  assert.ok(catchAll);
  const headers = new Map(catchAll.headers.map((header) => [header.key, header.value]));
  assert.equal(headers.get("X-CyberMedica-Origin"), "medgraph");
  assert.ok(headers.has("X-CyberMedica-Deployment"));
  assert.ok(headers.has("X-CyberMedica-Release"));
});

test("WebKit smoke isolates only the Vercel Preview toolbar CSP diagnostic", async () => {
  const source = await readFile("scripts/qa/ios-webkit-smoke.ts", "utf8");
  assert.match(source, /parsedOrigin\.hostname\.endsWith\("\.vercel\.app"\)/u);
  assert.match(source, /https:\/\/vercel\.live\/_next-live\/feedback\/feedback\.js/u);
  assert.match(source, /waitUntil: "domcontentloaded"/u);
  assert.match(source, /document\.body\?\.innerText/u);
  assert.match(source, /aria-label="Загрузка страницы"[\s\S]+state: "detached"/u);
  assert.doesNotMatch(source, /waitUntil: "networkidle"/u);
  const routeLoop = source.indexOf("for (const route of routes)");
  const page = source.indexOf("const page = await context.newPage();", routeLoop);
  assert.ok(routeLoop >= 0 && page > routeLoop);
  assert.doesNotMatch(source, /runtimeErrors\s*=\s*\[\]/u);
});

test("canonical mobile synthetic uses isolated direct-route pages", async () => {
  const source = await readFile("scripts/qa/canonical-routing-mobile-synthetic.ts", "utf8");
  const loop = source.indexOf('for (const route of ["/", "/catalog"');
  const page = source.indexOf("const page = await context.newPage();", loop);
  const close = source.indexOf("await page.close();", page);
  assert.ok(loop >= 0 && page > loop && close > page);
  assert.doesNotMatch(source.slice(0, loop), /const page = await context\.newPage\(\)/u);
  assert.match(source, /message\.location\(\)\.url/u);
  assert.match(source, /message\.text\(\)\.slice\(0, 300\)/u);
});
