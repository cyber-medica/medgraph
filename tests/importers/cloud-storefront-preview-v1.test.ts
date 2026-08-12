import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  mapCloudPreviewSnapshot,
  type CloudPreviewCatalogSnapshot,
} from "../../lib/storefront/cloud-preview-mapper.ts";
import {
  getStorefrontDataSource,
  isCloudPreviewCatalog,
} from "../../lib/storefront/data-source.ts";
import { sanitizeStorefrontHtml } from "../../lib/storefront/sanitize-html.ts";
import {
  CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID,
  CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID,
  PUBLIC_PRODUCT_STATUSES,
} from "../../lib/storefront/types.ts";
import type { CatalogRepository } from "../../lib/storefront/catalog-repository.ts";
import { ProductService } from "../../lib/storefront/product-service.ts";

const timestamp = "2026-07-20T12:00:00.000Z";

function snapshot(): CloudPreviewCatalogSnapshot {
  return {
    generatedAt: timestamp,
    manufacturers: [{
      id: "11111111-1111-1111-1111-111111111111",
      slug: "mindray",
      name: "Mindray",
      description: "Медицинское оборудование",
      countryCode: "CN",
      website: "https://www.mindray.com/",
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    categories: [{
      id: "22222222-2222-2222-2222-222222222222",
      slug: "patient-monitors",
      name: "Мониторы пациента",
      description: "Мониторинг пациента",
      position: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    applicationAreas: [{
      id: "33333333-3333-3333-3333-333333333333",
      slug: "intensive-care",
      name: "Реанимация",
      description: "Интенсивная терапия",
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    products: [
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        slug: "benevision-n1",
        title: "BeneVision N1",
        model: "N1",
        shortDescription: "<strong>Транспортный монитор</strong>",
        description: "<p>Описание <script>alert(1)</script><strong>товара</strong></p>",
        manufacturerId: "11111111-1111-1111-1111-111111111111",
        categoryId: "22222222-2222-2222-2222-222222222222",
        publicationStatus: "draft",
        published: false,
        reviewState: "pending",
        createdAt: timestamp,
        updatedAt: timestamp,
        applicationAreas: [{ id: "33333333-3333-3333-3333-333333333333", name: "Реанимация" }],
        characteristics: [{ name: "Категория", value: "Мониторы", unit: null }],
        keyFeatures: [{ text: "Компактный транспортный формат", sortOrder: 10 }],
        characteristicGroups: [{
          key: "display",
          title: "Экран",
          sortOrder: 10,
          items: [{ label: "Диагональ", value: "10", unit: "дюйм", sortOrder: 10 }],
        }],
        media: [{ url: "https://static.tildacdn.com/product.png", role: "primary", format: "png" }],
        documents: [],
        registrations: [],
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        slug: "unknown-device",
        title: "Неуточнённое изделие",
        model: null,
        shortDescription: null,
        description: null,
        manufacturerId: null,
        categoryId: null,
        publicationStatus: "draft",
        published: false,
        reviewState: "blocked",
        createdAt: timestamp,
        updatedAt: timestamp,
        applicationAreas: [],
        characteristics: [],
        keyFeatures: [],
        characteristicGroups: [],
        media: [],
        documents: [],
        registrations: [],
      },
    ],
  };
}

test("Storefront data source defaults to static and cloud_preview fails closed in Production", () => {
  assert.equal(getStorefrontDataSource({}), "static");
  assert.equal(getStorefrontDataSource({ CATALOG_DATA_SOURCE: "cloud_preview", VERCEL_ENV: "preview" }), "cloud_preview");
  assert.equal(isCloudPreviewCatalog({ CATALOG_DATA_SOURCE: "cloud_preview", VERCEL_ENV: "preview" }), true);
  assert.throws(
    () => getStorefrontDataSource({ CATALOG_DATA_SOURCE: "cloud_preview", VERCEL_ENV: "production" }),
    /forbidden in the Vercel Production environment/u,
  );
  assert.throws(() => getStorefrontDataSource({ CATALOG_DATA_SOURCE: "supabase" }), /Unsupported Storefront/u);
});

test("Cloud Preview maps draft rows to public-safe Storefront products without inventing references", async () => {
  const mapped = mapCloudPreviewSnapshot(snapshot());
  assert.equal(mapped.products.length, 2);
  assert.equal(mapped.products[0].status, "preview_draft");
  assert.equal(mapped.products[0].manufacturerId, "mindray");
  assert.equal(mapped.products[0].categoryId, "patient-monitors");
  assert.equal(mapped.products[0].shortDescription, "Транспортный монитор");
  assert.deepEqual(mapped.products[0].keyFeatures, ["Компактный транспортный формат"]);
  assert.deepEqual(mapped.products[0].specifications[0], {
    group: "Экран",
    label: "Диагональ",
    value: "10",
    unit: "дюйм",
    position: 0,
  });
  assert.equal(mapped.products[0].specifications.some(({ label }) => label === "Категория"), false);
  assert.equal(mapped.products[0].media[0].url, "https://static.tildacdn.com/product.png");
  assert.equal(mapped.products[1].manufacturerId, CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID);
  assert.equal(mapped.products[1].categoryId, CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID);
  assert.equal(mapped.products[1].model, "Не указан");
  assert.equal(PUBLIC_PRODUCT_STATUSES.has("preview_draft"), false);

  assert.equal(mapped.products.filter(({ status }) => status === "preview_draft").length, 2);
  assert.equal(mapped.products.find(({ slug }) => slug === "unknown-device")?.name, "Неуточнённое изделие");
});

test("preview drafts require an explicit preview-only service policy", async () => {
  const mapped = mapCloudPreviewSnapshot(snapshot());
  const repository = {
    getProductBySlug: async (slug: string) => mapped.products.find((product) => product.slug === slug) ?? null,
  } as CatalogRepository;
  const publicService = new ProductService(repository);
  const previewService = new ProductService(
    repository,
    new Set([...PUBLIC_PRODUCT_STATUSES, "preview_draft"]),
  );

  assert.equal(await publicService.getProductBySlug("benevision-n1"), null);
  assert.equal((await previewService.getProductBySlug("benevision-n1"))?.slug, "benevision-n1");
});

test("HTML sanitizer removes executable markup and all attributes", () => {
  const value = sanitizeStorefrontHtml(
    '<p onclick="alert(1)">Text <strong class="x">safe</strong><img src=x onerror=alert(1)><script>alert(1)</script></p>',
  );
  assert.equal(value, "<p>Text <strong>safe</strong></p>");
  assert.doesNotMatch(value, /script|onclick|onerror|img/iu);
});

test("Cloud Storefront transport is service-only, no-store and read-only", async () => {
  const [repository, migration] = await Promise.all([
    readFile("lib/storefront/cloud-preview-catalog-repository.ts", "utf8"),
    readFile("supabase/migrations/202607200006_cloud_storefront_preview_v1.sql", "utf8"),
  ]);
  assert.match(repository, /access: "service_role"/u);
  assert.match(repository, /"Accept-Profile": "cloud_api"/u);
  assert.match(repository, /"Content-Profile": "cloud_api"/u);
  assert.doesNotMatch(repository, /patchCatalogAdminProduct|PATCH|INSERT|UPDATE|DELETE/iu);
  assert.match(migration, /stable/u);
  assert.match(migration, /revoke all on function cloud_api\.cloud_storefront_preview_catalog\(\) from public, anon, authenticated/u);
  assert.match(migration, /grant execute on function cloud_api\.cloud_storefront_preview_catalog\(\) to service_role/u);
  assert.doesNotMatch(migration, /insert into|update cloud\.|delete from/iu);
});

test("Preview routes expose banner, noindex/no-store and disable Compare", async () => {
  const [layout, config, catalog, compare, product, robots, sitemap] = await Promise.all([
    readFile("app/layout.tsx", "utf8"),
    readFile("next.config.ts", "utf8"),
    readFile("components/catalog/CatalogExplorer.tsx", "utf8"),
    readFile("app/compare/page.tsx", "utf8"),
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
    readFile("app/robots.ts", "utf8"),
    readFile("app/sitemap.ts", "utf8"),
  ]);
  assert.match(layout, /CloudCatalogPreviewBanner/u);
  assert.match(config, /X-Robots-Tag/u);
  assert.match(config, /private, no-cache, no-store/u);
  assert.match(catalog, /Все области применения/u);
  assert.match(catalog, /updated-desc/u);
  assert.match(compare, /Сравнение недоступно в Cloud Catalog Preview/u);
  assert.doesNotMatch(product, /PRODUCT_PRESENTATION_FALLBACKS\.registration/u);
  assert.match(product, /hasRegulatoryInformation/u);
  assert.match(product, /SafeProductDescription/u);
  assert.match(robots, /isProductionIndexingEnvironment/u);
  assert.match(robots, /disallow: "\/"/u);
  assert.match(sitemap, /storefrontDataSource === "cloud_preview"/u);
});

test("Storefront source is resolved at request time for a reusable Preview artifact", async () => {
  const [layout, homepage, product, manufacturers, manufacturer] = await Promise.all([
    readFile("app/layout.tsx", "utf8"),
    readFile("app/page.tsx", "utf8"),
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
    readFile("app/manufacturers/page.tsx", "utf8"),
    readFile("app/manufacturers/[slug]/page.tsx", "utf8"),
  ]);

  assert.match(
    layout,
    /from "@\/lib\/storefront\/data-source"/u,
    "RootLayout must resolve preview mode through the lightweight data-source module",
  );
  assert.doesNotMatch(layout, /from "@\/lib\/storefront";/u);
  assert.doesNotMatch(layout, /import \{ connection \} from "next\/server"/u);
  assert.doesNotMatch(layout, /await connection\(\)/u);
  assert.doesNotMatch(layout, /loadHomepageOverviewSources/u);
  assert.doesNotMatch(layout, /export default async function RootLayout/u);
  assert.match(homepage, /productService\.getActiveProducts\(\)/u);
  assert.match(homepage, /manufacturerService\.getManufacturers\(\)/u);
  assert.match(homepage, /categoryService\.getCategories\(\)/u);
  assert.match(product, /productService\.getProductBySlug\(slug\)/u);
  assert.match(manufacturers, /manufacturerService\.getManufacturers\(\)/u);
  assert.match(manufacturer, /productService\.getProductsByManufacturer/u);
});

test("Cloud media and the approved brand asset survive build-time source selection", async () => {
  const [config, header, footer] = await Promise.all([
    readFile("next.config.ts", "utf8"),
    readFile("components/layout/Header.tsx", "utf8"),
    readFile("components/home/Footer.tsx", "utf8"),
  ]);

  assert.match(config, /APPROVED_PUBLIC_MEDIA_HOSTS/u);
  assert.match(config, /remotePatterns: APPROVED_PUBLIC_MEDIA_HOSTS\.map/u);
  assert.match(config, /img-src 'self' data: blob:[^`]*\$\{cloudMediaOrigins\}/u);
  assert.match(header, /\/brand\/cybermedica-logo\.png/u);
  assert.match(footer, /\/brand\/cybermedica-logo\.png/u);
});

test("Cloud Preview deployment trace excludes private source datasets", async () => {
  const config = await readFile("next.config.ts", "utf8");
  assert.match(config, /outputFileTracingExcludes: \{/u);
  assert.match(config, /\.\/data\/research\/\*\*\/\*/u);
  assert.match(config, /\.\/data\/legacy\/\*\*\/\*/u);
  assert.match(config, /\.\/supabase\/migrations\/\*\*\/\*/u);
});
