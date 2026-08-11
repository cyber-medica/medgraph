import manufacturerContractJson from "../../data/seo/source/v3/cybermedica_manufacturer_seo_contract_v3.json" with { type: "json" };
import p1LandingsJson from "../../data/seo/source/v3/cybermedica_seo_p1_landings_v3.json" with { type: "json" };
import p1LinkIdentitiesJson from "../../data/seo/p1-link-identities-v3.json" with { type: "json" };
import productMetadataJson from "../../data/seo/product-metadata-identities-v3.json" with { type: "json" };
import {
  buildSeoLandingBreadcrumbs as buildSeoLandingBreadcrumbsV2,
  getSeoLanding as getSeoLandingV2,
  resolveSeoLandingLinks as resolveSeoLandingLinksV2,
  type SeoLandingContent,
  type SeoLandingLink,
} from "./implementation-v2.ts";
import {
  SEO_P0_PATHS,
  SEO_P1_PATHS,
  type SeoLandingPath,
  type SeoP0Path,
  type SeoP1Path,
} from "./paths.ts";
import {
  buildStorefrontMetadata,
  getPlainProductType,
  normalizePublicBrand,
} from "../storefront/seo.ts";
import type { Category, Manufacturer, Product } from "../storefront/types.ts";

export {
  SEO_LANDING_PATHS,
  SEO_P0_PATHS,
  SEO_P1_PATHS,
  type SeoLandingPath,
  type SeoP0Path,
  type SeoP1Path,
} from "./paths.ts";

type ProductMetadataEntry = (typeof productMetadataJson.products)[number];
const MANUFACTURER_SPECIFIC_NAMES = [
  "SonoScape",
  "Medinova",
  "Hamilton Medical",
  "Mindray",
] as const;
type ManufacturerSpecificName = (typeof MANUFACTURER_SPECIFIC_NAMES)[number];

export interface ManufacturerSeoContent {
  title: string;
  description: string;
  h1: string;
  intro: string;
  priorityLinks: readonly string[];
  source: "specific" | "generic";
}

function isSeoP0Path(path: SeoLandingPath): path is SeoP0Path {
  return (SEO_P0_PATHS as readonly string[]).includes(path);
}

function isSeoP1Path(path: string): path is SeoP1Path {
  return (SEO_P1_PATHS as readonly string[]).includes(path);
}

export function getSeoLandingV3(path: SeoLandingPath): SeoLandingContent {
  if (isSeoP0Path(path)) return getSeoLandingV2(path);

  const landing = p1LandingsJson[path];
  return {
    title: normalizePublicBrand(landing.title),
    description: normalizePublicBrand(landing.metaDescription),
    h1: normalizePublicBrand(landing.h1),
    intro: normalizePublicBrand(landing.intro),
    sections: landing.sections.map(({ h2, body }) => [
      normalizePublicBrand(h2),
      normalizePublicBrand(body),
    ] as const),
    faq: landing.faq.map(({ q, a }) => [
      normalizePublicBrand(q),
      normalizePublicBrand(a),
    ] as const),
    cta: { body: normalizePublicBrand(landing.cta) },
  };
}

export function buildSeoLandingMetadataV3(path: SeoLandingPath) {
  const landing = getSeoLandingV3(path);
  return buildStorefrontMetadata({
    title: landing.title,
    description: landing.description,
    canonical: path,
    absoluteTitle: true,
  });
}

export function buildSeoLandingBreadcrumbsV3(path: SeoLandingPath) {
  if (isSeoP0Path(path)) return buildSeoLandingBreadcrumbsV2(path);
  return [
    { name: "Главная", path: "/" as const },
    { name: "Каталог", path: "/catalog" as const },
    { name: getSeoLandingV3(path).h1, path },
  ];
}

