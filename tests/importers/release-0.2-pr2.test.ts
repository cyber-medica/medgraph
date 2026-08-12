import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("catalog uses the compact responsive density contract", async () => {
  const [catalog, productCard] = await Promise.all([
    source("components/catalog/CatalogExplorer.tsx"),
    source("components/storefront/ProductCard.tsx"),
  ]);

  assert.match(catalog, /md:grid-cols-3 2xl:grid-cols-4/u);
  assert.match(productCard, /aspect-\[16\/8\]/u);
  assert.match(catalog, /cm-field cm-field-compact/u);
  assert.match(productCard, /flex flex-1 flex-col p-3/u);
  assert.match(productCard, /bg-cm-teal-soft px-2 py-1 font-bold/u);
  assert.doesNotMatch(catalog, /Категория уточняется/u);
  assert.match(catalog, /Данные уточняются/u);
});

test("catalog omits redundant public summary metrics", async () => {
  const page = await source("app/catalog/page.tsx");

  assert.doesNotMatch(page, /catalogSummary|Сводка каталога/u);
  assert.doesNotMatch(page, /\["Товары"|\["Производители"|\["Категории"|\["Области применения"/u);
});

test("catalog presentation uses the shared fail-closed product contract", async () => {
  const productCard = await source("components/storefront/ProductCard.tsx");
  assert.match(productCard, /getProductPresentation/u);
  assert.match(productCard, /presentation\.mediaFallbackLabel/u);
  assert.match(productCard, /presentation\.canCompare/u);
});
