import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("ProductCard visual polish prioritizes equipment without changing its public contract", async () => {
  const productCard = await source("components/storefront/ProductCard.tsx");

  assert.match(productCard, /export interface ProductCardProps \{/u);
  assert.match(productCard, /product: Product;/u);
  assert.match(productCard, /manufacturer\?: Manufacturer;/u);
  assert.match(productCard, /categoryName\?: string;/u);
  assert.match(productCard, /compareEnabled\?: boolean;/u);
  assert.equal((productCard.match(/aspect-\[16\/8\]/gu) ?? []).length, 2);
  assert.match(productCard, /object-contain p-2/u);
  assert.match(productCard, /sizes="\(max-width: 767px\) 92vw, \(max-width: 1535px\) 33vw, 25vw"/u);
  assert.doesNotMatch(productCard, /object-cover|scale-1[1-9]|variant|featured|recommended|marketing/iu);
});
