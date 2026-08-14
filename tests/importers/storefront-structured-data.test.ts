import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { FilesystemCatalogRepository } from "../../lib/storefront/filesystem-catalog-repository.ts";
import {
  serializeStorefrontJsonLd,
  STOREFRONT_SITE_URL,
} from "../../lib/storefront/seo.ts";
import {
  buildCollectionPageStructuredData,
  buildHomepageStructuredData,
  buildManufacturerStructuredData,
  buildProductStructuredData,
} from "../../lib/storefront/structured-data.ts";

const root = process.cwd();
const repository = new FilesystemCatalogRepository(
  resolve(root, "data/storefront"),
);

test("JsonLd is a server-only layout-neutral script using the shared serializer", async () => {
  const source = await readFile("components/seo/JsonLd.tsx", "utf8");

  assert.doesNotMatch(source, /["']use client["']/u);
  assert.doesNotMatch(source, /next\/script/u);
  assert.match(source, /type="application\/ld\+json"/u);
  assert.match(source, /serializeStorefrontJsonLd\(data\)/u);
  assert.match(source, /StorefrontStructuredData/u);
});

test("safe JSON-LD serialization escapes script-sensitive characters and remains valid JSON", () => {
  const value = {
    text: "</script><tag>&\u2028line\u2029end",
  };
  const serialized = serializeStorefrontJsonLd(value);

  assert.doesNotMatch(serialized, /<|>|&|\u2028|\u2029/u);
  assert.match(serialized, /\\u003c\/script\\u003e/u);
  assert.match(serialized, /\\u0026/u);
  assert.match(serialized, /\\u2028/u);
  assert.match(serialized, /\\u2029/u);
  assert.deepEqual(JSON.parse(serialized), value);
});

test("homepage schema contains only conservative WebSite and Organization data", () => {
  const schemas = buildHomepageStructuredData("Каталог оборудования");

  assert.deepEqual(
    schemas.map((schema) => schema["@type"]),
    ["WebSite", "Organization"],
  );
  assert.equal(schemas[0].url, `${STOREFRONT_SITE_URL}/`);
  assert.equal(schemas[0].description, "Каталог оборудования");
  assert.equal(schemas[1].logo, undefined);
  assert.equal(schemas[1].contactPoint, undefined);
  assert.equal(schemas[1].sameAs, undefined);
});

test("catalog and manufacturer directories use CollectionPage without a full ItemList", () => {
  const schema = buildCollectionPageStructuredData({
    name: "Каталог",
    description: "Каталог оборудования",
    path: "/catalog",
  });

  assert.equal(schema["@type"], "CollectionPage");
  assert.equal(schema.url, `${STOREFRONT_SITE_URL}/catalog`);
  assert.equal((schema.isPartOf as Record<string, unknown>)["@type"], "WebSite");
  assert.equal(schema.itemListElement, undefined);
});

test("Product Detail uses a truthful ItemPage graph without Google Product claims", async () => {
  const [products, manufacturers, categories] = await Promise.all([
    repository.getActiveProducts(),
    repository.getManufacturers(),
    repository.getCategories(),
  ]);
  const product = products[0];
  assert.ok(product);
  const manufacturer = manufacturers.find(({ id }) => id === product.manufacturerId);
  const category = categories.find(({ id }) => id === product.categoryId);
  const [schema, breadcrumb] = buildProductStructuredData({
    product,
    manufacturer,
    category,
  });

  assert.equal(schema["@type"], "ItemPage");
  assert.equal(schema.url, `${STOREFRONT_SITE_URL}/catalog/${product.slug}`);
  assert.equal((schema.mainEntity as Record<string, unknown>)["@type"], "Thing");
  assert.equal((schema.mainEntity as Record<string, unknown>).identifier, product.model);
  assert.equal((schema.provider as Record<string, unknown>)["@type"], "Organization");
  assert.equal(breadcrumb["@type"], "BreadcrumbList");

  const forbidden = JSON.stringify(schema);
  assert.doesNotMatch(
    forbidden,
    /"(?:Product|offers|price|availability|aggregateRating|review|gtin|mpn|registration|verification|provenance|evidence|artifactPath|sha256)"/u,
  );
});

test("Ambu VivaSight image flows into canonical ItemPage JSON-LD", async () => {
  const [products, manufacturers, categories] = await Promise.all([
    repository.getActiveProducts(),
    repository.getManufacturers(),
    repository.getCategories(),
  ]);
  const product = products.find(({ slug }) => slug === "ambu-vivasight-2-dlt");
  assert.ok(product);
  const manufacturer = manufacturers.find(({ id }) => id === product.manufacturerId);
  const category = categories.find(({ id }) => id === product.categoryId);
  const [schema] = buildProductStructuredData({
    product,
    manufacturer,
    category,
  });

  assert.deepEqual((schema.mainEntity as Record<string, unknown>).image, [
    `${STOREFRONT_SITE_URL}/products/ambu-vivasight-2-dlt/photo.jpg`,
  ]);
  assert.equal(
    (schema.primaryImageOfPage as Record<string, unknown>).contentUrl,
    `${STOREFRONT_SITE_URL}/products/ambu-vivasight-2-dlt/photo.jpg`,
  );
  assert.equal(schema.url, `${STOREFRONT_SITE_URL}/catalog/ambu-vivasight-2-dlt`);
});

test("FS510 ItemPage JSON-LD keeps the Storefront canonical", async () => {
  const product = await repository.getProductBySlug("fs510");
  assert.ok(product);
  const [schema] = buildProductStructuredData({ product });

  assert.equal(schema.url, `${STOREFRONT_SITE_URL}/catalog/fs510`);
});

test("structured description is plain text without changing visible Product HTML", async () => {
  const product = await repository.getProductBySlug("fs510");
  assert.ok(product);
  const htmlDescription = "<strong>FS510</strong><br><ul><li>Пункт &amp; значение</li></ul>";
  const [schema] = buildProductStructuredData({
    product: { ...product, description: htmlDescription },
  });

  assert.equal(schema.description, "FS510 Пункт & значение");
  assert.equal(
    (schema.mainEntity as Record<string, unknown>).description,
    "FS510 Пункт & значение",
  );
  assert.equal(htmlDescription.includes("<strong>"), true);
});

test("Product Detail and Manufacturer breadcrumbs use absolute canonical URLs", async () => {
  const [products, manufacturers] = await Promise.all([
    repository.getActiveProducts(),
    repository.getManufacturers(),
  ]);
  const product = products[0];
  const manufacturer = manufacturers[0];
  assert.ok(product);
  assert.ok(manufacturer);

  const productBreadcrumb = buildProductStructuredData({ product })[1];
  const [manufacturerSchema, manufacturerBreadcrumb] =
    buildManufacturerStructuredData(manufacturer);
  const productItems = productBreadcrumb.itemListElement as Record<
    string,
    unknown
  >[];
  const manufacturerItems = manufacturerBreadcrumb.itemListElement as Record<
    string,
    unknown
  >[];

  assert.deepEqual(
    productItems.map(({ name }) => name),
    ["Главная", "Каталог", product.name],
  );
  assert.deepEqual(
    manufacturerItems.map(({ name }) => name),
    ["Главная", "Производители", manufacturer.name],
  );
  assert.ok(productItems.every(({ item }) => String(item).startsWith("https://")));
  assert.ok(
    manufacturerItems.every(({ item }) => String(item).startsWith("https://")),
  );
  assert.equal(manufacturerSchema["@type"], "Organization");
  assert.equal(
    manufacturerSchema.url,
    `${STOREFRONT_SITE_URL}/manufacturers/${manufacturer.slug}`,
  );
});

test("only stable Storefront pages render JSON-LD", async () => {
  const structuredRoutes = [
    "app/page.tsx",
    "app/catalog/page.tsx",
    "app/catalog/[slug]/page.tsx",
    "app/manufacturers/page.tsx",
    "app/manufacturers/[slug]/page.tsx",
  ];
  const unstructuredRoutes = ["app/search/page.tsx", "app/compare/page.tsx"];

  for (const route of structuredRoutes) {
    const source = await readFile(route, "utf8");
    assert.match(source, /<JsonLd/u);
    assert.match(source, /storefront\/structured-data/u);
    assert.doesNotMatch(
      source,
      /publication|\breview\b|research|data\/public|data\/research|supabase|verticals\/fs510/iu,
    );
  }
  for (const route of unstructuredRoutes) {
    const source = await readFile(route, "utf8");
    assert.doesNotMatch(source, /JsonLd|structured-data/u);
  }
});

test("query result pages are noindex-follow without changing canonical URLs", async () => {
  const [catalog, search] = await Promise.all([
    readFile("app/catalog/page.tsx", "utf8"),
    readFile("app/search/page.tsx", "utf8"),
  ]);

  assert.match(catalog, /generateMetadata/u);
  assert.match(catalog, /noindexFollow: hasFilteredView/u);
  assert.match(search, /generateMetadata/u);
  assert.match(search, /noindexFollow: q\.trim\(\)\.length > 0/u);
});
