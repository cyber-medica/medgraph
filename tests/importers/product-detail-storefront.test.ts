import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import type { CatalogRepository } from "../../lib/storefront/catalog-repository.ts";
import { FilesystemCatalogRepository } from "../../lib/storefront/filesystem-catalog-repository.ts";
import { ProductService } from "../../lib/storefront/product-service.ts";
import type { Product } from "../../lib/storefront/types.ts";

const root = process.cwd();
const pagePath = resolve(root, "app/catalog/[slug]/page.tsx");

async function pageSource() {
  return readFile(pagePath, "utf8");
}

test("product detail uses ProductService and CatalogRepository", async () => {
  const source = await pageSource();

  assert.match(source, /catalogRepository, productService/);
  assert.match(source, /productService\.getProductBySlug\(slug\)/);
  assert.match(source, /catalogRepository\.getManufacturers\(\)/);
  assert.match(source, /catalogRepository\.getCategories\(\)/);
});

test("slug lookup returns an active Storefront Product and null for missing slug", async () => {
  const service = new ProductService(
    new FilesystemCatalogRepository(resolve(root, "data/storefront")),
  );

  assert.equal((await service.getProductBySlug("fs510"))?.model, "FS510");
  assert.equal(await service.getProductBySlug("missing-product"), null);
});

test("missing Storefront Product invokes notFound", async () => {
  const source = await pageSource();

  assert.match(source, /if \(!product\) notFound\(\)/);
  assert.doesNotMatch(source, /getDraftCatalogProduct|getPublishedProduct/);
});

