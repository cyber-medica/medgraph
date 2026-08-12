import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getProductPresentation,
  PRODUCT_PRESENTATION_FALLBACKS,
  publicOptionalText,
} from "../../lib/storefront/product-presentation.ts";
import type { Product } from "../../lib/storefront/types.ts";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "product",
    slug: "product",
    manufacturerId: "mindray",
    categoryId: "ventilators",
    name: "Mindray SV300",
    model: "SV300",
    shortDescription: "Аппарат искусственной вентиляции лёгких.",
    description: "Подробное описание.",
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

test("READY product receives the complete commercial action contract", () => {
  const presentation = getProductPresentation(product(), {
    categoryName: "Аппараты ИВЛ",
    country: "Китай",
    manufacturerName: "Mindray",
  });

  assert.equal(presentation.state, "commercial_ready");
  assert.equal(presentation.canRequestQuote, true);
  assert.equal(presentation.canCompare, true);
  assert.equal(presentation.statusLabel, "Доступно для запроса");
  assert.equal(presentation.manufacturerLabel, "Mindray");
  assert.equal(presentation.categoryLabel, "Аппараты ИВЛ");
  assert.equal(presentation.modelLabel, "SV300");
});

test("incomplete products fail closed without exposing quality reasons", () => {
  for (const incomplete of [
    product({ catalogQualityStatus: "REQUIRES_EDITOR_REVIEW" }),
    product({ model: "Не указан" }),
    product({ manufacturerId: "cloud-preview-manufacturer-unassigned" }),
    product({ categoryId: "cloud-preview-category-unassigned" }),
  ]) {
    const presentation = getProductPresentation(incomplete);
    assert.equal(presentation.state, "information_incomplete");
    assert.equal(presentation.canRequestQuote, false);
    assert.equal(presentation.canCompare, false);
    assert.equal(presentation.statusLabel, "Информация о товаре уточняется");
    assert.doesNotMatch(JSON.stringify(presentation), /REQUIRES_EDITOR_REVIEW|cloud-preview-/u);
  }
});

test("missing identity and media use one neutral public policy", () => {
  const presentation = getProductPresentation(product({ model: "Не указан" }));

  assert.equal(presentation.manufacturerLabel, PRODUCT_PRESENTATION_FALLBACKS.manufacturer);
  assert.equal(presentation.categoryLabel, PRODUCT_PRESENTATION_FALLBACKS.category);
  assert.equal(presentation.countryLabel, PRODUCT_PRESENTATION_FALLBACKS.country);
  assert.equal(presentation.modelLabel, PRODUCT_PRESENTATION_FALLBACKS.model);
  assert.equal(presentation.mediaFallbackLabel, PRODUCT_PRESENTATION_FALLBACKS.media);
});

test("generated placeholder copy is omitted without changing source data", () => {
  const source = product({
    shortDescription: "Описание добавляется.",
    description: "<p>Описание добавляется.</p>",
  });
  const presentation = getProductPresentation(source);

  assert.equal(presentation.shortDescription, null);
  assert.equal(presentation.description, null);
  assert.equal(presentation.sections.description, false);
  assert.equal(source.shortDescription, "Описание добавляется.");
  assert.equal(source.description, "<p>Описание добавляется.</p>");
  assert.equal(publicOptionalText("Фактическое описание"), "Фактическое описание");
});

test("optional sections are visible only when existing data supports them", () => {
  const empty = getProductPresentation(product());
  assert.deepEqual(empty.sections, {
    advantages: false,
    compatibility: false,
    description: true,
    documents: false,
    package: false,
    relatedProducts: false,
    specifications: false,
  });

  const populated = getProductPresentation(product({
    keyFeatures: ["Компактный корпус"],
    specifications: [{
      group: "Основные",
      label: "Масса",
      value: "10",
      unit: "кг",
      position: 1,
    }],
    documents: [{
      title: "Комплектация",
      kind: "accessories",
      publicUrl: "https://example.com/accessories.pdf",
      language: "ru",
      isOfficial: true,
    }],
    compatibility: [{ compatibleProductId: null, label: "Контур", note: "" }],
    relatedProductIds: ["related"],
  }));

  assert.equal(populated.sections.advantages, true);
  assert.equal(populated.sections.specifications, true);
  assert.equal(populated.sections.documents, true);
  assert.equal(populated.sections.package, true);
  assert.equal(populated.sections.compatibility, true);
  assert.equal(populated.sections.relatedProducts, true);
});

test("public product surfaces consume the shared presentation contract", async () => {
  const sources = await Promise.all([
    "app/catalog/[slug]/page.tsx",
    "app/manufacturers/[slug]/page.tsx",
    "components/storefront/ProductCard.tsx",
    "components/search/SearchExperience.tsx",
  ].map((path) => readFile(path, "utf8")));

  for (const source of [sources[0], sources[2], sources[3]]) {
    assert.match(source, /getProductPresentation/u);
  }
  assert.match(sources[1], /<ProductCard/u);
  assert.match(sources[0], /presentation\.canRequestQuote/u);
  assert.match(sources[0], /presentation\.sections\.documents/u);
  assert.doesNotMatch(sources[1], /presentation\.canCompare/u);
  assert.match(sources[2], /presentation\.mediaFallbackLabel/u);
});
