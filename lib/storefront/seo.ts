import type { Metadata } from "next";
import { isProductionIndexingEnvironment } from "./indexing.ts";
import type { Category, Product } from "./types.ts";

export const STOREFRONT_SITE_URL = "https://cyber-medica.ru";
export const STOREFRONT_SITE_NAME = "Кибермедика";

export function normalizePublicBrand(value: string) {
  return value
    .replaceAll("CyberMedica", STOREFRONT_SITE_NAME)
    .replaceAll("CYBERMEDICA", STOREFRONT_SITE_NAME)
    .replaceAll("Cybermedica", STOREFRONT_SITE_NAME);
}

interface StorefrontSeoImage {
  url: string;
  alt: string;
}

interface StorefrontMetadataInput {
  title: string;
  description: string;
  canonical: `/${string}` | "/";
  image?: StorefrontSeoImage;
  noindexFollow?: boolean;
  absoluteTitle?: boolean;
}

export interface StorefrontBreadcrumbItem {
  name: string;
  path: `/${string}` | "/";
}

export function buildStorefrontMetadata({
  title,
  description,
  canonical,
  image,
  noindexFollow = false,
  absoluteTitle = false,
}: StorefrontMetadataInput): Metadata {
  const images = image ? [{ url: image.url, alt: image.alt }] : undefined;
  const allowIndexing = isProductionIndexingEnvironment();
  const publicTitle = normalizePublicBrand(title);
  const publicDescription = normalizePublicBrand(description);

  return {
    title: absoluteTitle ? { absolute: publicTitle } : publicTitle,
    description: publicDescription,
    alternates: { canonical },
    robots: {
      index: allowIndexing && !noindexFollow,
      follow: allowIndexing,
    },
    openGraph: {
      title: publicTitle,
      description: publicDescription,
      url: canonical,
      siteName: STOREFRONT_SITE_NAME,
      locale: "ru_RU",
      type: "website",
      images,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: publicTitle,
      description: publicDescription,
      images: image ? [image.url] : undefined,
    },
  };
}

export function getPlainProductType(
  product: Pick<Product, "specifications">,
  category?: Pick<Category, "name">,
) {
  const typeSpecification = product.specifications.find(
    ({ label, value }) => label.trim().toLocaleLowerCase("ru-RU") === "тип товара"
      && value.trim().length > 0,
  );
  return typeSpecification?.value.trim()
    ?? category?.name.trim()
    ?? "медицинское оборудование";
}

export function buildBreadcrumbJsonLd(items: StorefrontBreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, STOREFRONT_SITE_URL).toString(),
    })),
  };
}

export function serializeStorefrontJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
