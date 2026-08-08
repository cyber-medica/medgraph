import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import snapshotJson from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };
import auditJson from "../../data/import/endomarket-wave1-audit.json" with { type: "json" };
import mediaAuditJson from "../../data/import/endomarket-media-audit-v4.json" with { type: "json" };
import mediaManifestJson from "../../data/import/endomarket-wave1-media-manifest.json" with { type: "json" };
import correctiveJson from "../../data/import/source/endomarket-business-content-corrective-v4.json" with { type: "json" };
import {
  mapCloudPreviewSnapshot,
  type CloudPreviewCatalogSnapshot,
} from "../../lib/storefront/cloud-preview-mapper.ts";
import {
  ENDOMARKET_STAGE_DRAFT_COUNT,
  ENDOMARKET_STAGE_PUBLISHED_COUNT,
  ENDOMARKET_STAGE_VISIBLE_COUNT,
  composeEndoMarketStageCatalog,
} from "../../lib/storefront/endomarket-stage-catalog.ts";
import {
  ENDOMARKET_STAGE_FEATURED_MODELS,
  selectEndoMarketStageFeaturedProducts,
} from "../../lib/storefront/featured-products.ts";
import { formatCountryForPublic } from "../../lib/storefront/country-presentation.ts";
import type { Product, StorefrontCatalog } from "../../lib/storefront/types.ts";

async function source(path: string) {
  return readFile(path, "utf8");
}

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

const mappedStage = mapCloudPreviewSnapshot(
  snapshotJson as unknown as CloudPreviewCatalogSnapshot,
);

function publishedFixture(): StorefrontCatalog {
  const bindings = mappedStage.products.filter(({ status }) => status === "active");
  assert.equal(bindings.length, 9);
  const template = bindings[0]!;
  const synthetic: Product[] = Array.from({ length: 62 }, (_, index) => ({
    ...template,
    id: `published-fixture-${index + 1}`,
    slug: `published-fixture-${index + 1}`,
    name: `Published fixture ${index + 1}`,
    model: `PUB-${index + 1}`,
    commercialPresentation: undefined,
  }));
  const products = [
    ...bindings.map((product) => ({ ...product, commercialPresentation: undefined })),
    ...synthetic,
  ];
  return {
    products,
    manufacturers: mappedStage.manufacturers,
    categories: mappedStage.categories,
    summary: {
      schemaVersion: 1,
      generatedAt: "2026-08-08T00:00:00.000Z",
      productCount: products.length,
      activeProductCount: products.length,
      manufacturerCount: mappedStage.manufacturers.length,
      categoryCount: mappedStage.categories.length,
    },
  };
}

test("corrective v4 applies exact Product Owner content to all 42 draft Products", () => {
  assert.equal(correctiveJson.version, 4);
  assert.equal(correctiveJson.products.length, 42);
  const drafts = snapshotJson.products.filter(
    ({ stageImport }) => stageImport.entityOrigin === "new_candidate",
  );
  assert.equal(drafts.length, 42);
  const bySlug = new Map(drafts.map((product) => [product.slug, product]));
  let specificationCount = 0;
  let hiddenFeatureSections = 0;

  for (const correction of correctiveJson.products) {
    const product = bySlug.get(correction.candidate_slug);
    assert.ok(product, `Missing v4 Product ${correction.candidate_slug}`);
    assert.equal(product.title, correction.name);
    assert.equal(product.model, correction.model);
    assert.equal(product.shortDescription, correction.short_description);
    assert.equal(product.description, correction.full_description);
    assert.equal(product.seoTitle, correction.seo_title);
    assert.equal(product.seoDescription, correction.seo_description);
    assert.deepEqual(
      product.applicationAreas.map(({ name }) => name),
      correction.application_areas,
    );
    assert.deepEqual(
      product.keyFeatures.map(({ text }) => text),
      correction.presentation.showFeatureSection ? correction.key_features : [],
    );
    const actualSpecifications = product.characteristicGroups.flatMap((group) =>
      group.items.map(({ label, value, unit }) => ({
        name: label,
        value,
        ...(unit ? { unit } : {}),
      })),
    );
    const expectedSpecifications = correction.specifications.flatMap(({ items }) => items);
    assert.deepEqual(actualSpecifications, expectedSpecifications, `${correction.model}: characteristic drift`);
    specificationCount += actualSpecifications.length;
    if (!correction.presentation.showFeatureSection) hiddenFeatureSections += 1;
    assert.equal(product.applicationAreas.some(({ name }) => name.includes("•")), false);
  }

  assert.equal(specificationCount, 128);
  assert.equal(hiddenFeatureSections, 10);
  assert.equal(snapshotJson.summary.sourceSpecifications, 128);
  assert.equal(snapshotJson.summary.hiddenFeatureSections, 10);
  assert.equal(auditJson.businessContentCorrective.version, 4);
  assert.equal(auditJson.businessContentCorrective.csvJsonConsistency, "pass");
  const importedText = drafts.flatMap((product) => [
    product.title,
    product.shortDescription,
    product.description,
    ...product.applicationAreas.map(({ name }) => name),
    ...product.keyFeatures.map(({ text }) => text),
  ]).join("\n");
  assert.doesNotMatch(
    importedText,
    /Анестезиология и реаниматология|Эндоскопические отделения|Диагностические центры|Диагностические кабинеты|Диагностические и лечебные подразделения|Медицинские организации/iu,
  );
  assert.doesNotMatch(
    importedText,
    /Профессиональное медицинское применение|Надежное решение для медицинских учреждений|Используется в клинической практике/iu,
  );
});

