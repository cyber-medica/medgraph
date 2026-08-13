import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import publishedSnapshot from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import {
  getManufacturerLogoPresentation,
  MANUFACTURER_LOGO_POLICY,
} from "../../lib/storefront/manufacturer-logo-policy.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import { buildStorefrontSitemapFromCatalog } from "../../lib/storefront/storefront-sitemap.ts";

const root = process.cwd();
const catalog = mapCloudPublishedCatalogProjection(
  publishedSnapshot.projection as unknown as PublishedCatalogProjection,
);

async function source(path: string) {
  return readFile(resolve(root, path), "utf8");
}

async function exists(path: string) {
  try {
    await access(resolve(root, path));
    return true;
  } catch {
    return false;
  }
}

test("catalog and manufacturer listing omit static public KPI summaries", async () => {
  const [catalog, manufacturers, explorer] = await Promise.all([
    source("app/catalog/page.tsx"),
    source("app/manufacturers/page.tsx"),
    source("components/catalog/CatalogExplorer.tsx"),
  ]);

  assert.doesNotMatch(catalog, /Сводка каталога|catalogSummary/u);
  assert.doesNotMatch(manufacturers, /\["Производителей"|\["Изделий"|\["Категорий"/u);
  assert.doesNotMatch(explorer, /из \{products\.length\}/u);
  assert.match(explorer, /hasActiveSearchOrFilters \? \(/u);
  assert.match(explorer, /Найдено: <strong[^>]*>\{results\.length\}<\/strong>/u);
});

test("all 25 public non-empty manufacturer routes have a fail-closed logo presentation", async () => {
  const publicManufacturerIds = new Set(catalog.products.map(({ manufacturerId }) => manufacturerId));
  const publicManufacturers = catalog.manufacturers.filter(({ id }) => publicManufacturerIds.has(id));
  const catalogSlugs = catalog.manufacturers.map(({ slug }) => slug).sort();
  const manifestSlugs = MANUFACTURER_LOGO_POLICY.map(({ slug }) => slug).sort();

  assert.equal(publicManufacturers.length, 25);
  assert.equal(new Set(manifestSlugs).size, 31);
  assert.deepEqual(manifestSlugs, catalogSlugs);

  const presentations = publicManufacturers.map((manufacturer) =>
    getManufacturerLogoPresentation(manufacturer),
  );
  assert.equal(presentations.filter(({ kind }) => kind === "graphic").length, 25);
  assert.equal(presentations.filter(({ kind }) => kind === "fallback").length, 0);
  assert.ok(presentations.every(({ assetUrl }) => !assetUrl || assetUrl.startsWith("/manufacturers/")));
  assert.ok(presentations.every(({ kind, fallbackReason }) => kind === "graphic" || Boolean(fallbackReason)));
});

test("approved manufacturer assets are local, present and checksum pinned", async () => {
  const graphicEntries = MANUFACTURER_LOGO_POLICY.filter(({ assetUrl }) => assetUrl);
  assert.equal(graphicEntries.length, 25);

  for (const entry of graphicEntries) {
    assert.ok(entry.assetUrl);
    assert.ok(entry.assetSha256);
    assert.equal(/^https?:\/\//u.test(entry.assetUrl), false);
    const body = await readFile(resolve(root, `public${entry.assetUrl}`));
    assert.equal(createHash("sha256").update(body).digest("hex"), entry.assetSha256);
  }
});

test("manufacturer hero obeys logo sizing and never trusts a remote runtime logo", async () => {
  const [mark, detail, policy] = await Promise.all([
    source("components/storefront/ManufacturerMark.tsx"),
    source("app/manufacturers/[slug]/page.tsx"),
    source("lib/storefront/manufacturer-logo-policy.ts"),
  ]);

  assert.match(mark, /h-10 w-\[min\(150px,100%\)\] sm:h-14 sm:w-\[200px\]/u);
  assert.match(mark, /object-contain/u);
  assert.match(mark, /data-logo-kind="graphic"/u);
  assert.match(mark, /data-logo-kind="fallback"/u);
  assert.match(detail, /size="hero"/u);
  assert.doesNotMatch(mark, /logoUrl/u);
  assert.doesNotMatch(policy, /assetUrl: "https?:/u);
});

test("manufacturer and related product listings reuse canonical ProductCard", async () => {
  const [manufacturerDetail, productDetail, productCard] = await Promise.all([
    source("app/manufacturers/[slug]/page.tsx"),
    source("app/catalog/[slug]/page.tsx"),
    source("components/storefront/ProductCard.tsx"),
  ]);

  assert.match(manufacturerDetail, /import ProductCard from "@\/components\/storefront\/ProductCard"/u);
  assert.match(manufacturerDetail, /<ProductCard/u);
  assert.doesNotMatch(manufacturerDetail, /<article/u);
  assert.match(productDetail, /import ProductCard from "@\/components\/storefront\/ProductCard"/u);
  assert.match(productDetail, /relatedProducts\.map[\s\S]*<ProductCard/u);
  assert.match(productCard, /export default function ProductCard/u);
  assert.equal(await exists("components/storefront/SupplierProductCard.tsx"), false);
});

test("supplier discovery is absent and direct supplier routes remain real 404s", async () => {
  const sitemap = buildStorefrontSitemapFromCatalog({
    products: catalog.products,
    manufacturers: catalog.manufacturers,
    categories: catalog.categories,
  });

  assert.equal(sitemap.some(({ url }) => url.includes("/suppliers/")), false);
  assert.equal(await exists("app/suppliers"), false);
  assert.equal(await exists("lib/storefront/supplier-service.ts"), false);
});

test("manufacturer directory preserves the exact 31-slug public contract", async () => {
  const listing = await source("app/manufacturers/page.tsx");
  assert.match(listing, /manufacturers\.map\(\(manufacturer\)/u);
  assert.doesNotMatch(listing, /manufacturerProducts\.length === 0/u);
});
