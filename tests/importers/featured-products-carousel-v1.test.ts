import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FEATURED_PRODUCTS,
  selectPublishedFeaturedProducts,
} from "../../lib/storefront/featured-products.ts";
import type { Product } from "../../lib/storefront/types.ts";

async function source(path: string) {
  return readFile(path, "utf8");
}

function product(slug: string, status: Product["status"] = "active"): Product {
  return {
    id: slug,
    slug,
    manufacturerId: "manufacturer",
    categoryId: "category",
    name: slug,
    model: slug,
    shortDescription: "Описание",
    description: "Описание",
    status,
    featured: false,
    applicationAreas: [],
    keyFeatures: [],
    specifications: [],
    media: [],
    documents: [],
    compatibility: [],
    relatedProductIds: [],
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
  };
}

test("featured selection is exact, ordered, public-only and fail-closed", () => {
  assert.equal(FEATURED_PRODUCTS.length, 8);
  assert.equal(new Set(FEATURED_PRODUCTS.map(({ productId }) => productId)).size, 8);
  assert.equal(new Set(FEATURED_PRODUCTS.map(({ slug }) => slug)).size, 8);

  const reversed = [...FEATURED_PRODUCTS].reverse().map(({ slug }) => product(slug));
  const selected = selectPublishedFeaturedProducts([
    product("unapproved-public-product"),
    ...reversed,
  ]);
  assert.deepEqual(selected.map(({ slug }) => slug), FEATURED_PRODUCTS.map(({ slug }) => slug));

  const hidden = product(FEATURED_PRODUCTS[2].slug, "hidden");
  const withoutHidden = selectPublishedFeaturedProducts([
    ...reversed.filter(({ slug }) => slug !== hidden.slug),
    hidden,
  ]);
  assert.equal(withoutHidden.some(({ slug }) => slug === hidden.slug), false);
  assert.equal(withoutHidden.some(({ slug }) => slug === "unapproved-public-product"), false);
});

test("carousel cards use canonical Product URLs and expose no internal metadata", async () => {
  const [page, equipment, carousel] = await Promise.all([
    source("app/page.tsx"),
    source("components/home/Equipment.tsx"),
    source("components/home/FeaturedProductsCarousel.tsx"),
  ]);

  assert.match(page, /selectPublishedFeaturedProducts\(products\)/u);
  assert.match(equipment, /products\.map/u);
  assert.match(carousel, /href=\{`\/catalog\/\$\{product\.slug\}`\}/u);
  assert.match(carousel, /Подробнее/u);
  assert.doesNotMatch(carousel, /medvist\.ru|https?:\/\/|sourceChecksum|rawSnapshot|lifecycle/iu);
});

test("carousel supports native swipe, controls, keyboard and reduced motion", async () => {
  const carousel = await source("components/home/FeaturedProductsCarousel.tsx");

  assert.match(carousel, /snap-x snap-mandatory/u);
  assert.match(carousel, /overflow-x-auto/u);
  assert.match(carousel, /overscroll-x-contain/u);
  assert.match(carousel, /basis-\[88%\]/u);
  assert.match(carousel, /sm:basis-\[calc/u);
  assert.match(carousel, /xl:basis-\[calc/u);
  assert.match(carousel, /ArrowLeft/u);
  assert.match(carousel, /ArrowRight/u);
  assert.match(carousel, /scrollBy/u);
  assert.match(carousel, /prefers-reduced-motion/u);
  assert.match(carousel, /aria-label="Предыдущие товары"/u);
  assert.match(carousel, /aria-label="Следующие товары"/u);
  assert.equal((carousel.match(/size-11/gu) ?? []).length, 2);
});

test("carousel has stable media layout and a missing-image fallback", async () => {
  const carousel = await source("components/home/FeaturedProductsCarousel.tsx");

  assert.match(carousel, /aspect-\[16\/10\]/u);
  assert.match(carousel, /loading="lazy"/u);
  assert.doesNotMatch(carousel, /loading=.*eager/u);
  assert.match(carousel, /Изображение готовится/u);
  assert.match(carousel, /alt=\{product\.image\.alt \|\| product\.name\}/u);
  assert.doesNotMatch(carousel, /useEffect|fetch\(|setInterval|setTimeout/u);
});
