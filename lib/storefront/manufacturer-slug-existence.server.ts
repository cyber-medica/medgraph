import "server-only";

import { getStorefrontDataSource } from "./data-source.ts";
import { filterPublicManufacturers } from "./public-discovery.ts";

export type ManufacturerSlugExistence = "exists" | "missing" | "unavailable";

export async function readPublicManufacturerSlugExistence(
  slug: string,
): Promise<ManufacturerSlugExistence> {
  try {
    const source = getStorefrontDataSource();
    if (source === "cloud_published") {
      const { loadCloudPublishedCatalog } = await import(
        "./cloud-published-catalog-repository.ts"
      );
      const catalog = await loadCloudPublishedCatalog();
      return filterPublicManufacturers(catalog.manufacturers, catalog.products)
        .some((manufacturer) => manufacturer.slug === slug)
        ? "exists"
        : "missing";
    }

    if (source === "cloud_preview") {
      const { loadCloudPreviewCatalog } = await import(
        "./cloud-preview-catalog-repository.ts"
      );
      const catalog = await loadCloudPreviewCatalog();
      return filterPublicManufacturers(catalog.manufacturers, catalog.products)
        .some((manufacturer) => manufacturer.slug === slug)
        ? "exists"
        : "missing";
    }

    const { FilesystemCatalogRepository } = await import(
      "./filesystem-catalog-repository.ts"
    );
    const repository = new FilesystemCatalogRepository();
    const [manufacturers, products] = await Promise.all([
      repository.getManufacturers(),
      repository.getActiveProducts(),
    ]);
    return filterPublicManufacturers(manufacturers, products)
      .some((manufacturer) => manufacturer.slug === slug)
      ? "exists"
      : "missing";
  } catch {
    // A transport failure is not evidence that a public manufacturer is missing.
    return "unavailable";
  }
}
