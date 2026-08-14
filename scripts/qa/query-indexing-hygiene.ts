import assert from "node:assert/strict";

import {
  COMMERCIAL_ATTRIBUTION_QUERY_PARAMETERS,
  QUERY_INDEXING_HYGIENE_HEADER,
  QUERY_INDEXING_HYGIENE_HEADER_VALUE,
  SYNTHETIC_DEBUG_QUERY_PARAMETERS,
} from "../../lib/seo/query-indexing-hygiene.ts";
import { extractSitemapProductPaths } from "../../lib/canonical-routing-gate.ts";
import { STOREFRONT_SITE_URL } from "../../lib/storefront/seo.ts";

const origin = new URL(
  process.env.QUERY_HYGIENE_ORIGIN ?? "http://127.0.0.1:3000",
);
const requestTimeoutMs = 30_000;

function canonicalFromHtml(html: string) {
  return html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/iu,
  )?.[1]
    ?? html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/iu,
    )?.[1];
}

function assertCleanCanonical(
  html: string,
  expectedPath: string,
  requestedPath: string,
) {
  const canonical = canonicalFromHtml(html);
  assert.ok(canonical, `${requestedPath} must declare a canonical`);
  const parsed = new URL(canonical);
  assert.equal(parsed.origin, STOREFRONT_SITE_URL);
  assert.equal(parsed.pathname, expectedPath);
  assert.equal(parsed.search, "", `${requestedPath} canonical must omit query`);
  assert.equal(parsed.hash, "", `${requestedPath} canonical must omit fragment`);
}

async function fetchDocument(path: string) {
  const response = await fetch(new URL(path, origin), {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const body = await response.text();
  assert.equal(response.status, 200, `${path} must return HTTP 200`);
  return { response, body };
}

const sitemapResponse = await fetch(
  new URL("/sitemap.xml", origin),
  { signal: AbortSignal.timeout(requestTimeoutMs) },
);
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
assert.doesNotMatch(
  sitemap,
  /mobile_synthetic|webkit_diagnostic|r9_smoke|[?&]lh=/u,
);
const productPaths = [...extractSitemapProductPaths(sitemap)].sort();
const previewProductPath = process.env.QUERY_HYGIENE_PRODUCT_PATH
  ?? "/catalog/767632362-330695211247-apparat-ivl-hamilton-t1";
const isVercelPreview = origin.hostname.endsWith(".vercel.app");
const productPath = productPaths[0]
  ?? (isVercelPreview ? previewProductPath : undefined);
assert.ok(
  productPath,
  "non-Preview sitemap must contain Product URLs",
);

const technicalCases = [
  { path: "/?lh=prod-mobile-debug", canonical: "/" },
  { path: "/catalog?mobile_synthetic=stage-check", canonical: "/catalog" },
  {
    path: `${productPath}?webkit_diagnostic=1`,
    canonical: productPath,
  },
  { path: "/request?r9_smoke=query-hygiene", canonical: "/request" },
] as const;

for (const testCase of technicalCases) {
  const { response, body } = await fetchDocument(testCase.path);
  assert.equal(response.headers.get("location"), null, `${testCase.path} must not redirect`);
  assert.match(
    response.headers.get("x-robots-tag") ?? "",
    /noindex/iu,
    `${testCase.path} must be noindex`,
  );
  assert.equal(
    response.headers.get(QUERY_INDEXING_HYGIENE_HEADER),
    QUERY_INDEXING_HYGIENE_HEADER_VALUE,
  );
  assertCleanCanonical(body, testCase.canonical, testCase.path);
}

const attributionQuery = COMMERCIAL_ATTRIBUTION_QUERY_PARAMETERS
  .map((name, index) => `${name}=preserved-${index + 1}`)
  .join("&");
const attributionPath = `/request?${attributionQuery}`;
const attributionResponse = await fetchDocument(attributionPath);
assert.equal(
  attributionResponse.response.headers.get(QUERY_INDEXING_HYGIENE_HEADER),
  null,
  "commercial attribution parameters must not activate technical-query policy",
);
assertCleanCanonical(attributionResponse.body, "/request", attributionPath);

console.info(JSON.stringify({
  attributionParameters: COMMERCIAL_ATTRIBUTION_QUERY_PARAMETERS,
  productPath,
  sitemapProductCount: productPaths.length,
  status: "pass",
  technicalParameters: SYNTHETIC_DEBUG_QUERY_PARAMETERS,
  testedOrigin: origin.origin,
}));
