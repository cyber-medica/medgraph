import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getProductPresentation } from "../../lib/storefront/product-presentation.ts";
import { sanitizeStorefrontHtml } from "../../lib/storefront/sanitize-html.ts";
import type { Product } from "../../lib/storefront/types.ts";

async function source(path: string) {
  return readFile(path, "utf8");
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "product",
    slug: "product",
    manufacturerId: "manufacturer",
    categoryId: "category",
    name: "Product",
    model: "Model 1",
    shortDescription: "<p>Краткое <strong>описание</strong></p>",
    description: "<p>Полное описание</p>",
    status: "preview_draft",
    catalogQualityStatus: "READY",
    featured: false,
    applicationAreas: [],
    keyFeatures: [],
    specifications: [],
    media: [],
    documents: [],
    registrationRecords: [],
    compatibility: [],
    relatedProductIds: [],
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

test("product presentation exposes optional hero values without public fallbacks", () => {
  const complete = getProductPresentation(product(), {
    categoryName: "Мониторы пациента",
    country: "DE",
    manufacturerName: "Dräger",
  });
  assert.equal(complete.category, "Мониторы пациента");
  assert.equal(complete.country, "Германия");
  assert.equal(complete.manufacturer, "Dräger");
  assert.equal(complete.model, "Model 1");
  assert.equal(complete.shortDescription, "Краткое описание");

  const incomplete = getProductPresentation(product({
    catalogQualityStatus: "REQUIRES_EDITOR_REVIEW",
    model: "Не указан",
  }));
  assert.equal(incomplete.model, null);
  assert.equal(incomplete.canRequestQuote, false);
  assert.equal(incomplete.canCompare, false);
  assert.equal(incomplete.statusLabel, "Информация о товаре уточняется");
});

test("product hero is compact and does not repeat quality or missing metadata", async () => {
  const page = await source("app/catalog/[slug]/page.tsx");
  assert.match(page, /minmax\(0,40fr\)_minmax\(0,60fr\)/u);
  assert.doesNotMatch(page, /presentation\.state|presentation\.statusLabel/u);
  assert.doesNotMatch(page, /label="Статус"/u);
  assert.doesNotMatch(page, /PRODUCT_PRESENTATION_FALLBACKS\.registration/u);
  assert.match(page, /buildProductDetailExperience/u);
  assert.match(page, /experience\.badges/u);
  assert.match(page, /<dt className="sr-only">\{label\}<\/dt>/u);
  assert.doesNotMatch(page, /presentation\.model/u);
  assert.match(page, /data-testid="product-hero-summary"/u);
  assert.match(page, /line-clamp-4/u);
  assert.match(page, /flex min-w-0 flex-col justify-start/u);
});

test("optional content remains fail-closed with navigation limited to public product sections", async () => {
  const [page, experience] = await Promise.all([
    source("app/catalog/[slug]/page.tsx"),
    source("lib/storefront/product-detail-experience.ts"),
  ]);
  assert.match(page, /sectionLinks\.length/u);
  assert.match(page, /aria-label="Навигация по странице товара"/u);
  assert.doesNotMatch(page, /href: "#documents"/u);
  for (const section of [
    "package",
    "documents",
    "compatibility",
    "relatedProducts",
  ]) {
    assert.match(page, new RegExp(`presentation\\.sections\\.${section}`, "u"));
  }
  assert.match(page, /experience\.description/u);
  assert.match(page, /experience\.advantages/u);
  assert.match(page, /technicalSpecifications\.length > 0/u);
  assert.match(experience, /product\.specifications/u);
  assert.match(experience, /isTechnicalProductSpecification/u);
  assert.match(experience, /TECHNICAL_METADATA_LABELS/u);
  assert.match(experience, /"тип товара"/u);
  assert.match(page, /technicalSpecifications\.length > 0/u);
  assert.doesNotMatch(page, /Информация отсутствует/u);
});

test("imported description cleanup remains sanitizing and content-preserving", () => {
  const html = sanitizeStorefrontHtml(
    '<script>alert(1)</script><p> </p><h2>Описание</h2><h2>Описание</h2><p><b>Текст</b></p><ul><li></li><li>Пункт</li></ul>',
  );
  assert.doesNotMatch(html, /script|alert/u);
  assert.equal((html.match(/<h2>Описание<\/h2>/gu) ?? []).length, 1);
  assert.doesNotMatch(html, /<p>\s*<\/p>|<li>\s*<\/li>|<b>/u);
  assert.match(html, /<strong>Текст<\/strong>/u);
  assert.match(html, /<li>Пункт<\/li>/u);
});

test("storefront footer is compact and contains no build metadata", async () => {
  const footer = await source("components/home/Footer.tsx");
  assert.doesNotMatch(footer, /packageJson|Build preview|Данные обновлены|Version/u);
  assert.match(footer, /py-6/u);
  assert.match(footer, /text-white\/7/u);
});
