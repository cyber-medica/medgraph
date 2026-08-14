import assert from "node:assert/strict";
import test from "node:test";

import publishedSnapshotJson from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import nextConfig from "../../next.config.ts";
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import { getProductSeoH1 } from "../../lib/seo/implementation-v3.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import {
  getStorefrontDataSource,
  isProductStructuredDataGscStagePreview,
} from "../../lib/storefront/data-source.ts";
import { STOREFRONT_SITE_URL } from "../../lib/storefront/seo.ts";
import { buildStorefrontSitemapFromCatalog } from "../../lib/storefront/storefront-sitemap.ts";
import { buildProductStructuredData } from "../../lib/storefront/structured-data.ts";

const projection = publishedSnapshotJson.projection as unknown as PublishedCatalogProjection;
const catalog = mapCloudPublishedCatalogProjection(projection);
const categories = new Map(catalog.categories.map((entry) => [entry.id, entry]));

const legacyProductPaths = {
  "/catalog/videoendoskopicheskaya-sistema-sonoscape-hd-500":
    "/catalog/767632362-697047413241-videoendoskopicheskaya-sistema-sonoscape",
  "/catalog/videoendoskopicheskaya-sistema-sonoscape-hd-350":
    "/catalog/767632362-776712772161-videoendoskopicheskaya-sistema-sonoscape",
} as const;

test("all 114 published Product Detail pages use one truthful MedicalDevice ItemPage contract", () => {
  assert.equal(catalog.products.length, 114);
  let sanitizedDescriptionCount = 0;

  for (const product of catalog.products) {
    const category = categories.get(product.categoryId);
    assert.ok(category, product.slug);
    const pageName = getProductSeoH1(product);
    const [itemPage, breadcrumb] = buildProductStructuredData({
      product,
      category,
      breadcrumbName: pageName,
    });
    const mainEntity = itemPage.mainEntity as Record<string, unknown>;
    const description = String(itemPage.description);
    const sourceRow = projection.products.find(({ slug }) => slug === product.slug);
    assert.ok(sourceRow, product.slug);
    if (/<[^>]+>/u.test(sourceRow.description ?? "")) sanitizedDescriptionCount += 1;

    assert.equal(itemPage["@type"], "ItemPage", product.slug);
    assert.equal(itemPage.name, pageName, product.slug);
    assert.equal(itemPage.url, `${STOREFRONT_SITE_URL}/catalog/${product.slug}`, product.slug);
    assert.equal(mainEntity["@type"], "MedicalDevice", product.slug);
    assert.equal(mainEntity.name, pageName, product.slug);
    assert.doesNotMatch(description, /<[^>]+>|&(?:nbsp|amp|lt|gt|quot|apos);/iu, product.slug);
    assert.equal(breadcrumb["@type"], "BreadcrumbList", product.slug);

    const imageUrls = mainEntity.image as string[];
    assert.ok(imageUrls.length > 0, product.slug);
    assert.ok(
      imageUrls.every((value) => new URL(value).origin === STOREFRONT_SITE_URL),
      product.slug,
    );

    const serialized = JSON.stringify(itemPage);
    assert.doesNotMatch(
      serialized,
      /"@type":"Product"|"(?:offers|price|priceCurrency|availability|review|aggregateRating|ratingValue|manufacturer|brand|model|sku|gtin|mpn|category|identifier)"/u,
      product.slug,
    );
    assert.doesNotMatch(serialized, /stage\.cyber-medica\.ru|\.vercel\.app|medvist\.ru/iu, product.slug);
  }

  assert.equal(sanitizedDescriptionCount, 3);
});

test("GSC Preview is exact-branch, 114-Product and cannot widen Production", async () => {
  const exactPreview = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "codex/product-structured-data-gsc-corrective-v1",
  };
  assert.equal(isProductStructuredDataGscStagePreview(exactPreview), true);
  assert.equal(getStorefrontDataSource(exactPreview), "cloud_preview");
  assert.equal(isProductStructuredDataGscStagePreview({
    ...exactPreview,
    VERCEL_ENV: "production",
    CYBERMEDICA_STRUCTURED_DATA_GSC_STAGE: "1",
  }), false);

  const [pageSource, repositorySource] = await Promise.all([
    import("node:fs/promises").then(({ readFile }) => readFile("app/catalog/[slug]/page.tsx", "utf8")),
    import("node:fs/promises").then(({ readFile }) => readFile("lib/storefront/cloud-preview-catalog-repository.ts", "utf8")),
  ]);
  assert.match(pageSource, /isProductStructuredDataGscStagePreview\(\)/u);
  assert.match(repositorySource, /publishedCatalogSnapshotJson\.projection/u);
  assert.match(repositorySource, /isProductStructuredDataGscStagePreview\(\)/u);
});

test("HD-500 and HD-350 legacy assumptions redirect once to existing canonical Products", async () => {
  const redirects = await nextConfig.redirects?.();
  assert.ok(redirects);
  const redirectEntries = redirects as Array<{
    source: string;
    destination: string;
    statusCode?: number;
  }>;

  for (const [source, destination] of Object.entries(legacyProductPaths)) {
    const matches = redirectEntries.filter((entry) => entry.source === source);
    assert.equal(matches.length, 1, source);
    assert.equal(matches[0]?.destination, destination, source);
    assert.equal(matches[0]?.statusCode, 301, source);

    const canonicalSlug = destination.split("/").at(-1);
    const product = catalog.products.find(({ slug }) => slug === canonicalSlug);
    assert.ok(product, destination);
    assert.equal(product.status, "active", destination);
  }
});

test("sitemap keeps only canonical HD-500 and HD-350 Product URLs", () => {
  const sitemapUrls = new Set(buildStorefrontSitemapFromCatalog(catalog).map(({ url }) => url));

  for (const [source, destination] of Object.entries(legacyProductPaths)) {
    assert.equal(sitemapUrls.has(`${STOREFRONT_SITE_URL}${source}`), false, source);
    assert.equal(sitemapUrls.has(`${STOREFRONT_SITE_URL}${destination}`), true, destination);
  }
});
