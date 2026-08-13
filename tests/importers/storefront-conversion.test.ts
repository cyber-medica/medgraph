import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("homepage keeps direct Catalog search category and manufacturer journeys", async () => {
  const files = [
    "components/home/Hero.tsx",
    "components/home/Search.tsx",
    "components/home/Categories.tsx",
    "components/home/FeaturedManufacturers.tsx",
    "components/home/CTA.tsx",
  ];
  const combined = (await Promise.all(files.map(source))).join("\n");

  for (const target of [
    'href="/catalog"',
    'href="/manufacturers"',
    "`/catalog?category=${encodeURIComponent(category.slug)}`",
    "`/manufacturers/${manufacturer.slug}`",
    "`/catalog?q=${encodeURIComponent(query)}`",
  ]) {
    assert.ok(combined.includes(target), target);
  }
  assert.doesNotMatch(combined, /href="\/compare"/u);
});

test("product page links to manufacturer comparison compatible products and catalog", async () => {
  const [product, experience, manufacturer] = await Promise.all([
    source("app/catalog/[slug]/page.tsx"),
    source("lib/storefront/product-detail-experience.ts"),
    source("components/catalog/ProductManufacturer.tsx"),
  ]);

  assert.match(experience, /`\/manufacturers\/\$\{manufacturer\.slug\}`/u);
  assert.match(manufacturer, /`\/manufacturers\/\$\{manufacturer\.slug\}`/u);
  assert.match(product, /href="\/compare"/u);
  assert.match(product, /name: "Каталог", path: "\/catalog"/u);
  assert.match(product, /item\.compatibleProductId/u);
  assert.match(product, /relatedProductsById\.get/u);
  assert.match(product, /compatibleProduct\.slug/u);
});

test("manufacturer products link to product detail without promoting comparison", async () => {
  const [manufacturer, productCard] = await Promise.all([
    source("app/manufacturers/[slug]/page.tsx"),
    source("components/storefront/ProductCard.tsx"),
  ]);

  assert.match(manufacturer, /<ProductCard/u);
  assert.match(productCard, /`\/catalog\/\$\{product\.slug\}`/u);
  assert.doesNotMatch(manufacturer, /href="\/compare"/u);
  assert.doesNotMatch(manufacturer, /aria-label=\{`Открыть сравнение/u);
});

test("compare remains static and adds catalog search product and manufacturer links", async () => {
  const compare = await source("app/compare/page.tsx");
  const table = await source("components/compare/ComparisonTable.tsx");
  const combined = `${compare}\n${table}`;

  assert.doesNotMatch(compare, /searchParams|useSearchParams|"use client"/u);
  assert.match(compare, /comparableProducts\.slice\(0, 2\)/u);
  assert.match(combined, /href="\/catalog"/u);
  assert.match(combined, /href="\/search"/u);
  assert.match(combined, /`\/catalog\/\$\{product\.slug\}`/u);
  assert.match(combined, /`\/manufacturers\/\$\{/u);
});

test("search empty states offer deterministic next actions", async () => {
  const search = await source("components/search/SearchExperience.tsx");

  assert.match(search, /Что вы хотите найти\?/u);
  assert.match(search, /Очистить поиск/u);
  assert.match(search, /href="\/catalog"/u);
  assert.match(search, /href="\/manufacturers"/u);
  assert.doesNotMatch(search, /publication|review|evidence|research/iu);
});

test("catalog empty state resets real filters without hard-coded product suggestions", async () => {
  const explorer = await source("components/catalog/CatalogExplorer.tsx");
  const page = await source("app/catalog/page.tsx");

  assert.match(explorer, /resetCatalogView/u);
  assert.match(explorer, /Сбросить фильтры/u);
  assert.match(explorer, /initialCategory/u);
  assert.match(explorer, /initialManufacturer/u);
  assert.match(page, /initialCategory=\{category\}/u);
  assert.match(page, /initialManufacturer=\{manufacturer\}/u);
  assert.doesNotMatch(explorer, /\["Hamilton", "FS510", "Ambu", "ИВЛ"\]/u);
});

test("missing product and manufacturer pages provide recovery CTAs", async () => {
  const product = await source("app/catalog/[slug]/not-found.tsx");
  const manufacturer = await source(
    "app/manufacturers/[slug]/not-found.tsx",
  );

  assert.match(product, /Товар не найден/u);
  assert.match(product, /href="\/catalog"/u);
  assert.match(product, /href="\/search"/u);
  assert.match(manufacturer, /Производитель не найден/u);
  assert.match(manufacturer, /href="\/manufacturers"/u);
  assert.match(manufacturer, /href="\/catalog"/u);
  assert.match(`${product}\n${manufacturer}`, /aria-labelledby/u);
});

test("conversion changes use no new data source or client boundary", async () => {
  const files = [
    "app/compare/page.tsx",
    "app/catalog/[slug]/page.tsx",
    "app/manufacturers/page.tsx",
    "app/manufacturers/[slug]/page.tsx",
    "components/compare/ComparisonTable.tsx",
  ];
  const combined = (await Promise.all(files.map(source))).join("\n");

  assert.doesNotMatch(
    combined,
    /data\/public|data\/research|published-catalog|catalog-drafts|supabase/iu,
  );
  assert.doesNotMatch(combined, /["']use client["']/u);
});
