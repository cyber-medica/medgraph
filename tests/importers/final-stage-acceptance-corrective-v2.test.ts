import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import audit from "../../data/import/final-stage-acceptance-v2-audit.json" with { type: "json" };
import publishedCatalog from "../../data/import/endomarket-stage-published-catalog.json" with { type: "json" };
import stageSnapshot from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };
import canonicalSnapshot from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import { getSeoLandingV3, type SeoLandingPath } from "../../lib/seo/implementation-v3.ts";
import type { CatalogRepository } from "../../lib/storefront/catalog-repository.ts";
import { mapCloudPreviewSnapshot, type CloudPreviewCatalogSnapshot } from "../../lib/storefront/cloud-preview-mapper.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import { composeEndoMarketStageCatalog } from "../../lib/storefront/endomarket-stage-catalog.ts";
import {
  applyFinalStageAcceptanceCorrectiveV2,
  COMEN_CM1200B_PRODUCT_ID,
  HAMILTON_T1_PRODUCT_ID,
} from "../../lib/storefront/final-stage-acceptance-corrective-v2.ts";
import { ManufacturerService } from "../../lib/storefront/manufacturer-service.ts";
import { filterPublicManufacturers } from "../../lib/storefront/public-discovery.ts";
import { buildStorefrontSitemapFromCatalog } from "../../lib/storefront/storefront-sitemap.ts";
import type { StorefrontCatalog } from "../../lib/storefront/types.ts";

const FAQ_PATHS: readonly SeoLandingPath[] = [
  "/catalog/endoskopiya",
  "/catalog/endoskopiya/videoendoskopicheskie-sistemy",
  "/solutions/portativnaya-bronkhoskopiya",
  "/catalog/endoskopiya/obrabotka-endoskopov",
  "/catalog/reanimatsiya/transportnye-apparaty-ivl",
  "/catalog/anesteziologiya/narkozno-dykhatelnye-apparaty",
];

const before = composeEndoMarketStageCatalog(
  publishedCatalog as StorefrontCatalog,
  mapCloudPreviewSnapshot(stageSnapshot as unknown as CloudPreviewCatalogSnapshot),
);
const canonical = mapCloudPublishedCatalogProjection(
  canonicalSnapshot.projection as unknown as PublishedCatalogProjection,
);
const after = applyFinalStageAcceptanceCorrectiveV2(before, canonical);

test("zero-public-Product manufacturers are absent from discovery and direct lookup", async () => {
  const publicManufacturers = filterPublicManufacturers(before.manufacturers, before.products);
  const zeroManufacturers = before.manufacturers.filter(
    ({ id }) => !publicManufacturers.some((manufacturer) => manufacturer.id === id),
  );
  assert.equal(before.manufacturers.length, 31);
  assert.equal(publicManufacturers.length, 19);
  assert.deepEqual(zeroManufacturers.map(({ name }) => name), [
    "Ambu", "AOHUA", "Биотех-М", "Dräger", "HUGER", "Philips",
    "BOWA", "ERBE", "iLivTouch", "Medinova", "MET", "ZERTS",
  ]);

  const repository = {
    getManufacturers: async () => before.manufacturers,
    getActiveProducts: async () => before.products,
  } as unknown as CatalogRepository;
  const service = new ManufacturerService(repository);
  assert.deepEqual(await service.getManufacturers(), publicManufacturers);
  for (const manufacturer of zeroManufacturers) {
    assert.equal(await service.getManufacturerBySlug(manufacturer.slug), null);
  }

  const [manufacturerPage, proxy, manufacturerExistence] = await Promise.all([
    readFile("app/manufacturers/[slug]/page.tsx", "utf8"),
    readFile("proxy.ts", "utf8"),
    readFile("lib/storefront/manufacturer-slug-existence.server.ts", "utf8"),
  ]);
  assert.match(manufacturerPage, /if \(!manufacturer\) notFound\(\)/u);
  assert.match(proxy, /"\/manufacturers\/:slug"/u);
  assert.match(proxy, /readPublicManufacturerSlugExistence/u);
  assert.match(proxy, /existence === "missing"[\s\S]*status: 404/u);
  assert.match(manufacturerExistence, /filterPublicManufacturers/u);
  assert.match(manufacturerExistence, /transport failure is not evidence/iu);
});

