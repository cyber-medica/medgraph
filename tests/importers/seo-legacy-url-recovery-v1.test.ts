import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import legacyInventoryJson from "../../data/seo/legacy-url-inventory-v3.json" with { type: "json" };
import publishedCatalogSnapshot from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import { buildProductSeoMetadataV3 } from "../../lib/seo/implementation-v3.ts";
import {
  createLegacyProductPathResolver,
  LEGACY_TILDA_PRODUCT_REDIRECTS,
  resolveLegacyProductionRoute,
  type LegacyProductRouteMapping,
} from "../../lib/seo/legacy-production-redirects.ts";
import { buildLegacyProductionResponse } from "../../lib/seo/legacy-production-response.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import { buildStorefrontSitemapFromCatalog } from "../../lib/storefront/storefront-sitemap.ts";

const origin = "https://cyber-medica.ru";
const inventory = legacyInventoryJson.mappings as unknown as Array<
  LegacyProductRouteMapping & {
    legacyPath: string;
    alternateLegacyPath: string;
    currentProductId: string | null;
    currentStatus: string;
  }
>;
const redirects = inventory.filter(({ action }) => action === "REDIRECT");
const reviews = inventory.filter(({ action }) => action === "REVIEW");
const catalog = mapCloudPublishedCatalogProjection(
  publishedCatalogSnapshot.projection as unknown as PublishedCatalogProjection,
);
const productsById = new Map(catalog.products.map((product) => [product.id, product]));
const categoriesById = new Map(catalog.categories.map((category) => [category.id, category]));
const sitemapPaths = new Set(
  buildStorefrontSitemapFromCatalog(catalog).map(({ url }) => new URL(url).pathname),
);

async function sourceTreeText(root: string): Promise<string> {
  const entries = await readdir(root, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceTreeText(entryPath);
    if (!entry.isFile() || !/\.(?:ts|tsx|js|jsx)$/u.test(entry.name)) return "";
    return readFile(entryPath, "utf8");
  }));
  return contents.join("\n");
}

test("inventory accounts for all 79 historical identities without guessing", () => {
  assert.equal(legacyInventoryJson.status, "complete");
  assert.equal(inventory.length, 79);
  assert.equal(redirects.length, 71);
  assert.equal(reviews.length, 8);
  assert.equal(inventory.filter(({ action }) => action === "GONE").length, 0);
  assert.equal(
    new Set(inventory.map(({ stableProductIdentifier }) => stableProductIdentifier)).size,
    79,
  );
});

test("known /catalog/tproduct URL returns 301 to the exact current Product", () => {
  const mapping = redirects[0];
  assert.ok(mapping?.currentCanonicalPath);
  const response = buildLegacyProductionResponse(new URL(mapping.legacyPath, origin));
  assert.equal(response?.status, 301);
  assert.equal(response?.headers.get("location"), `${origin}${mapping.currentCanonicalPath}`);
});

test("known /catalog/product URL returns 301 to the exact current Product", () => {
  const mapping = redirects[0];
  assert.ok(mapping?.currentCanonicalPath);
  const response = buildLegacyProductionResponse(
    new URL(mapping.alternateLegacyPath, origin),
  );
  assert.equal(response?.status, 301);
  assert.equal(response?.headers.get("location"), `${origin}${mapping.currentCanonicalPath}`);
});

for (const [label, source] of [
  ["Resona 7", "/catalog/tproduct/767632362-163731865692-uzi-apparat-mindray-resona-7"],
  ["Pentax FG-29V", "/catalog/tproduct/767632362-513492182572-gastrofibroskop-pentax-fg-29v"],
  ["BeneVision", "/catalog/tproduct/767632362-159912360691-portativnii-monitor-patsienta-benevision"],
] as const) {
  test(`existing ${label} redirect remains a permanent one-hop mapping`, () => {
    const destination = LEGACY_TILDA_PRODUCT_REDIRECTS.get(source);
    assert.ok(destination);
    const response = buildLegacyProductionResponse(new URL(source, origin));
    assert.equal(response?.status, 301);
    assert.equal(response?.headers.get("location"), `${origin}${destination}`);
  });
}

test("every redirect destination is backed by a current public Product", () => {
  for (const mapping of redirects) {
    const product = mapping.currentProductId
      ? productsById.get(mapping.currentProductId)
      : null;
    assert.ok(product, mapping.stableProductIdentifier);
    assert.equal(product.status, "active", mapping.stableProductIdentifier);
    assert.equal(mapping.currentCanonicalPath, `/catalog/${product.slug}`);
  }
});

