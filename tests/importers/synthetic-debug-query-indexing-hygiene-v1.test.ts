import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import nextConfig from "../../next.config.ts";
import {
  COMMERCIAL_ATTRIBUTION_QUERY_PARAMETERS,
  QUERY_INDEXING_HYGIENE_HEADER,
  QUERY_INDEXING_HYGIENE_HEADER_VALUE,
  SYNTHETIC_DEBUG_QUERY_PARAMETERS,
  SYNTHETIC_DEBUG_ROBOTS_DIRECTIVE,
  buildSyntheticDebugQueryHeaderRules,
  hasSyntheticDebugQueryParameter,
} from "../../lib/seo/query-indexing-hygiene.ts";

test("technical query inventory is explicit and excludes commercial attribution", () => {
  assert.deepEqual(SYNTHETIC_DEBUG_QUERY_PARAMETERS, [
    "lh",
    "mobile_synthetic",
    "webkit_diagnostic",
    "r9_smoke",
  ]);
  assert.deepEqual(COMMERCIAL_ATTRIBUTION_QUERY_PARAMETERS, [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "yclid",
  ]);
  assert.deepEqual(
    SYNTHETIC_DEBUG_QUERY_PARAMETERS.filter((name) =>
      COMMERCIAL_ATTRIBUTION_QUERY_PARAMETERS.includes(
        name as (typeof COMMERCIAL_ATTRIBUTION_QUERY_PARAMETERS)[number],
      ),
    ),
    [],
  );
});

test("technical query detection preserves the complete URL parameter set", () => {
  const parameters = new URLSearchParams(
    "utm_source=yandex&utm_campaign=endoscopy&yclid=paid-click&mobile_synthetic=run-42",
  );
  const before = parameters.toString();

  assert.equal(hasSyntheticDebugQueryParameter(parameters), true);
  assert.equal(parameters.toString(), before);
  assert.equal(parameters.get("utm_source"), "yandex");
  assert.equal(parameters.get("yclid"), "paid-click");
  assert.equal(
    hasSyntheticDebugQueryParameter(
      new URLSearchParams("utm_medium=cpc&yclid=paid-click"),
    ),
    false,
  );
});

test("Next config marks each technical query variant noindex without redirecting", async () => {
  const expectedRules = buildSyntheticDebugQueryHeaderRules();
  const rules = await nextConfig.headers?.();

  for (const expected of expectedRules) {
    const rule = rules?.find(
      (candidate) =>
        candidate.source === expected.source
        && candidate.has?.some(
          (condition) =>
            condition.type === "query"
            && condition.key === expected.has[0]?.key,
        ),
    );
    assert.ok(rule, `missing query hygiene rule for ${expected.has[0]?.key}`);
    const headers = new Map(rule.headers.map(({ key, value }) => [key, value]));
    assert.equal(headers.get("X-Robots-Tag"), SYNTHETIC_DEBUG_ROBOTS_DIRECTIVE);
    assert.equal(
      headers.get(QUERY_INDEXING_HYGIENE_HEADER),
      QUERY_INDEXING_HYGIENE_HEADER_VALUE,
    );
  }

  const redirects = await nextConfig.redirects?.();
  for (const name of SYNTHETIC_DEBUG_QUERY_PARAMETERS) {
    assert.equal(
      redirects?.some((rule) => JSON.stringify(rule).includes(name)),
      false,
      `${name} must not be stripped or redirected`,
    );
  }
});

test("homepage, catalog, Product and RFQ metadata keep clean canonicals", async () => {
  const [homepage, catalog, product, request] = await Promise.all([
    readFile("app/page.tsx", "utf8"),
    readFile("app/catalog/page.tsx", "utf8"),
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
    readFile("app/request/page.tsx", "utf8"),
  ]);

  assert.match(homepage, /canonical:\s*["']\/["']/u);
  assert.match(catalog, /canonical:\s*["']\/catalog["']/u);
  assert.match(product, /buildProductSeoMetadataV3/u);
  assert.match(request, /canonical:\s*["']\/request["']/u);
  for (const source of [homepage, catalog, product, request]) {
    assert.doesNotMatch(
      source,
      /mobile_synthetic|webkit_diagnostic|r9_smoke|prod-mobile-debug/u,
    );
  }
});

test("sitemap generation cannot emit synthetic or debug query variants", async () => {
  const source = await readFile("lib/storefront/storefront-sitemap.ts", "utf8");
  assert.doesNotMatch(
    source,
    /mobile_synthetic|webkit_diagnostic|r9_smoke|[?&]lh=/u,
  );
  assert.doesNotMatch(source, /searchParams|URLSearchParams/u);
});
