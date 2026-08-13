import type { Category, Manufacturer, Product } from "./types.ts";
import { getApprovedManufacturerLogoUrl } from "./manufacturer-logo-policy.ts";
import {
  buildBreadcrumbJsonLd,
  STOREFRONT_SITE_NAME,
  STOREFRONT_SITE_URL,
} from "./seo.ts";

export type StorefrontSchema = Record<string, unknown>;
export type StorefrontStructuredData =
  | StorefrontSchema
  | readonly StorefrontSchema[];

interface PageSchemaInput {
  name: string;
  description: string;
  path: `/${string}` | "/";
}

interface ProductSchemaInput {
  product: Product;
  manufacturer?: Manufacturer;
  category?: Category;
  breadcrumbName?: string;
}

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, STOREFRONT_SITE_URL).toString();
}

function websiteReference() {
  return {
    "@type": "WebSite",
    name: STOREFRONT_SITE_NAME,
    url: absoluteUrl("/"),
  };
}

export function buildHomepageStructuredData(
  description: string,
): StorefrontSchema[] {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: STOREFRONT_SITE_NAME,
    url: absoluteUrl("/"),
    description,
  };

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: STOREFRONT_SITE_NAME,
      url: absoluteUrl("/"),
      description,
      publisher: {
        "@type": "Organization",
        name: STOREFRONT_SITE_NAME,
        url: absoluteUrl("/"),
      },
    },
    organization,
  ];
}

export function buildCollectionPageStructuredData({
  name,
  description,
  path,
}: PageSchemaInput): StorefrontSchema {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: absoluteUrl(path),
    isPartOf: websiteReference(),
  };
}

export function buildProductStructuredData({
  product,
  manufacturer,
  category,
  breadcrumbName = product.name,
}: ProductSchemaInput): StorefrontSchema[] {
  const images = product.media
    .filter(({ type }) => type === "image")
    .map(({ url }) => absoluteUrl(url));
  const productSchema: StorefrontSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: absoluteUrl(`/catalog/${product.slug}`),
    ...(images.length > 0 ? { image: images } : {}),
    ...(manufacturer
      ? {
          brand: {
            "@type": "Brand",
            name: manufacturer.name,
          },
        }
      : {}),
    ...(category ? { category: category.name } : {}),
    ...(product.model ? { mpn: product.model } : {}),
    ...(product.specifications.length > 0
      ? {
          additionalProperty: product.specifications.map((specification) => ({
            "@type": "PropertyValue",
            name: specification.label,
            value: specification.value,
            ...(specification.unit ? { unitText: specification.unit } : {}),
          })),
        }
      : {}),
  };

  return [
    productSchema,
    buildBreadcrumbJsonLd([
      { name: "Главная", path: "/" },
      { name: "Каталог", path: "/catalog" },
      ...(category
        ? [{
            name: category.name,
            path: `/catalog?category=${encodeURIComponent(category.slug)}` as const,
          }]
        : []),
      { name: breadcrumbName, path: `/catalog/${product.slug}` },
    ]),
  ];
}

export function buildManufacturerStructuredData(
  manufacturer: Manufacturer,
): StorefrontSchema[] {
  const path = `/manufacturers/${manufacturer.slug}` as const;
  const approvedLogoUrl = getApprovedManufacturerLogoUrl(manufacturer.slug);
  const organization: StorefrontSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: manufacturer.name,
    description: manufacturer.description,
    url: absoluteUrl(path),
    ...(approvedLogoUrl
      ? { logo: absoluteUrl(approvedLogoUrl) }
      : {}),
  };

  return [
    organization,
    buildBreadcrumbJsonLd([
      { name: "Главная", path: "/" },
      { name: "Производители", path: "/manufacturers" },
      { name: manufacturer.name, path },
    ]),
  ];
}
