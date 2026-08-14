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

function plainStructuredDataText(value: string) {
  return value
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<\/(?:p|li|h[1-6])>/giu, " ")
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;|&#38;/giu, "&")
    .replace(/&lt;|&#60;/giu, "<")
    .replace(/&gt;|&#62;/giu, ">")
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function structuredDataImageUrl(pathOrUrl: string) {
  const imageUrl = absoluteUrl(pathOrUrl);
  if (new URL(imageUrl).origin === STOREFRONT_SITE_URL) return imageUrl;

  const search = new URLSearchParams({
    url: imageUrl,
    w: "1200",
    q: "75",
  });
  return absoluteUrl(`/_next/image?${search.toString()}`);
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
    .map(({ url }) => structuredDataImageUrl(url));
  const canonicalUrl = absoluteUrl(`/catalog/${product.slug}`);
  const description = plainStructuredDataText(product.description);
  const itemPageSchema: StorefrontSchema = {
    "@context": "https://schema.org",
    "@type": "ItemPage",
    name: breadcrumbName,
    description,
    url: canonicalUrl,
    inLanguage: "ru-RU",
    isPartOf: websiteReference(),
    mainEntity: {
      "@type": "Thing",
      name: breadcrumbName,
      description,
      url: canonicalUrl,
      ...(product.model ? { identifier: product.model } : {}),
      ...(images.length > 0 ? { image: images } : {}),
    },
    ...(images.length > 0
      ? {
          primaryImageOfPage: {
            "@type": "ImageObject",
            contentUrl: images[0],
            caption: breadcrumbName,
          },
        }
      : {}),
    ...(manufacturer
      ? {
          provider: {
            "@type": "Organization",
            name: manufacturer.name,
          },
        }
      : {}),
    ...(category ? { keywords: category.name } : {}),
  };

  return [
    itemPageSchema,
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
