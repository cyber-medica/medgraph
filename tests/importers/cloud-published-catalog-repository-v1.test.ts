import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import {
  CloudPublishedCatalogRepositoryError,
  loadValidatedPublishedCatalogProjection,
} from "../../lib/storefront/cloud-published-response.ts";
import {
  getStorefrontDataSource,
  isCloudPublishedCatalog,
  isCloudPreviewCatalog,
} from "../../lib/storefront/data-source.ts";
import { buildStorefrontSitemap } from "../../lib/storefront/storefront-sitemap.ts";

const timestamp = "2026-07-27T00:00:00.000Z";
const responseOptions = { rethrowFrameworkError: () => undefined };

function projection(): PublishedCatalogProjection {
  return {
    schemaVersion: 1,
    generatedAt: timestamp,
    products: [{
      id: "published-product",
      slug: "published-product",
      title: "Published Product",
      model: "PP-1",
      shortDescription: "<strong>Public summary</strong>",
      description: "<p>Public description.</p>",
      seoTitle: "Approved SEO title",
      seoDescription: "Approved SEO description",
      manufacturerId: "manufacturer-public-id",
      categoryId: "category-public-id",
      status: "active",
      applicationAreas: [{ id: "area-public-id", name: "Intensive Care" }],
      keyFeatures: [{ text: "Approved feature", sortOrder: 10 }],
      characteristicGroups: [{
        key: "technical",
        title: "Technical",
        sortOrder: 10,
        items: [{
          key: "legacy:flow",
          contentKind: "legacy_metadata",
          recordOrigin: "legacy",
          label: "Flow",
          value: "42",
          unit: "L/min",
          sortOrder: 10,
        }],
      }],
      media: [{
        url: "https://static.tildacdn.com/equipment.webp",
        role: "primary",
        format: "image/webp",
        sortOrder: 10,
      }],
      documents: [{
        title: "Datasheet",
        kind: "datasheet",
        publicUrl: "https://example.invalid/datasheet.pdf",
        language: "ru",
        isOfficial: true,
      }],
      registrations: [{
        registrationNumber: "TEST-1",
        status: "verified_exact",
        sourceUrl: null,
      }],
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    manufacturers: [{
      id: "manufacturer-public-id",
      slug: "published-manufacturer",
      name: "Published Manufacturer",
      description: "Public manufacturer description.",
      countryCode: "CH",
      website: "https://example.invalid/manufacturer",
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    categories: [{
      id: "category-public-id",
      slug: "published-category",
      name: "Published Category",
      description: "Public category description.",
      position: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    applicationAreas: [{
      id: "area-public-id",
      slug: "intensive-care",
      name: "Intensive Care",
      description: "Public application area.",
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    summary: {
      productCount: 1,
      manufacturerCount: 1,
      categoryCount: 1,
      applicationAreaCount: 1,
    },
  };
}

function responseFor(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("cloud_published is explicit, Production-safe and never relaxes cloud_preview guard", () => {
  assert.equal(getStorefrontDataSource({}), "static");
  assert.equal(getStorefrontDataSource({ CATALOG_DATA_SOURCE: "cloud_published" }), "cloud_published");
  assert.equal(getStorefrontDataSource({
    CATALOG_DATA_SOURCE: "cloud_published",
    VERCEL_ENV: "production",
  }), "cloud_published");
  assert.equal(isCloudPublishedCatalog({ CATALOG_DATA_SOURCE: "cloud_published" }), true);
  assert.equal(isCloudPreviewCatalog({ CATALOG_DATA_SOURCE: "cloud_published" }), false);
  assert.throws(
    () => getStorefrontDataSource({ CATALOG_DATA_SOURCE: "cloud_preview", VERCEL_ENV: "production" }),
    /forbidden in the Vercel Production environment/u,
  );
  assert.throws(
    () => getStorefrontDataSource({ CATALOG_DATA_SOURCE: "published" }),
    /Unsupported Storefront/u,
  );
});

test("mocked published RPC is strictly validated before mapping", async () => {
  const validated = await loadValidatedPublishedCatalogProjection(
    async () => responseFor(projection()),
    responseOptions,
  );
  const mapped = mapCloudPublishedCatalogProjection(validated);

  assert.equal(mapped.products.length, 1);
  assert.equal(mapped.products[0].status, "active");
  assert.equal(mapped.products[0].manufacturerId, "published-manufacturer");
  assert.equal(mapped.products[0].categoryId, "published-category");
  assert.equal(mapped.products[0].shortDescription, "Public summary");
  assert.equal(mapped.products[0].seoTitle, "Approved SEO title");
  assert.equal(mapped.products[0].seoDescription, "Approved SEO description");
  assert.equal(mapped.products[0].keyFeatures[0], "Approved feature");
  assert.equal(mapped.products[0].specifications[0].group, "Technical");
  assert.equal(mapped.products[0].media[0].type, "image");
  assert.equal(mapped.products[0].documents[0].kind, "datasheet");
  assert.equal(mapped.products[0].registrationRecords?.[0].sourceUrl, null);
  assert.equal(mapped.summary.activeProductCount, 1);
  assert.equal(mapped.products.some(({ status }) => status === "preview_draft"), false);
});

test("valid empty published catalog remains empty without static or draft fallback", async () => {
  const empty = projection();
  empty.products = [];
  empty.summary.productCount = 0;
  const validated = await loadValidatedPublishedCatalogProjection(
    async () => responseFor(empty),
    responseOptions,
  );
  const mapped = mapCloudPublishedCatalogProjection(validated);

  assert.deepEqual(mapped.products, []);
  assert.equal(mapped.summary.productCount, 0);
  assert.equal(mapped.summary.activeProductCount, 0);

  const sitemap = await buildStorefrontSitemap({
    productService: { getActiveProducts: async () => mapped.products },
    manufacturerService: { getManufacturers: async () => mapped.manufacturers },
    categoryService: { getCategories: async () => mapped.categories },
  });
  assert.equal(
    sitemap.some(({ url }) => new URL(url).pathname === "/catalog/published-product"),
    false,
  );
});

test("schema mismatch, malformed products and nested children fail closed", async () => {
  const invalidPayloads: unknown[] = [
    { ...projection(), schemaVersion: 2 },
    { ...projection(), generatedAt: "not-a-timestamp" },
    { ...projection(), products: [{ ...projection().products[0], status: "preview_draft" }] },
    { ...projection(), products: [{ ...projection().products[0], model: null }] },
    { ...projection(), products: [{
      ...projection().products[0],
      documents: [{ ...projection().products[0].documents[0], kind: "internal_review" }],
    }] },
    { ...projection(), products: [{
      ...projection().products[0],
      media: [{ ...projection().products[0].media[0], sortOrder: -1 }],
    }] },
    { ...projection(), publicationBatchId: "internal-id" },
  ];

  for (const payload of invalidPayloads) {
    await assert.rejects(
      () => loadValidatedPublishedCatalogProjection(
        async () => responseFor(payload),
        responseOptions,
      ),
      (error: unknown) => error instanceof CloudPublishedCatalogRepositoryError
        && error.code === "invalid_payload"
        && error.message === "Published catalog is unavailable.",
    );
  }
});

test("transport and raw upstream failures are sanitized", async () => {
  const secretMarker = "service-role-secret-must-not-leak";
  for (const request of [
    async () => { throw new Error(secretMarker); },
    async () => responseFor({ message: secretMarker }, 500),
  ]) {
    await assert.rejects(
      () => loadValidatedPublishedCatalogProjection(request, responseOptions),
      (error: unknown) => error instanceof CloudPublishedCatalogRepositoryError
        && error.code === "transport"
        && !error.message.includes(secretMarker),
    );
  }
});

test("published repository is server-only, read-only, isolated from Preview and request-memoized", async () => {
  const [repository, mapper, response, index, catalog, homepage, sitemap] = await Promise.all([
    readFile("lib/storefront/cloud-published-catalog-repository.ts", "utf8"),
    readFile("lib/storefront/cloud-published-mapper.ts", "utf8"),
    readFile("lib/storefront/cloud-published-response.ts", "utf8"),
    readFile("lib/storefront/index.ts", "utf8"),
    readFile("components/catalog/CatalogExplorer.tsx", "utf8"),
    readFile("app/page.tsx", "utf8"),
    readFile("app/sitemap.ts", "utf8"),
  ]);
  const publishedPath = `${repository}\n${mapper}\n${response}`;

  assert.match(repository, /^import "server-only";/u);
  assert.match(repository, /createProjectBoundSupabaseServerClient/u);
  assert.match(repository, /cloud_published_storefront_catalog_v1/u);
  assert.match(repository, /"Accept-Profile": "cloud_api"/u);
  assert.match(repository, /"Content-Profile": "cloud_api"/u);
  assert.match(repository, /AbortSignal\.timeout\(timeoutMs\)/u);
  assert.match(repository, /loadResilientPublishedCatalogProjection/u);
  assert.match(repository, /cache\(requestCloudPublishedCatalog\)/u);
  assert.match(index, /createCatalogRepositoryForSource\(storefrontDataSource\)/u);
  assert.doesNotMatch(
    index,
    /CloudPublishedCatalogRepository|CloudPreviewCatalogRepository|FilesystemCatalogRepository/u,
  );
  assert.doesNotMatch(publishedPath, /cloud_storefront_preview_catalog|CloudPreviewCatalogRepository|cloud-preview-mapper/u);
  assert.doesNotMatch(publishedPath, /preview_draft/u);
  assert.doesNotMatch(
    repository,
    /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY)/u,
  );
  assert.doesNotMatch(repository, /\b(?:PATCH|PUT|DELETE)\b|insert into|update cloud\./iu);
  assert.match(catalog, /products\.length === 0/u);
  assert.match(homepage, /selectPublishedFeaturedProducts\(products\)/u);
  assert.match(sitemap, /loadCloudPublishedCatalog/u);
  assert.match(sitemap, /buildStorefrontSitemapFromCatalog/u);
});

test("published adapter does not change protected Storefront contracts", async () => {
  const [repositoryContract, productService, domainTypes] = await Promise.all([
    readFile("lib/storefront/catalog-repository.ts", "utf8"),
    readFile("lib/storefront/product-service.ts", "utf8"),
    readFile("lib/storefront/types.ts", "utf8"),
  ]);
  assert.equal(repositoryContract.includes("cloud_published"), false);
  assert.equal(productService.includes("cloud_published"), false);
  assert.equal(domainTypes.includes("cloud_published"), false);
});
