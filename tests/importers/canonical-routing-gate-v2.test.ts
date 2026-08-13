import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import nextConfig from "../../next.config.ts";
import {
  preCorrectiveStylesheetBridges,
  previousCanonicalAssetOrigin,
} from "../../next.config.ts";
import {
  assertNoLegacyPageShell,
  assertSameCanonicalFingerprint,
  assertStylesheetResponse,
  extractCatalogProductPaths,
  extractSitemapProductPaths,
  extractStylesheetUrls,
  readCanonicalRouteFingerprint,
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

test("stale pre-corrective assets have a narrow previous-deployment fallback", async () => {
  const rewrites = await nextConfig.rewrites?.();
  assert.ok(rewrites && !Array.isArray(rewrites));
  assert.deepEqual(rewrites.beforeFiles, [
    {
      source: "/_next/static/chunks/2oenka20_-bmt.css",
      destination: `${previousCanonicalAssetOrigin}/_next/static/chunks/2oenka20_-bmt.css`,
    },
  ]);
  assert.deepEqual(rewrites.beforeFiles, preCorrectiveStylesheetBridges);
  assert.deepEqual(rewrites.afterFiles, []);
  assert.deepEqual(rewrites.fallback, []);
  assert.ok(rewrites.beforeFiles.every(({ source }) => source.endsWith(".css")));
  assert.ok(rewrites.beforeFiles.every(({ source }) => !source.includes(":path")));
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
