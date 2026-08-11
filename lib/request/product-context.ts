import type { CatalogRepository } from "../storefront/catalog-repository.ts";
import type { ProductService } from "../storefront/product-service.ts";
import {
  PUBLIC_PRODUCT_STATUSES,
  type Product,
} from "../storefront/types.ts";

export interface RequestProductContext {
  id: string;
  slug: string;
  title: string;
  model: string;
  manufacturer: string | null;
}

interface RequestProductSelection {
  id?: string | null;
  slug?: string | null;
}

interface RequestProductContextDependencies {
  productService: Pick<ProductService, "getProductBySlug">;
  catalogRepository: Pick<CatalogRepository, "getManufacturers">;
}

function normalizeSelectionValue(value: string | null | undefined, limit: number) {
  return value?.trim().slice(0, limit) || null;
}

export function buildProductRequestHref(product: Pick<Product, "id" | "slug">) {
  const searchParams = new URLSearchParams({
    product: product.slug,
    productId: product.id,
  });
  return `/request?${searchParams.toString()}`;
}

export async function resolveRequestProductContext(
  selection: RequestProductSelection,
  dependencies: RequestProductContextDependencies,
): Promise<RequestProductContext | null> {
  const slug = normalizeSelectionValue(selection.slug, 240);
  const expectedId = normalizeSelectionValue(selection.id, 200);

  if (!slug) return null;

  const product = await dependencies.productService.getProductBySlug(slug);
  if (
    !product
    || !PUBLIC_PRODUCT_STATUSES.has(product.status)
    || (expectedId && product.id !== expectedId)
  ) return null;

  const manufacturers = await dependencies.catalogRepository.getManufacturers();
  const manufacturer = manufacturers.find(({ id }) => id === product.manufacturerId);

  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    model: product.model,
    manufacturer: manufacturer?.name ?? null,
  };
}
