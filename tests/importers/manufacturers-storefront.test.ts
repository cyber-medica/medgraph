import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { FilesystemCatalogRepository } from "../../lib/storefront/filesystem-catalog-repository.ts";
import { ManufacturerService } from "../../lib/storefront/manufacturer-service.ts";
import { ProductService } from "../../lib/storefront/product-service.ts";

const root = process.cwd();
const listPath = "app/manufacturers/page.tsx";
const detailPath = "app/manufacturers/[slug]/page.tsx";

async function source(path: string) {
  return readFile(resolve(root, path), "utf8");
}

test("manufacturer list loads active manufacturers through ManufacturerService", async () => {
  const list = await source(listPath);
  assert.match(list, /manufacturerService\.getManufacturers\(\)/);
  assert.match(list, /productService\.getActiveProducts\(\)/);
  assert.match(list, /manufacturers\.map\(\(manufacturer\)/u);

  const service = new ManufacturerService(
    new FilesystemCatalogRepository(resolve(root, "data/storefront")),
  );
  assert.deepEqual(
    (await service.getManufacturers()).map(({ slug }) => slug),
    ["alba-healthcare", "ambu"],
  );
});

test("manufacturer page uses Storefront manufacturer lookup", async () => {
  const detail = await source(detailPath);

  assert.match(detail, /manufacturerService\.getManufacturerBySlug\(slug\)/);
  assert.match(detail, /manufacturer\.name/);
  assert.match(detail, /getApprovedManufacturerLogoUrl\(manufacturer\.slug\)/u);
  assert.match(detail, /<ManufacturerMark/u);
  assert.match(detail, /getManufacturerSeoContent\(manufacturer\)/u);
  assert.match(detail, /manufacturerSeo\.intro/u);
  assert.match(detail, /manufacturer\.country/);
  assert.match(detail, /manufacturer\.websiteUrl/);
  assert.match(detail, /products\.length/);
  assert.match(detail, /<ProductCard/u);
});

test("manufacturer products are loaded through ProductService", async () => {
  const repository = new FilesystemCatalogRepository(
    resolve(root, "data/storefront"),
  );
  const service = new ProductService(repository);
  const products = await service.getProductsByManufacturer("manufacturer-ambu");

  assert.deepEqual(products.map(({ slug }) => slug), ["ambu-vivasight-2-dlt"]);
  assert.match(
    await source(detailPath),
    /productService\.getProductsByManufacturer\(manufacturer\.id\)/,
  );
});

test("manufacturer metadata is built from Storefront Manufacturer", async () => {
  const detail = await source(detailPath);

  assert.match(detail, /buildManufacturerSeoMetadataV3/u);
  assert.match(detail, /return buildManufacturerSeoMetadataV3\(/u);
});

test("manufacturer static params use active Storefront manufacturers", async () => {
  const detail = await source(detailPath);

  assert.match(detail, /export async function generateStaticParams/);
  assert.match(detail, /manufacturerService\.getManufacturers\(\)/);
  assert.match(detail, /manufacturers\.map\(\(\{ slug \}\) => \(\{ slug \}\)\)/);
});

test("missing manufacturer invokes notFound", async () => {
  const repository = new FilesystemCatalogRepository(
    resolve(root, "data/storefront"),
  );
  const service = new ManufacturerService(repository);

  assert.equal(await service.getManufacturerBySlug("missing-manufacturer"), null);
  assert.match(await source(detailPath), /if \(!manufacturer\) notFound\(\)/);
});

test("manufacturer routes have no publication or draft catalog imports", async () => {
  const combined = [await source(listPath), await source(detailPath)].join("\n");

  assert.doesNotMatch(combined, /lib\/published-catalog/);
  assert.doesNotMatch(combined, /lib\/catalog-drafts/);
  assert.doesNotMatch(combined, /data\/manufacturers|lib\/products/);
  assert.doesNotMatch(combined, /data\/public|data\/research|supabase/i);
});

test("manufacturer routes expose no internal workflow metrics", async () => {
  const combined = [await source(listPath), await source(detailPath)].join("\n");

  assert.doesNotMatch(
    combined,
    /publication|\breview\b|verification|evidence|research|coverage|candidate facts|readiness|source metrics/i,
  );
});