test("EG-430 and EC-430T retain exact v4 technical packages", () => {
  const eg430 = snapshotJson.products.find(({ slug }) => slug === "sonoscape-eg-430");
  const ec430t = snapshotJson.products.find(({ slug }) => slug === "sonoscape-ec-430t");
  assert.ok(eg430);
  assert.ok(ec430t);
  assert.equal(eg430.keyFeatures.length, 8);
  assert.equal(eg430.characteristicGroups.flatMap(({ items }) => items).length, 10);
  assert.equal(ec430t.keyFeatures.length, 7);
  assert.equal(ec430t.characteristicGroups.flatMap(({ items }) => items).length, 10);
  assert.ok(ec430t.media.length >= 3);
  assert.equal(mediaAuditJson.requiredChecks.ec430tActualCleanMedia >= 3, true);
});

test("all 51 Stage bindings use clean, local, source-gallery media without fallback", async () => {
  assert.equal(mediaAuditJson.counts.products, 51);
  assert.equal(mediaAuditJson.counts.newDraftProducts, 42);
  assert.equal(mediaAuditJson.counts.existingBindings, 9);
  assert.equal(mediaAuditJson.counts.productsSourceChecked, 51);
  assert.equal(mediaAuditJson.counts.productsWithCleanHero, 51);
  assert.equal(
    mediaAuditJson.counts.productsWithGallery,
    snapshotJson.products.filter(({ media }) => media.length > 1).length,
  );
  assert.equal(mediaAuditJson.counts.productsWithoutUsableCleanMedia, 0);
  assert.equal(mediaAuditJson.counts.nearDuplicateRejected, 0);
  assert.equal(mediaAuditJson.counts.fallbacks, 0);
  assert.equal(mediaAuditJson.requiredChecks.watermarkRuntimeAssets, 0);
  assert.deepEqual(mediaAuditJson.requiredChecks.fallbackProducts, []);
  assert.equal(mediaManifestJson.assets.length, snapshotJson.summary.mediaAssignments);
  assert.equal(snapshotJson.products.every(({ media }) => media.length > 0), true);

  const expectedPaths = new Set(mediaManifestJson.assets.map(({ localPath }) => localPath));
  const diskPaths = new Set(
    (await readdir("public/media/endomarket-wave1"))
      .map((fileName) => `/media/endomarket-wave1/${fileName}`),
  );
  assert.deepEqual(diskPaths, expectedPaths);
  for (const asset of mediaManifestJson.assets) {
    assert.match(asset.localPath, /^\/media\/endomarket-wave1\/[a-f0-9]{24}\.(?:png|webp|gif|jpe?g)$/u);
    assert.match(asset.sourcePageUrl, /^https:\/\/endomarket\.ru\/products\//u);
    assert.match(asset.sourceMediaUrl, /^https:\/\/endomarket\.ru\/files\/products\//u);
    assert.doesNotMatch(new URL(asset.sourceMediaUrl).pathname, /\.(?:1200x1200|420x400|250x250|105x85)w\./iu);
    assert.ok(asset.alt.trim().length > 0);
    const body = await readFile(`public${asset.localPath}`);
    assert.equal(sha256(body), asset.sha256);
    assert.equal(body.byteLength, asset.bytes);
  }
  for (const product of snapshotJson.products) {
    assert.equal(product.media[0]?.role, "hero");
    assert.equal(new Set(product.media.map(({ url }) => url)).size, product.media.length);
  }
});

test("Stage composition preserves 71 published Products, merges nine bindings and adds 42 drafts", () => {
  const composed = composeEndoMarketStageCatalog(publishedFixture(), mappedStage);
  assert.equal(composed.products.length, ENDOMARKET_STAGE_VISIBLE_COUNT);
  assert.equal(
    composed.products.filter(({ status }) => status === "preview_draft").length,
    ENDOMARKET_STAGE_DRAFT_COUNT,
  );
  assert.equal(
    composed.products.filter(({ status }) => status === "active").length,
    ENDOMARKET_STAGE_PUBLISHED_COUNT,
  );
  assert.equal(new Set(composed.products.map(({ id }) => id)).size, 113);
  assert.equal(new Set(composed.products.map(({ slug }) => slug)).size, 113);
  assert.equal(
    composed.products.filter(({ commercialPresentation }) => commercialPresentation?.source === "endomarket").length,
    51,
  );
  assert.equal(composed.summary.productCount, 113);
  assert.equal(composed.summary.activeProductCount, 71);
});

test("Stage composition rejects partial published transport data", () => {
  const published = publishedFixture();
  assert.throws(
    () => composeEndoMarketStageCatalog({ ...published, products: published.products.slice(0, 70) }, mappedStage),
    /published projection must contain 71 Products/u,
  );
});

test("Stage homepage selects the exact eight clean Product cards in approved order", () => {
  const composed = composeEndoMarketStageCatalog(publishedFixture(), mappedStage);
  const selected = selectEndoMarketStageFeaturedProducts(composed.products);
  assert.deepEqual(
    selected.map(({ model }) => model),
    ENDOMARKET_STAGE_FEATURED_MODELS.slice(0, 8),
  );
  assert.equal(selected.length, 8);
  assert.equal(selected.every(({ media }) => media[0]?.url.startsWith("/media/endomarket-wave1/")), true);
});

test("catalog and Product Detail implement final v4 presentation order", async () => {
  const [card, detail, experience, equipment, service] = await Promise.all([
    source("components/storefront/ProductCard.tsx"),
    source("app/catalog/[slug]/page.tsx"),
    source("lib/storefront/product-detail-experience.ts"),
    source("components/home/Equipment.tsx"),
    source("components/home/WhyCyberMedica.tsx"),
  ]);
  assert.doesNotMatch(card, /isTechnicalProductSpecification|cardSpecifications/u);
  assert.match(card, /applicationAreas\.slice\(0, 2\)/u);
  assert.match(card, /\+\{product\.applicationAreas\.length - 2\}/u);
  assert.doesNotMatch(detail, /experience\.applicationAreas\.slice\(0, 2\)/u);
  assert.match(detail, /id="applications" title="Области применения"/u);
  assert.match(detail, /title="Технические характеристики"/u);
  assert.ok(detail.indexOf('id="description"') < detail.indexOf('id="advantages"'));
  assert.ok(detail.indexOf('id="advantages"') < detail.indexOf('id="specifications"'));
  assert.ok(detail.indexOf('id="specifications"') < detail.indexOf('id="applications"'));
  assert.ok(detail.lastIndexOf('id="manufacturer"') > detail.indexOf('id="applications"'));
  assert.doesNotMatch(experience, /applicationAreas\.join/u);
  assert.match(
    equipment,
    /Оборудование для эндоскопии, диагностики и оснащения клиник — в наличии и с рассрочкой 0%\./u,
  );
  assert.match(service, /Гарантийное и постгарантийное обслуживание через сеть профильных сервисных партнеров\./u);
  assert.equal(formatCountryForPublic("Страна не указана"), null);
});

test("v4 corrective remains Stage-only and introduces no Production write boundary", async () => {
  const [script, repository, dataSource] = await Promise.all([
    source("scripts/importers/apply-endomarket-corrective-v4.ts"),
    source("lib/storefront/cloud-preview-catalog-repository.ts"),
    source("lib/storefront/data-source.ts"),
  ]);
  assert.match(repository, /loadCloudPublishedCatalog/u);
  assert.match(repository, /composeEndoMarketStageCatalog/u);
  assert.match(dataSource, /ENDOMARKET_STAGE_PREVIEW_BRANCH/u);
  assert.doesNotMatch(
    script,
    /SUPABASE|service_role|cloud_api|create_product_publication_revision|approve_product|publish_product/iu,
  );
  assert.equal(auditJson.safety.productionWrites, 0);
  assert.equal(auditJson.safety.lifecycleWrites, 0);
  assert.equal(auditJson.safety.migrations, 0);
});
