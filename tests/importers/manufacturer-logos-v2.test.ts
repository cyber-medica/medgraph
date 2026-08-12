import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import manifest from "../../docs/reports/manufacturer-logo-manifest-v2.json" with { type: "json" };
import publishedSnapshot from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import {
  getApprovedManufacturerLogoUrl,
  getManufacturerLogoPresentation,
} from "../../lib/storefront/manufacturer-logo-policy.ts";

const root = process.cwd();
const catalog = mapCloudPublishedCatalogProjection(
  publishedSnapshot.projection as unknown as PublishedCatalogProjection,
);

test("manufacturer logo v2 manifest exactly matches the 25 non-empty public routes", () => {
  const productCounts = new Map<string, number>();
  for (const product of catalog.products) {
    productCounts.set(product.manufacturerId, (productCounts.get(product.manufacturerId) ?? 0) + 1);
  }
  const publicManufacturers = catalog.manufacturers
    .filter(({ id }) => productCounts.has(id))
    .sort((left, right) => left.slug.localeCompare(right.slug));
  const entries = [...manifest.manufacturers].sort((left, right) => left.slug.localeCompare(right.slug));

  assert.equal(publicManufacturers.length, 25);
  assert.equal(entries.length, 25);
  assert.equal(new Set(entries.map(({ slug }) => slug)).size, 25);
  assert.deepEqual(entries.map(({ slug }) => slug), publicManufacturers.map(({ slug }) => slug));

  for (const [index, manufacturer] of publicManufacturers.entries()) {
    assert.equal(entries[index]?.displayName, manufacturer.name);
    assert.equal(entries[index]?.productCount, productCounts.get(manufacturer.id));
  }
});

test("every public manufacturer resolves to a local graphic or polished fallback", () => {
  const bySlug = new Map(catalog.manufacturers.map((manufacturer) => [manufacturer.slug, manufacturer]));
  const graphics = manifest.manufacturers.filter(({ finalMode }) => finalMode === "graphic_logo");
  const fallbacks = manifest.manufacturers.filter(({ finalMode }) => finalMode === "fallback_monogram");

  assert.equal(graphics.length, 8);
  assert.equal(fallbacks.length, 17);
  assert.equal(manifest.graphicLogosTotal, graphics.length);
  assert.equal(manifest.fallbacksTotal, fallbacks.length);

  for (const entry of manifest.manufacturers) {
    const manufacturer = bySlug.get(entry.slug);
    assert.ok(manufacturer);
    const presentation = getManufacturerLogoPresentation(manufacturer);
    assert.equal(presentation.kind, entry.finalMode === "graphic_logo" ? "graphic" : "fallback");
    assert.equal(presentation.assetUrl, entry.assetPath);
    assert.equal(/^https?:\/\//u.test(entry.assetPath ?? ""), false);
  }
});

test("manufacturer graphic assets have intrinsic dimensions and no SVG runtime references", async () => {
  const graphics = manifest.manufacturers.filter(({ assetPath }) => assetPath);

  for (const entry of graphics) {
    assert.ok(entry.assetPath);
    const body = await readFile(resolve(root, `public${entry.assetPath}`));
    assert.ok(body.length > 0);
    if (entry.assetPath.endsWith(".svg")) {
      const svg = body.toString("utf8");
      assert.doesNotMatch(svg, /<script|javascript:|<foreignObject/iu);
      assert.doesNotMatch(svg, /(?:href|src)=["']https?:/iu);
    }
  }
});

test("manufacturer mark keeps the visual and performance contract", async () => {
  const mark = await readFile(resolve(root, "components/storefront/ManufacturerMark.tsx"), "utf8");

  assert.match(mark, /h-10 w-\[min\(150px,100%\)\] sm:h-14 sm:w-\[200px\]/u);
  assert.match(mark, /width=\{presentation\.assetWidth\}/u);
  assert.match(mark, /height=\{presentation\.assetHeight\}/u);
  assert.match(mark, /max-h-full[\s\S]*max-w-full[\s\S]*object-contain/u);
  assert.match(mark, /loading=\{size === "hero" \? "eager" : "lazy"\}/u);
  assert.doesNotMatch(mark, /src=\{manufacturer\.logoUrl\}/u);
});

test("new graphic marks do not change the existing metadata logo allowlist", () => {
  const metadataLogoSlugs = manifest.manufacturers
    .filter(({ slug }) => getApprovedManufacturerLogoUrl(slug))
    .map(({ slug }) => slug);

  assert.deepEqual(metadataLogoSlugs, ["fresenius-kabi", "olympus"]);
});
