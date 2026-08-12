import "server-only";

import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import publishedCatalogSnapshotJson from "../../data/published-catalog-last-known-good.json" with { type: "json" };

import {
  createProjectBoundSupabaseServerClient,
  LOCAL_SUPABASE_ORIGIN_OPT_IN,
} from "../supabase/index.ts";
import type { CatalogRepository } from "./catalog-repository.ts";
import { mapCloudPublishedCatalogProjection } from "./cloud-published-mapper.ts";
import { applyFinalStageAcceptanceCorrectiveV2 } from "./final-stage-acceptance-corrective-v2.ts";
import {
  CloudPublishedCatalogRepositoryError,
} from "./cloud-published-response.ts";
import { loadResilientPublishedCatalogProjection } from "./published-catalog-resilience.ts";
import { filterProductsForSearch } from "./search-service.ts";
import type { StorefrontCatalog } from "./types.ts";
import type { PublishedCatalogProjection } from "../published-catalog/contracts.ts";

type CatalogLoader = () => Promise<StorefrontCatalog>;

export const PUBLISHED_CATALOG_CACHE_REVALIDATE_SECONDS = 60;
export const PUBLISHED_CATALOG_CACHE_TAG = "published-catalog-projection";

let developmentFaultRequestCount = 0;

function developmentFaultResponse(): Response | null {
  if (process.env.VERCEL_ENV === "production") return null;
  const mode = process.env.CYBERMEDICA_CATALOG_FAULT_INJECTION;
  developmentFaultRequestCount += 1;
  if (mode === "all" || (mode === "first" && developmentFaultRequestCount === 1)) {
    return new Response(null, { status: 503 });
  }
  if (mode === "empty") {
    return new Response(JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      products: [],
      manufacturers: [],
      categories: [],
      applicationAreas: [],
      summary: {
        productCount: 0,
        manufacturerCount: 0,
        categoryCount: 0,
        applicationAreaCount: 0,
      },
    }), { status: 200 });
  }
  return null;
}

async function requestCloudPublishedCatalogUncached(): Promise<StorefrontCatalog> {
  let client;
  try {
    const allowLocalDevelopment = process.env[LOCAL_SUPABASE_ORIGIN_OPT_IN] === "1"
      && process.env.VERCEL_ENV === undefined
      && process.env.VERCEL !== "1";
    client = createProjectBoundSupabaseServerClient({
      environment: process.env,
      allowLocalDevelopment,
    });
  } catch {
    throw new CloudPublishedCatalogRepositoryError("configuration");
  }

  const projection = await loadResilientPublishedCatalogProjection({
    request: (_attempt, timeoutMs) => {
      const injected = developmentFaultResponse();
      if (injected) return Promise.resolve(injected);
      return client.request("/rest/v1/rpc/cloud_published_storefront_catalog_v1", {
        method: "POST",
        headers: {
          "Accept-Profile": "cloud_api",
          "Content-Profile": "cloud_api",
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(timeoutMs),
      });
    },
    rethrowFrameworkError: unstable_rethrow,
  });
  const liveCatalog = mapCloudPublishedCatalogProjection(projection);
  const canonicalCatalog = mapCloudPublishedCatalogProjection(
    publishedCatalogSnapshotJson.projection as unknown as PublishedCatalogProjection,
  );
  return applyFinalStageAcceptanceCorrectiveV2(liveCatalog, canonicalCatalog);
}

/**
 * Public pages reuse one validated projection across anonymous requests for at
 * most 60 seconds. The cached value has already passed the complete projection
 * and last-known-good validation boundary above; invalid or partial upstream
 * payloads can never become a new cache entry.
 */
const requestCloudPublishedCatalog = unstable_cache(
  requestCloudPublishedCatalogUncached,
  ["cloud-published-storefront-catalog-v1"],
  {
    revalidate: PUBLISHED_CATALOG_CACHE_REVALIDATE_SECONDS,
    tags: [PUBLISHED_CATALOG_CACHE_TAG],
  },
);

/** One shared validated read plus request memoization for public rendering. */
export const loadCloudPublishedCatalog = cache(requestCloudPublishedCatalog);

/**
 * Health diagnostics intentionally bypass the shared read cache so a cached
 * live projection can never be reported as proof of current transport health.
 */
export const loadCloudPublishedCatalogFresh = cache(
  requestCloudPublishedCatalogUncached,
);

export class CloudPublishedCatalogRepository implements CatalogRepository {
  private readonly loadCatalog: CatalogLoader;

  constructor(loadCatalog: CatalogLoader = loadCloudPublishedCatalog) {
    this.loadCatalog = loadCatalog;
  }

  private load() { return this.loadCatalog(); }
  async getProducts() { return (await this.load()).products; }
  async getActiveProducts() { return this.getProducts(); }
  async getProductBySlug(slug: string) {
    return (await this.getProducts()).find((product) => product.slug === slug) ?? null;
  }
  async getProductsByManufacturer(manufacturerId: string) {
    return (await this.getProducts()).filter((product) => product.manufacturerId === manufacturerId);
  }
  async getProductsByCategory(categoryId: string) {
    return (await this.getProducts()).filter((product) => product.categoryId === categoryId);
  }
  async getFeaturedProducts() { return []; }
  async getManufacturers() { return (await this.load()).manufacturers; }
  async getManufacturerBySlug(slug: string) {
    return (await this.getManufacturers()).find((manufacturer) => manufacturer.slug === slug) ?? null;
  }
  async getCategories() { return (await this.load()).categories; }
  async getCategoryBySlug(slug: string) {
    return (await this.getCategories()).find((category) => category.slug === slug) ?? null;
  }
  async searchProducts(query: string) {
    const catalog = await this.load();
    return filterProductsForSearch(
      catalog.products,
      query,
      catalog.manufacturers,
      catalog.categories,
    );
  }
  async getCatalogSummary() { return (await this.load()).summary; }
}
