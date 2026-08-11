import assert from "node:assert/strict";

import {
  CANONICAL_HOST,
  assertNoLegacyPageShell,
  assertSameCanonicalFingerprint,
  extractCatalogProductPaths,
  extractSitemapProductPaths,
  readCanonicalRouteFingerprint,
  type CanonicalRouteFingerprint,
} from "../../lib/canonical-routing-gate.ts";

const origin = new URL(process.env.CANONICAL_ROUTING_ORIGIN ?? `https://${CANONICAL_HOST}`);
assert.equal(origin.protocol, "https:");
assert.ok([CANONICAL_HOST, "www.cyber-medica.ru"].includes(origin.hostname));

const expectedRelease = process.env.EXPECTED_RELEASE_SHA?.trim();
const expectedCount = Number(process.env.EXPECTED_PUBLISHED_PRODUCT_COUNT ?? "0");
const routeResponseBudgetMs = 30_000;
const nonce = `routing-gate-${Date.now()}`;
let canonicalFingerprint: CanonicalRouteFingerprint | undefined;

async function read(path: string, expectedStatus = 200) {
  const url = new URL(path, origin);
  url.searchParams.set("routing_gate", nonce);
  const started = Date.now();
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(routeResponseBudgetMs),
    headers: {
      "Cache-Control": "no-cache",
      "User-Agent": "CyberMedica-Canonical-Routing-Gate/2.0",
    },
  });
  assert.equal(response.status, expectedStatus, `${path} returned ${response.status}`);
  assert.equal(new URL(response.url).hostname, CANONICAL_HOST, `${path} escaped the canonical host`);
  assert.equal(response.headers.get("server"), "Vercel", `${path} is not served by Vercel`);
  assert.ok(response.headers.get("x-vercel-id"), `${path} is missing the Vercel request fingerprint`);
  const fingerprint = readCanonicalRouteFingerprint(response.headers);
  if (canonicalFingerprint) assertSameCanonicalFingerprint(canonicalFingerprint, fingerprint, path);
  else canonicalFingerprint = fingerprint;
  if (expectedRelease) assert.equal(fingerprint.release, expectedRelease, "canonical release SHA is not ready");
  const text = await response.text();
  assert.ok(Date.now() - started < routeResponseBudgetMs, `${path} exceeded the response budget`);
  return { response, text };
}

const wwwResponse = await fetch(`https://www.${CANONICAL_HOST}/?routing_gate=${nonce}`, {
  cache: "no-store",
  redirect: "manual",
  signal: AbortSignal.timeout(routeResponseBudgetMs),
});
assert.ok([301, 308].includes(wwwResponse.status), "www must redirect permanently");
assert.equal(new URL(wwwResponse.headers.get("location") ?? "", origin).hostname, CANONICAL_HOST);

const [home, catalog, requestPage, sitemap, login, health] = await Promise.all([
  read("/"),
  read("/catalog"),
  read("/request"),
  read("/sitemap.xml"),
  read("/internal/login"),
  read("/internal/health/catalog"),
]);

for (const [route, body] of [
  ["/", home.text],
  ["/catalog", catalog.text],
  ["/request", requestPage.text],
  ["/internal/login", login.text],
] as const) {
  assert.ok(body.trim().length > 500, `${route} returned near-empty HTML`);
  assert.match(body, /CyberMedica|Кибермедика/iu, `${route} is missing the canonical shell marker`);
  assertNoLegacyPageShell(body, route);
}

const sitemapPaths = extractSitemapProductPaths(sitemap.text);
const catalogPaths = extractCatalogProductPaths(catalog.text);
assert.ok(sitemapPaths.size > 0, "sitemap contains no Product URLs");
assert.equal(catalogPaths.size, sitemapPaths.size, "catalog and sitemap Product counts diverge");
for (const path of sitemapPaths) assert.ok(catalogPaths.has(path), `${path} is absent from catalog HTML`);
if (expectedCount > 0) assert.equal(sitemapPaths.size, expectedCount, "published Product count drifted");

const healthValue = JSON.parse(health.text) as {
  snapshotProductCount?: unknown;
  status?: unknown;
};
assert.ok(healthValue.status === "healthy" || healthValue.status === "degraded");
assert.equal(healthValue.snapshotProductCount, sitemapPaths.size);

const stableDetailPath = [...sitemapPaths].sort()[0];
const detail = await read(stableDetailPath);
assert.ok(detail.text.trim().length > 500, "Product Detail returned near-empty HTML");
assertNoLegacyPageShell(detail.text, stableDetailPath);

await read("/api/request", 405);
const anonymousReview = await fetch(new URL("/internal/review", origin), {
  cache: "no-store",
  redirect: "manual",
  signal: AbortSignal.timeout(routeResponseBudgetMs),
});
assert.equal(anonymousReview.status, 303);
assert.equal(new URL(anonymousReview.headers.get("location") ?? "", origin).pathname, "/internal/login");

console.info(JSON.stringify({
  deployment: canonicalFingerprint?.deployment,
  origin: canonicalFingerprint?.origin,
  productUrls: sitemapPaths.size,
  release: canonicalFingerprint?.release,
  status: "pass",
}));