test("zero-product manufacturers and absent suppliers cannot enter sitemap", async () => {
  const sitemap = buildStorefrontSitemapFromCatalog({
    products: before.products,
    manufacturers: before.manufacturers,
    categories: before.categories,
  });
  const urls = sitemap.map(({ url }) => url);
  const publicProductUrls = new Set(
    before.products
      .filter(({ status }) => status === "active" || status === "on_request")
      .map(({ slug }) => `https://cyber-medica.ru/catalog/${slug}`),
  );
  assert.equal(urls.filter((url) => publicProductUrls.has(url)).length, 71);
  for (const manufacturer of audit.zeroProductEntities.zeroProductManufacturers) {
    assert.equal(urls.some((url) => url.endsWith(`/manufacturers/${manufacturer.slug}`)), false);
  }
  assert.equal(urls.some((url) => url.includes("/suppliers/")), false);
  await assert.rejects(() => readFile("app/suppliers/page.tsx", "utf8"));
});

test("Hamilton-T1 canonical body is restored without SEO, specification or application drift", () => {
  const previousById = new Map(before.products.map((product) => [product.id, product]));
  const canonicalHamilton = canonical.products.find(({ id }) => id === HAMILTON_T1_PRODUCT_ID);
  const hamilton = after.products.find(({ id }) => id === HAMILTON_T1_PRODUCT_ID);
  assert.ok(canonicalHamilton && hamilton);
  assert.equal(hamilton.description, canonicalHamilton.description);
  assert.equal(hamilton.shortDescription, canonicalHamilton.shortDescription);
  assert.equal(audit.contentIntegrity.hamiltonCanonicalBodyFingerprint, "a313f8213963e59aaaf2a2b2b30e2b8e8dadaa3b3dfed0543221fbc0cb583d39");

  for (const product of after.products) {
    const previous = previousById.get(product.id);
    assert.ok(previous);
    assert.deepEqual(product.specifications, previous.specifications, product.slug);
    assert.deepEqual(product.applicationAreas, previous.applicationAreas, product.slug);
    assert.equal(product.seoTitle, previous.seoTitle, product.slug);
    assert.equal(product.seoDescription, previous.seoDescription, product.slug);
    if (product.id !== HAMILTON_T1_PRODUCT_ID) {
      assert.equal(product.description, previous.description, product.slug);
      assert.equal(product.shortDescription, previous.shortDescription, product.slug);
    }
  }
  assert.equal(audit.contentIntegrity.unintendedRegressionsRemaining, 0);
});

test("all 114 Products pass semantic feature completeness without placeholders or duplicates", () => {
  assert.equal(audit.keyFeatures.products.length, 114);
  assert.equal(audit.keyFeatures.products.every(({ verdict }) => verdict === "PASS"), true);
  assert.equal(audit.keyFeatures.hiddenMeaningfulFeatureSectionsRemaining, 0);
  assert.equal(audit.keyFeatures.inventedClaims, 0);

  const beforeById = new Map(before.products.map((product) => [product.id, product]));
  for (const product of after.products) {
    assert.equal(product.keyFeatures.every((feature) => feature.trim().length > 0), true, product.slug);
    assert.equal(new Set(product.keyFeatures).size, product.keyFeatures.length, product.slug);
    const previous = beforeById.get(product.id);
    assert.ok(previous);
    if (previous.keyFeatures.length === 0) {
      assert.equal(product.keyFeatures.every((feature) => feature.length <= 90), true, product.slug);
    }
  }

  const cm1200b = after.products.find(({ id }) => id === COMEN_CM1200B_PRODUCT_ID);
  assert.deepEqual(cm1200b?.keyFeatures, [
    "Автоматический, ручной и ритм-режимы ЭКГ",
    "Память до 300 записей ЭКГ",
    "Дисплей 5,6″",
    "Передача данных через USB",
  ]);
});

test("all six SEO FAQ contracts retain non-empty answers and an accessible visible toggle", async () => {
  for (const path of FAQ_PATHS) {
    const content = getSeoLandingV3(path);
    assert.ok(content.faq.length > 0, path);
    assert.equal(
      content.faq.every(([question, answer]) => question.trim() && answer.trim()),
      true,
      path,
    );
  }
  const source = await readFile("components/seo/SeoLandingPage.tsx", "utf8");
  assert.match(source, /<details[^>]*open=\{index === 0\}/u);
  assert.match(source, /<summary[^>]*min-h-11/u);
  assert.match(source, /group-open:rotate-45/u);
  assert.match(source, /aria-hidden="true"/u);
  assert.equal(audit.faq.routesAudited, 6);
});
