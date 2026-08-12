import {
  PUBLIC_PRODUCT_STATUSES,
  type Manufacturer,
  type Product,
} from "./types.ts";

export function publicPublishedProducts(products: readonly Product[]) {
  return products.filter(({ status }) => PUBLIC_PRODUCT_STATUSES.has(status));
}

export function publicManufacturerIds(products: readonly Product[]) {
  return new Set(
    publicPublishedProducts(products).map(({ manufacturerId }) => manufacturerId),
  );
}

export function filterPublicManufacturers(
  manufacturers: readonly Manufacturer[],
  products: readonly Product[],
) {
  const visibleIds = publicManufacturerIds(products);
  return manufacturers.filter(
    ({ id, status }) => status === "active" && visibleIds.has(id),
  );
}
