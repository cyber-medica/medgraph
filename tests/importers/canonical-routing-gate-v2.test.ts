import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import nextConfig from "../../next.config.ts";
import {
  assertNoLegacyPageShell,
  assertSameCanonicalFingerprint,
  extractCatalogProductPaths,
  extractSitemapProductPaths,
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
    [...extractCatalogProductPaths('<a href="/catalog/a"></a><a href="/catalog/a"></a><a href="/catalog/b"></a><a href="/catalog/endoskopiya"></a>')],
    ["/catalog/a", "/catalog/b"],
  );
  assert.deepEqual(
    [...extractSitemapProductPaths('<loc>https://cyber-medica.ru/catalog/a</loc><loc>https://cyber-medica.ru/catalog/b</loc><loc>https://cyber-medica.ru/catalog/endoskopiya/videoendoskopicheskie-sistemy</loc>')],
    ["/catalog/a", "/catalog/b"],
  );
});

test("routing header values reject unsafe or missing environment input", () => {
  assert.equal(safeRoutingHeaderValue("dpl_123", "local"), "dpl_123");
  assert.equal(safeRoutingHeaderValue("bad header", "local"), "local");
  assert.equal(safeRoutingHeaderValue(undefined, "untracked"), "untracked");
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
  assert.doesNotMatch(source, /runtimeErrors\s*=\s*\[\]/u);
});
