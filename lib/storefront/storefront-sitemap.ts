import type { MetadataRoute } from "next";

import { SEO_LANDING_PATHS } from "../seo/paths.ts";
import type { CategoryService } from "./category-service.ts";
import type { ManufacturerService } from "./manufacturer-service.ts";
import type { ProductService } from "./product-service.ts";
import { STOREFRONT_SITE_URL } from "./seo.ts";
import type { Category, Manufacturer, Product } from "./types.ts";
import { filterPublicManufacturers, publicPublishedProducts } from "./public-discovery.ts";

export { STOREFRONT_SITE_URL } from "./seo.ts";

interface StorefrontSitemapSources {
  productService: Pick<ProductService, "getActiveProducts">;
  manufacturerService: Pick<ManufacturerService, "getManufacturers">;
  categoryService: Pick<CategoryService, "getCategories">;
}

function absoluteUrl(path: string, siteUrl: string) {
  return new URL(path, siteUrl).toString();
}

function latestUpdatedAt(values: readonly { updatedAt: string }[]) {
  const timestamps = values
    .map(({ updatedAt }) => Date.parse(updatedAt))
    .filter(Number.isFinite);
  return new Date(timestamps.length ? Math.max(...timestamps) : 0);
}

export async function buildStorefrontSitemap(
  sources: StorefrontSitemapSources,
  siteUrl = STOREFRONT_SITE_URL,
): Promise<MetadataRoute.Sitemap> {
  const [products, manufacturers, categories] = await Promise.all([
    sources.productService.getActiveProducts(),
    sources.manufacturerService.getManufacturers(),
    sources.categoryService.getCategories(),
  ]);
  return buildStorefrontSitemapFromCatalog(
    { products, manufacturers, categories },
    siteUrl,
  );
}

interface StorefrontSitemapCatalog {
  products: readonly Product[];
  manufacturers: readonly Manufacturer[];
  categories: readonly Category[];
}

/** Builds every sitemap route from one coherent Storefront snapshot. */
export function buildStorefrontSitemapFromCatalog(
  { products, manufacturers, categories }: StorefrontSitemapCatalog,
  siteUrl = STOREFRONT_SITE_URL,
): MetadataRoute.Sitemap {
  const activeCategoryIds = new Set(categories.map(({ id }) => id));
  const sitemapProducts = publicPublishedProducts(products).filter(({ categoryId }) =>
    activeCategoryIds.has(categoryId),
  );
  const sitemapManufacturers = filterPublicManufacturers(
    manufacturers,
    sitemapProducts,
  );
  const lastModified = latestUpdatedAt([
    ...sitemapProducts,
    ...sitemapManufacturers,
    ...categories,
  ]);
  const url = (path: string) => absoluteUrl(path, siteUrl);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: url("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: url("/catalog"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: url("/manufacturers"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    ...SEO_LANDING_PATHS.map((path) => ({
      url: url(path),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: path === "/catalog/endoskopiya" ? 0.9 : 0.82,
    })),
  ];
  const productRoutes: MetadataRoute.Sitemap = sitemapProducts.map(
    (product) => ({
      url: url(`/catalog/${product.slug}`),
      lastModified: new Date(product.updatedAt),
      changeFrequency: "weekly",
      priority: 0.72,
    }),
  );
  const manufacturerRoutes: MetadataRoute.Sitemap = sitemapManufacturers.map(
    (manufacturer) => ({
      url: url(`/manufacturers/${manufacturer.slug}`),
      lastModified: new Date(manufacturer.updatedAt),
      changeFrequency: "monthly",
      priority: 0.62,
    }),
  );

  return [...staticRoutes, ...productRoutes, ...manufacturerRoutes];
}
