import "server-only";

import { cache } from "react";

import endoMarketStageSnapshotJson from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };

import { createSupabaseServerClient } from "../supabase/index.ts";
import type { CatalogRepository } from "./catalog-repository.ts";
import { loadCloudPublishedCatalog } from "./cloud-published-catalog-repository.ts";
import {
  mapCloudPreviewSnapshot,
  type CloudPreviewCatalogSnapshot,
} from "./cloud-preview-mapper.ts";
import { filterProductsForSearch } from "./search-service.ts";
import { isEndoMarketStagePreview } from "./data-source.ts";
import { composeEndoMarketStageCatalog } from "./endomarket-stage-catalog.ts";
import type { StorefrontCatalog } from "./types.ts";

type CatalogLoader = () => Promise<StorefrontCatalog>;

async function requestCloudPreviewCatalog(): Promise<StorefrontCatalog> {
  if (isEndoMarketStagePreview()) {
    const [publishedCatalog, stageCatalog] = await Promise.all([
      loadCloudPublishedCatalog(),
      Promise.resolve(mapCloudPreviewSnapshot(
        endoMarketStageSnapshotJson as unknown as CloudPreviewCatalogSnapshot,
      )),
    ]);
    return composeEndoMarketStageCatalog(publishedCatalog, stageCatalog);
  }
  const response = await createSupabaseServerClient({ access: "service_role" }).request(
    "/rest/v1/rpc/cloud_storefront_preview_catalog",
    {
      method: "POST",
      headers: {
        "Accept-Profile": "cloud_api",
        "Content-Profile": "cloud_api",
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  const snapshot = await response.json() as CloudPreviewCatalogSnapshot;
  return mapCloudPreviewSnapshot(snapshot);
}

export const loadCloudPreviewCatalog = cache(requestCloudPreviewCatalog);

export class CloudPreviewCatalogRepository implements CatalogRepository {
  private readonly loadCatalog: CatalogLoader;

  constructor(loadCatalog: CatalogLoader = loadCloudPreviewCatalog) {
    this.loadCatalog = loadCatalog;
  }

  private async load() {
    return this.loadCatalog();
  }

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
    const [products, manufacturers, categories] = await Promise.all([
      this.getProducts(), this.getManufacturers(), this.getCategories(),
    ]);
    return filterProductsForSearch(products, query, manufacturers, categories);
  }
  async getCatalogSummary() { return (await this.load()).summary; }
}