test("approved characteristics are grouped from explicit ProductSpecification rows", async () => {
  const [source, experience] = await Promise.all([
    pageSource(),
    readFile(resolve(root, "lib/storefront/product-detail-experience.ts"), "utf8"),
  ]);

  assert.match(source, /experience\.technicalSpecifications/);
  assert.match(source, /experience\.generalSpecifications/);
  assert.match(experience, /product\.specifications/);
  assert.match(experience, /filter\(isTechnicalProductSpecification\)/);
  assert.match(experience, /filter\(isGeneralProductSpecification\)/);
  assert.doesNotMatch(source, /const keySpecifications = technicalSpecifications\.slice\(0, 4\)/);
  assert.doesNotMatch(source, /Ключевые характеристики/);
  assert.match(source, /groupSpecifications\(technicalSpecifications\)/);
  assert.match(source, /specificationGroups\.unshift\(\["Основные сведения"/);
  assert.match(source, /data-testid="product-characteristic-row"/);
  assert.match(source, /specification\.group/);
  assert.match(source, /specification\.label/);
  assert.match(source, /specification\.value/);
  assert.match(source, /specification\.unit/);
});

test("documents expose only ProductDocument public fields", async () => {
  const source = await pageSource();

  assert.match(source, /const registrationDocuments = product\.documents\.filter/);
  assert.match(source, /const downloadDocuments = product\.documents\.filter/);
  assert.match(source, /title="Документы и загрузки"/);
  assert.match(source, /document\.title/);
  assert.match(source, /document\.kind/);
  assert.match(source, /document\.language/);
  assert.match(source, /document\.publicUrl/);
  assert.doesNotMatch(source, /document\.sha256|artifactPath|documentVersion/i);
});

test("compatibility uses ProductCompatibility without evidence", async () => {
  const source = await pageSource();

  assert.match(source, /product\.compatibility/);
  assert.match(source, /item\.label/);
  assert.match(source, /item\.note/);
  assert.doesNotMatch(source, /evidence|provenance/i);
});

test("relatedProductIds are resolved through ProductService", async () => {
  const filesystemRepository = new FilesystemCatalogRepository(
    resolve(root, "data/storefront"),
  );
  const products = (await filesystemRepository.getActiveProducts()).map((product) => ({
    ...product,
    relatedProductIds: [...product.relatedProductIds],
  }));
  const primary = products.find(({ slug }) => slug === "fs510") as Product;
  const related = products.find(
    ({ slug }) => slug === "ambu-vivasight-2-dlt",
  ) as Product;
  primary.relatedProductIds = [related.id];

  const repository: CatalogRepository = {
    getProducts: async () => products,
    getActiveProducts: async () => products,
    getProductBySlug: async (slug) =>
      products.find((product) => product.slug === slug) ?? null,
    getProductsByManufacturer: async () => [],
    getProductsByCategory: async () => [],
    getFeaturedProducts: async () => [],
    getManufacturers: async () => [],
    getManufacturerBySlug: async () => null,
    getCategories: async () => [],
    getCategoryBySlug: async () => null,
    searchProducts: async () => [],
    getCatalogSummary: () => filesystemRepository.getCatalogSummary(),
  };
  const service = new ProductService(repository);

  assert.deepEqual(
    (await service.getRelatedProducts(primary)).map(({ slug }) => slug),
    ["ambu-vivasight-2-dlt"],
  );
  assert.match(await pageSource(), /productService\.getRelatedProducts\(product\)/);
});

test("product detail has no publication or draft catalog imports", async () => {
  const source = await pageSource();

  assert.doesNotMatch(source, /lib\/published-catalog/);
  assert.doesNotMatch(source, /lib\/catalog-drafts/);
  assert.doesNotMatch(source, /data\/public|data\/research|supabase/i);
});

test("metadata is generated from Storefront Product", async () => {
  const source = await pageSource();

  assert.match(source, /buildProductSeoMetadataV3/u);
  assert.match(source, /return buildProductSeoMetadataV3\(\{/u);
  assert.match(source, /fallbackDescription: presentation\.shortDescription \?\? product\.description/u);
  assert.match(source, /product\.media\.find\(\(\{ type \}\) => type === "image"\)/);
  assert.match(source, /image: image \? \{ url: image\.url, alt: image\.alt \} : undefined/);
});

test("Ambu VivaSight image is catalog-ready and available to catalog and product UI", async () => {
  const repository = new FilesystemCatalogRepository(
    resolve(root, "data/storefront"),
  );
  const product = await repository.getProductBySlug("ambu-vivasight-2-dlt");
  assert.ok(product);
  const image = product.media.find(({ type }) => type === "image");

  assert.deepEqual(image, {
    type: "image",
    url: "/products/ambu-vivasight-2-dlt/photo.jpg",
    alt: "Ambu VivaSight 2 DLT, подключённая к монитору Ambu aView 2 Advance",
    position: 10,
  });
  await access(resolve(root, "public", image.url.slice(1)));

  const [productPage, productCard] = await Promise.all([
    pageSource(),
    readFile(resolve(root, "components/storefront/ProductCard.tsx"), "utf8"),
  ]);
  assert.match(productPage, /<ProductGallery\s+media=\{product\.media\}/u);
  assert.match(productCard, /product\.media\.find/u);
});

test("product hero uses a media-first 40/60 layout without decorative duplicates", async () => {
  const source = await pageSource();

  assert.match(source, /data-testid="product-hero"/);
  assert.match(
    source,
    /lg:grid-cols-\[minmax\(0,40fr\)_minmax\(0,60fr\)\]/,
  );
  assert.match(source, /<ProductGallery\s+media=\{product\.media\}/);
  assert.match(source, /data-testid="product-metadata"/);
  assert.match(source, /<dt className="sr-only">\{label\}<\/dt>/);
  assert.doesNotMatch(source, /label="Страна производства"/);
  assert.doesNotMatch(source, /label="Модель \/ артикул"/);
  assert.doesNotMatch(source, /label="Статус"/);
  assert.doesNotMatch(source, /presentation\.statusLabel/);
  assert.doesNotMatch(source, /key-specifications/);
  assert.match(source, /aria-label="Навигация по странице товара"/);
});

test("product detail exposes semantic breadcrumbs and public regulatory information", async () => {
  const source = await pageSource();

  assert.match(source, /aria-label="Хлебные крошки"/);
  assert.match(source, /href="\/catalog"/);
  assert.match(source, /aria-current="page"/);
  assert.match(source, /hasRegulatoryInformation/);
  assert.match(source, /title="Регистрационная информация"/);
  assert.match(source, /record\.number/);
  assert.match(source, /record\.sourceUrl/);
  assert.doesNotMatch(source, /record\.status/);
});

test("product detail has one hierarchy and ordered content sections", async () => {
  const source = await pageSource();
  const sectionMarkers = [
    'title="Описание"',
    'title={featureSectionTitle}',
    'title="Технические характеристики"',
    'title="Области применения"',
    'title="Регистрационная информация"',
    'title="Комплектация"',
    'title="Документы и загрузки"',
    'title="Связанные товары"',
    'title="Производитель"',
  ];

  for (let index = 1; index < sectionMarkers.length; index += 1) {
    assert.ok(
      source.indexOf(sectionMarkers[index - 1]) <
        source.indexOf(sectionMarkers[index]),
      `${sectionMarkers[index - 1]} must precede ${sectionMarkers[index]}`,
    );
  }
  assert.equal((source.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(source, /title="Изделие"|>Изделие</);
  assert.doesNotMatch(source, /title="Основная информация"|>Product</);
});

test("product hero stays server-rendered while gallery interaction is isolated", async () => {
  const [source, gallery] = await Promise.all([
    pageSource(),
    readFile(resolve(root, "components/catalog/ProductGallery.tsx"), "utf8"),
  ]);

  assert.match(source, /aria-label="Навигация по странице товара"/);
  assert.doesNotMatch(source, /["']use client["']/);
  assert.match(gallery, /["']use client["']/);
  assert.match(gallery, /cursor-zoom-in/);
  assert.match(gallery, /aria-label="Увеличить изображение"/u);
  assert.doesNotMatch(gallery, />Увеличить</u);
  assert.doesNotMatch(gallery, /target="_blank"/u);
});
