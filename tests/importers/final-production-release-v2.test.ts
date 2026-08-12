import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import releaseManifest from "../../data/releases/final-production-release-v2-manifest.json" with { type: "json" };
import acceptedStageAudit from "../../data/import/final-stage-acceptance-v2-audit.json" with { type: "json" };
import publishedCatalogSnapshot from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import {
  LEGACY_TILDA_PRODUCT_REDIRECTS,
  resolveLegacyProductionRedirect,
} from "../../lib/seo/legacy-production-redirects.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import { applyFinalStageAcceptanceCorrectiveV2 } from "../../lib/storefront/final-stage-acceptance-corrective-v2.ts";
import { filterPublicManufacturers } from "../../lib/storefront/public-discovery.ts";
import { buildStorefrontSitemapFromCatalog } from "../../lib/storefront/storefront-sitemap.ts";

const origin = "https://cyber-medica.ru";

test("release manifest preserves exact accepted linear ancestry", () => {
  assert.equal(releaseManifest.version, "final-production-release-v2");
  assert.equal(releaseManifest.base, "380bb33a804c8dfc4f3333f8fb5acf211bd56c3b");
  assert.equal(releaseManifest.components.every(({ status }) => status === "integrated"), true);
  const synthetic = releaseManifest.components.find(({ component }) => component === "catalog-production-synthetic");
  assert.equal(synthetic?.sourceCommit, "d21eedf5d5c3c0fe99834415845996fcc7a649b3");
  assert.equal(synthetic?.integratedCommit, "e199a574fa5a40b9ee1d4ecb16e3d2cb3a17207d");
  assert.equal(synthetic?.patchId, "a562270718854ee5c033a9ae743676e7ba132a65");
});

test("three exact Tilda Product URLs redirect one hop to exact canonical Products", () => {
  assert.equal(LEGACY_TILDA_PRODUCT_REDIRECTS.size, 3);
  for (const [source, destination] of LEGACY_TILDA_PRODUCT_REDIRECTS) {
    assert.equal(resolveLegacyProductionRedirect(new URL(source, origin)), destination);
    assert.match(destination, /^\/catalog\/767632362-/u);
    assert.doesNotMatch(destination, /\/tproduct\//u);
  }
});

test("recognized legacy brand filters normalize and unsupported filters clean to catalog", () => {
  const redirect = (query: string) => resolveLegacyProductionRedirect(
    new URL(`/catalog?${query}`, origin),
  );
  assert.equal(redirect("tfc_brand%5B767632362%5D=Mindray"), "/manufacturers/mindray");
  assert.equal(redirect("tfc_brand%5B767632362%5D=Pentax"), "/manufacturers/pentax-medical");
  assert.equal(redirect("tfc_brand%5B767632362%5D=General+Electric"), "/manufacturers/ge-healthcare");
  assert.equal(redirect("tfc_brand%5B767632362%5D=GE"), "/manufacturers/ge-healthcare");
  assert.equal(redirect("tfc_charact%3A168428%5B767632362%5D=Рентгенология"), "/catalog");
  assert.equal(
    redirect("tfc_brand%5B767632362%5D=Mindray&tfc_charact%3A168428%5B767632362%5D=Рентгенология"),
    "/catalog",
  );
  assert.equal(resolveLegacyProductionRedirect(new URL("/catalog?query=Mindray", origin)), null);
});

test("proxy owns legacy redirects as real 301 responses before route existence checks", async () => {
  const proxy = await readFile("proxy.ts", "utf8");
  const redirect = proxy.indexOf("resolveLegacyProductionRedirect(request.nextUrl)");
  const manufacturerGuard = proxy.indexOf("const manufacturerSlug =");
  assert.ok(redirect >= 0 && redirect < manufacturerGuard);
  assert.match(proxy, /NextResponse\.redirect\([\s\S]+?301/u);
  assert.match(proxy, /"\/catalog\/tproduct\/:path\*"/u);
  assert.match(proxy, /"\/catalog"/u);
  const canonicalCatalogPassThrough = proxy.indexOf(
    'request.nextUrl.pathname === "/catalog"',
  );
  const internalAuth = proxy.indexOf("createInternalAuthRouteClient(request)");
  assert.ok(
    canonicalCatalogPassThrough >= 0 && canonicalCatalogPassThrough < internalAuth,
    "canonical /catalog must pass through before internal Auth",
  );
});

test("Production-shaped release keeps 114 Products and derives the actual public graph", () => {
  const canonicalCatalog = mapCloudPublishedCatalogProjection(
    publishedCatalogSnapshot.projection as unknown as PublishedCatalogProjection,
  );
  const releasedCatalog = applyFinalStageAcceptanceCorrectiveV2(
    canonicalCatalog,
    canonicalCatalog,
  );
  const acceptedFeatures = new Map(
    acceptedStageAudit.keyFeatures.products.map((product) => [
      product.slug,
      product.evidence.map(({ feature }) => feature),
    ]),
  );

  assert.equal(releasedCatalog.products.length, 114);
  assert.equal(acceptedFeatures.size, 114);
  assert.equal(
    releasedCatalog.products.filter(({ keyFeatures }) => keyFeatures.length > 0).length,
    79,
  );
  for (const product of releasedCatalog.products) {
    assert.deepEqual(product.keyFeatures, acceptedFeatures.get(product.slug), product.slug);
  }

  const publicManufacturers = filterPublicManufacturers(
    releasedCatalog.manufacturers,
    releasedCatalog.products,
  );
  assert.equal(publicManufacturers.length, 25);
  assert.deepEqual(
    releasedCatalog.manufacturers
      .filter(({ id }) => !publicManufacturers.some((manufacturer) => manufacturer.id === id))
      .map(({ name }) => name),
    ["Ambu", "AOHUA", "Биотех-М", "Dräger", "HUGER", "Philips"],
  );
  const sitemap = buildStorefrontSitemapFromCatalog(releasedCatalog);
  assert.equal(sitemap.length, 114 + 25 + 3 + 6);
  assert.equal(new Set(sitemap.map(({ url }) => url)).size, sitemap.length);
  assert.equal(
    sitemap.some(({ url }) => /(?:tproduct|tfc_|stage\.|vercel\.app)/iu.test(url)),
    false,
  );
});
