import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("product page keeps one H1 and removes duplicated technical headings", async () => {
  const product = await source("app/catalog/[slug]/page.tsx");

  assert.equal((product.match(/<h1\b/gu) ?? []).length, 1);
  assert.doesNotMatch(product, /title="Изделие"|>Изделие</u);
  assert.doesNotMatch(product, /Основная информация|>Product</u);
});

test("product hero contains the key commercial information", async () => {
  const [product, experience, manufacturer] = await Promise.all([
    source("app/catalog/[slug]/page.tsx"),
    source("lib/storefront/product-detail-experience.ts"),
    source("components/catalog/ProductManufacturer.tsx"),
  ]);

  assert.match(product, /aria-label="Ключевая информация о товаре"/u);
  assert.match(product, /<dt className="sr-only">\{label\}<\/dt>/u);
  assert.match(product, /hasRegulatoryInformation/u);
  assert.doesNotMatch(product, /label="Страна производства"/u);
  assert.doesNotMatch(product, /label="Модель \/ артикул"/u);
  assert.doesNotMatch(product, /label="Статус"/u);
  assert.match(product, /<ProductGallery\s+media=\{product\.media\}/u);
  assert.match(product, /href="\/compare"/u);
  assert.match(experience, /`\/manufacturers\/\$\{manufacturer\.slug\}`/u);
  assert.match(manufacturer, /`\/manufacturers\/\$\{manufacturer\.slug\}`/u);
});

test("optional product sections are omitted when public data is absent", async () => {
  const product = await source("app/catalog/[slug]/page.tsx");

  assert.match(product, /experience\.advantages/u);
  assert.match(product, /technicalSpecifications\.length > 0/u);
  assert.match(product, /presentation\.sections\.documents/u);
  assert.match(product, /presentation\.sections\.compatibility/u);
  assert.match(product, /presentation\.sections\.relatedProducts/u);
  assert.doesNotMatch(product, /ListEmptyWhen/u);
});

test("catalog cards use real Storefront fields and expose useful journeys", async () => {
  const catalog = await source("components/storefront/ProductCard.tsx");

  assert.doesNotMatch(catalog, /isTechnicalProductSpecification|cardSpecifications/u);
  assert.match(catalog, /product\.media/u);
  assert.match(catalog, /`\/catalog\/\$\{product\.slug\}`/u);
  assert.match(catalog, /`\/manufacturers\/\$\{/u);
  assert.match(catalog, /href="\/compare"/u);
  assert.doesNotMatch(catalog, /\bprice\b|скидк|рейтинг|\bналичие\b/iu);
});

test("UX polish does not change product canonical or JSON-LD", async () => {
  const product = await source("app/catalog/[slug]/page.tsx");

  assert.match(product, /buildProductSeoMetadataV3/u);
  assert.match(product, /<JsonLd/u);
  assert.match(product, /buildProductStructuredData\(\{ product, manufacturer, category \}\)/u);
});
