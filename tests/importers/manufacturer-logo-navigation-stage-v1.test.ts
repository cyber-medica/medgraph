import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import logoReport from "../../docs/reports/all-manufacturer-logos-stage-v1.json" with { type: "json" };
import navigationReport from "../../docs/reports/navigation-breadcrumb-audit-v1.json" with { type: "json" };
import {
  getStorefrontDataSource,
  MANUFACTURER_LOGO_NAVIGATION_PREVIEW_BRANCH,
} from "../../lib/storefront/data-source.ts";
import snapshot from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import { getManufacturerLogoPresentation } from "../../lib/storefront/manufacturer-logo-policy.ts";

const root = process.cwd();
const catalog = mapCloudPublishedCatalogProjection(
  snapshot.projection as unknown as PublishedCatalogProjection,
);

test("Production uses 22 official-source graphics and three fail-closed fallbacks", async () => {
  const counts = new Map<string, number>();
  for (const product of catalog.products) {
    counts.set(product.manufacturerId, (counts.get(product.manufacturerId) ?? 0) + 1);
  }
  const publicManufacturers = catalog.manufacturers
    .filter(({ id }) => counts.has(id))
    .sort((left, right) => left.slug.localeCompare(right.slug));

  assert.equal(publicManufacturers.length, 25);
  assert.equal(logoReport.manufacturers.length, 25);
  assert.equal(logoReport.graphicLogos, 25);
  assert.equal(logoReport.externalRuntimeLogoUrls, 0);

  for (const manufacturer of publicManufacturers) {
    const entry = logoReport.manufacturers.find(({ slug }) => slug === manufacturer.slug);
    assert.ok(entry);
    assert.equal(entry.productCount, counts.get(manufacturer.id));
    assert.match(entry.assetPath, /^\/manufacturers\//u);
    assert.doesNotMatch(entry.assetPath, /^https?:/u);

    const presentation = getManufacturerLogoPresentation(manufacturer);
    if (!entry.officialSource) {
      assert.equal(presentation.kind, "fallback");
      assert.equal(presentation.assetUrl, null);
      continue;
    }
    assert.equal(presentation.kind, "graphic");
    assert.equal(presentation.assetUrl, entry.assetPath);
    assert.equal(presentation.opticalScale, entry.opticalScale);

    const body = await readFile(resolve(root, `public${entry.assetPath}`));
    assert.equal(createHash("sha256").update(body).digest("hex"), entry.sha256);
    if (entry.assetPath.endsWith(".svg")) {
      const svg = body.toString("utf8");
      assert.doesNotMatch(svg, /<script|javascript:|<foreignObject/iu);
      assert.doesNotMatch(svg, /(?:href|src)=["']https?:/iu);
    }
  }

  assert.deepEqual(
    logoReport.manufacturers.filter(({ officialSource }) => !officialSource).map(({ slug }) => slug),
    ["hamilton-medical", "mindray", "unicos"],
  );
});

test("the exact logo Stage branch uses the tracked published snapshot without weakening Production", () => {
  assert.equal(getStorefrontDataSource({
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: MANUFACTURER_LOGO_NAVIGATION_PREVIEW_BRANCH,
  }), "cloud_preview");
  assert.equal(getStorefrontDataSource({
    VERCEL: "1",
    VERCEL_ENV: "preview",
    CYBERMEDICA_MANUFACTURER_LOGO_STAGE: "1",
  }), "cloud_preview");
  assert.equal(getStorefrontDataSource({
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: MANUFACTURER_LOGO_NAVIGATION_PREVIEW_BRANCH,
    CATALOG_DATA_SOURCE: "cloud_published",
  }), "cloud_published");
});

test("the shared breadcrumb core is semantic, compact and server-renderable", async () => {
  const [component, product, manufacturer, catalogPage, manufacturersPage, seo] = await Promise.all([
    readFile("components/navigation/Breadcrumbs.tsx", "utf8"),
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
    readFile("app/manufacturers/[slug]/page.tsx", "utf8"),
    readFile("app/catalog/page.tsx", "utf8"),
    readFile("app/manufacturers/page.tsx", "utf8"),
    readFile("components/seo/SeoLandingPage.tsx", "utf8"),
  ]);

  assert.doesNotMatch(component, /"use client"/u);
  assert.match(component, /<nav[\s\S]*aria-label="Хлебные крошки"/u);
  assert.match(component, /<ol/u);
  assert.match(component, /aria-current="page"/u);
  assert.match(component, /focus-visible/u);
  assert.match(component, /truncate/u);
  for (const source of [product, manufacturer, catalogPage, manufacturersPage, seo]) {
    assert.match(source, /<Breadcrumbs/u);
  }
});

test("legacy and duplicate public navigation patterns are absent", async () => {
  const files = [
    "app/catalog/[slug]/page.tsx",
    "app/catalog/page.tsx",
    "app/manufacturers/[slug]/page.tsx",
    "app/manufacturers/page.tsx",
    "components/seo/SeoLandingPage.tsx",
    "components/catalog/BackToCatalog.tsx",
  ];
  const sources = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(sources, /Назад к каталогу|← Все производители|Кибермедика · Каталог/iu);
  assert.equal(navigationReport.duplicateNavigationRemaining, 0);
  assert.equal(navigationReport.breadcrumbListConsistent, true);
});
