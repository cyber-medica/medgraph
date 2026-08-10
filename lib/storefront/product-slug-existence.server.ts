import "server-only";

import { getStorefrontDataSource } from "./data-source.ts";

export type ProductSlugExistence = "exists" | "missing" | "unavailable";

export async function readVisibleProductSlugExistence(
  slug: string,
): Promise<ProductSlugExistence> {
  try {
    const source = getStorefrontDataSource();
    if (source === "cloud_published") {
      const { loadCloudPublishedCatalog } = await import(
        "./cloud-published-catalog-repository.ts"
      );
      const catalog = await loadCloudPublishedCatalog();
      return catalog.products.some((product) => product.slug === slug)
        ? "exists"
        : "missing";
    }

    if (source === "cloud_preview") {
      const { loadCloudPreviewCatalog } = await import(
        "./cloud-preview-catalog-repository.ts"
      );
      const catalog = await loadCloudPreviewCatalog();
      return catalog.products.some((product) => product.slug === slug)
        ? "exists"
        : "missing";
    }

    const { FilesystemCatalogRepository } = await import(
      "./filesystem-catalog-repository.ts"
    );
    const product = await new FilesystemCatalogRepository().getProductBySlug(slug);
    return product ? "exists" : "missing";
  } catch {
    // Transport failure is not evidence that a public Product is missing.
    return "unavailable";
  }
}
