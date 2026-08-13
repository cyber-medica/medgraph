import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import manifest from "../../docs/reports/all-manufacturer-logos-stage-v1.json" with { type: "json" };
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

test("public manufacturers resolve to 21 quality graphics and four fallbacks", () => {
  const bySlug = new Map(catalog.manufacturers.map((manufacturer) => [manufacturer.slug, manufacturer]));
  const graphics = manifest.manufacturers.filter(({ assetPath }) => assetPath);

  assert.equal(graphics.length, 21);
  assert.equal(manifest.graphicLogos, graphics.length);

  for (const entry of manifest.manufacturers) {
    const manufacturer = bySlug.get(entry.slug);
    assert.ok(manufacturer);
    const presentation = getManufacturerLogoPresentation(manufacturer);
    assert.equal(presentation.kind, entry.officialSource ? "graphic" : "fallback");
    assert.equal(presentation.assetUrl, entry.officialSource ? entry.assetPath : null);
    assert.equal(/^https?:\/\//u.test(entry.assetPath ?? ""), false);
  }

  assert.equal(manifest.manufacturers.filter(({ officialSource }) => officialSource).length, 21);
  assert.equal(manifest.manufacturers.filter(({ officialSource }) => !officialSource).length, 4);
});

test("manufacturer graphic assets have intrinsic dimensions and no SVG runtime references", async () => {
  const graphics = manifest.manufacturers.filter(({ assetPath, officialSource }) => assetPath && officialSource);

  assert.equal(graphics.length, 21);

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
  assert.match(mark, /presentation\.opticalScale/u);
  assert.match(mark, /loading=\{size === "hero" \? "eager" : "lazy"\}/u);
  assert.doesNotMatch(mark, /src=\{manufacturer\.logoUrl\}/u);
});

test("new graphic marks do not change the existing metadata logo allowlist", () => {
  const metadataLogoSlugs = manifest.manufacturers
    .filter(({ slug }) => getApprovedManufacturerLogoUrl(slug))
    .map(({ slug }) => slug);

  assert.deepEqual(metadataLogoSlugs, ["fresenius-kabi", "olympus"]);
});

test("the five quality decisions fail closed and remain local", () => {
  const bySlug = new Map(catalog.manufacturers.map((manufacturer) => [manufacturer.slug, manufacturer]));
  const hamilton = getManufacturerLogoPresentation(bySlug.get("hamilton-medical")!);
  const mindray = getManufacturerLogoPresentation(bySlug.get("mindray")!);

  assert.equal(hamilton.kind, "graphic");
  assert.equal(hamilton.assetUrl, "/manufacturers/hamilton-medical/logo.svg");
  assert.equal(mindray.kind, "graphic");
  assert.equal(mindray.assetUrl, "/manufacturers/mindray/logo.svg");

  for (const slug of ["ilivtouch", "longfian", "medinova"] as const) {
    const presentation = getManufacturerLogoPresentation(bySlug.get(slug)!);
    assert.equal(presentation.kind, "fallback");
    assert.equal(presentation.assetUrl, null);
    assert.equal(presentation.usageStatus, "ASSET_UNRESOLVED");
  }
});