export function resolveSeoLandingLinksV3(
  path: SeoLandingPath,
  products: readonly Product[],
  manufacturers: readonly Manufacturer[],
): SeoLandingLink[] {
  if (isSeoP0Path(path)) {
    return resolveSeoLandingLinksV2(path, products, manufacturers);
  }

  const requested = p1LinkIdentitiesJson.linkGraph[path];
  return requested.flatMap((key): SeoLandingLink[] => {
    const identity = p1LinkIdentitiesJson.products.find((entry) => entry.key === key);
    if (!identity) return [];
    const product = products.find(({ slug }) => slug === identity.slug);
    if (
      !product
      || product.model !== identity.model
      || product.manufacturerId !== identity.manufacturerSlug
    ) {
      return [];
    }
    return [{
      href: `/catalog/${identity.slug}`,
      label: product.name,
      kind: "product",
    }];
  });
}

export function getExactProductSeo(
  product: Pick<Product, "slug" | "model" | "manufacturerId">,
): ProductMetadataEntry | null {
  const entry = productMetadataJson.products.find(({ slug }) => slug === product.slug);
  if (
    !entry
    || entry.model !== product.model
    || entry.manufacturerSlug !== product.manufacturerId
  ) {
    return null;
  }
  return entry;
}

export function buildProductSeoMetadataV3({
  product,
  category,
  image,
  fallbackDescription,
}: {
  product: Product;
  category?: Pick<Category, "name">;
  image?: { url: string; alt: string };
  fallbackDescription?: string;
}) {
  const approved = getExactProductSeo(product);
  if (approved) {
    return buildStorefrontMetadata({
      title: approved.title,
      description: approved.description,
      canonical: approved.canonical as `/catalog/${string}`,
      image,
      absoluteTitle: true,
    });
  }

  return buildStorefrontMetadata({
    title: `${product.name} — ${getPlainProductType(product, category)}`,
    description: product.seoDescription
      ?? fallbackDescription
      ?? product.description,
    canonical: `/catalog/${product.slug}`,
    image,
  });
}

export function getProductSeoH1(product: Product) {
  return getExactProductSeo(product)?.h1 ?? product.name;
}

function replaceManufacturer(value: string, manufacturer: string) {
  return normalizePublicBrand(value.replaceAll("{Manufacturer}", manufacturer));
}

export function getManufacturerSeoContent(
  manufacturer: Pick<Manufacturer, "name" | "slug" | "description">,
): ManufacturerSeoContent {
  const specificName = MANUFACTURER_SPECIFIC_NAMES.find(
    (name): name is ManufacturerSpecificName => name === manufacturer.name,
  );
  const specific = specificName ? manufacturerContractJson[specificName] : null;

  if (specific && specific.path === `/manufacturers/${manufacturer.slug}`) {
    const value = specific;
    return {
      title: normalizePublicBrand(value.title),
      description: normalizePublicBrand(value.description),
      h1: normalizePublicBrand(value.h1),
      intro: normalizePublicBrand(value.intro),
      priorityLinks: value.priorityLinks,
      source: "specific",
    };
  }

  const generic = manufacturerContractJson.genericRule;
  return {
    title: replaceManufacturer(generic.title, manufacturer.name),
    description: replaceManufacturer(generic.description, manufacturer.name),
    h1: replaceManufacturer(generic.h1, manufacturer.name),
    intro: normalizePublicBrand(manufacturer.description),
    priorityLinks: [],
    source: "generic",
  };
}

export function buildManufacturerSeoMetadataV3(
  manufacturer: Pick<Manufacturer, "name" | "slug" | "description" | "logoUrl">,
  image?: { url: string; alt: string },
) {
  const content = getManufacturerSeoContent(manufacturer);
  return buildStorefrontMetadata({
    title: content.title,
    description: content.description,
    canonical: `/manufacturers/${manufacturer.slug}`,
    image,
    absoluteTitle: true,
  });
}

export function orderManufacturerProductsV3(
  products: readonly Product[],
  priorityModels: readonly string[],
) {
  const priority = new Map(priorityModels.map((model, index) => [model, index]));
  return [...products].sort((left, right) => {
    const leftRank = priority.get(left.model) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = priority.get(right.model) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.name.localeCompare(right.name, "ru");
  });
}

export const seoProductMetadataManifestV3 = productMetadataJson;
export const seoManufacturerContractV3 = manufacturerContractJson;
export const seoP1LandingsV3 = p1LandingsJson;
export const seoP1LinkIdentitiesV3 = p1LinkIdentitiesJson;
export { isSeoP1Path };