test("every redirect destination keeps a self-canonical", () => {
  for (const mapping of redirects) {
    const product = mapping.currentProductId
      ? productsById.get(mapping.currentProductId)
      : null;
    assert.ok(product && mapping.currentCanonicalPath);
    const metadata = buildProductSeoMetadataV3({
      product,
      category: categoriesById.get(product.categoryId),
      fallbackDescription: product.shortDescription || product.description,
    });
    assert.equal(
      String(metadata.alternates?.canonical),
      mapping.currentCanonicalPath,
      mapping.stableProductIdentifier,
    );
  }
});

test("redirect destinations do not create a second redirect hop", () => {
  for (const mapping of redirects) {
    assert.ok(mapping.currentCanonicalPath);
    assert.equal(
      resolveLegacyProductionRoute(new URL(mapping.currentCanonicalPath, origin)),
      null,
      mapping.stableProductIdentifier,
    );
  }
});

test("redirect destinations cannot loop back into a legacy namespace", () => {
  for (const mapping of redirects) {
    assert.ok(mapping.currentCanonicalPath);
    assert.notEqual(mapping.currentCanonicalPath, mapping.legacyPath);
    assert.notEqual(mapping.currentCanonicalPath, mapping.alternateLegacyPath);
    assert.doesNotMatch(mapping.currentCanonicalPath, /\/catalog\/(?:tproduct|product)\//u);
  }
});

test("an unknown stable Product ID cannot map to another Product", () => {
  assert.equal(
    buildLegacyProductionResponse(
      new URL("/catalog/tproduct/767632362-000000000000-unknown", origin),
    ),
    null,
  );
});

test("a confirmed GONE inventory fixture produces an actual HTTP 410", () => {
  const resolveGone = createLegacyProductPathResolver([{
    stableProductIdentifier: "000000000001",
    currentCanonicalPath: null,
    action: "GONE",
  }]);
  const response = buildLegacyProductionResponse(
    new URL("/catalog/tproduct/767632362-000000000001-confirmed-gone", origin),
    (url) => resolveLegacyProductionRoute(url, resolveGone),
  );
  assert.equal(response?.status, 410);
  assert.equal(response?.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(response?.headers.get("location"), null);
});

test("an unrelated route falls through to the existing 404 handling", () => {
  assert.equal(
    buildLegacyProductionResponse(new URL("/catalog/not-a-real-product", origin)),
    null,
  );
  assert.equal(
    buildLegacyProductionResponse(new URL("/unrelated/not-found", origin)),
    null,
  );
});

test("legacy URLs remain absent from the sitemap", () => {
  for (const mapping of inventory) {
    assert.equal(sitemapPaths.has(mapping.legacyPath), false, mapping.legacyPath);
    assert.equal(
      sitemapPaths.has(mapping.alternateLegacyPath),
      false,
      mapping.alternateLegacyPath,
    );
  }
});

test("all exact current redirect targets remain in the sitemap", () => {
  for (const mapping of redirects) {
    assert.ok(mapping.currentCanonicalPath);
    assert.equal(
      sitemapPaths.has(mapping.currentCanonicalPath),
      true,
      mapping.currentCanonicalPath,
    );
  }
});

test("rendered application sources contain zero internal tproduct links", async () => {
  const source = `${await sourceTreeText("app")}\n${await sourceTreeText("components")}`;
  assert.doesNotMatch(source, /\/catalog\/tproduct\//u);
});

test("rendered application sources contain zero obsolete product-namespace links", async () => {
  const source = `${await sourceTreeText("app")}\n${await sourceTreeText("components")}`;
  assert.doesNotMatch(source, /\/catalog\/product\//u);
});

test("legacy redirect Location drops arbitrary query parameters", () => {
  const mapping = redirects[0];
  assert.ok(mapping?.currentCanonicalPath);
  const response = buildLegacyProductionResponse(
    new URL(`${mapping.legacyPath}?email=patient%40example.test&random=secret`, origin),
  );
  assert.equal(response?.status, 301);
  assert.equal(response?.headers.get("location"), `${origin}${mapping.currentCanonicalPath}`);
  assert.doesNotMatch(response?.headers.get("location") ?? "", /[?&](?:email|random)=/u);
});

test("REVIEW identities and Philips remain fail-closed without invented 410s", () => {
  for (const mapping of reviews) {
    assert.equal(
      buildLegacyProductionResponse(new URL(mapping.legacyPath, origin)),
      null,
      mapping.stableProductIdentifier,
    );
  }
  assert.equal(legacyInventoryJson.manufacturerAudit.action, "REVIEW");
  assert.equal(legacyInventoryJson.manufacturerAudit.replacementPath, null);
});
