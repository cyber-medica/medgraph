import implementationManifest from "../../data/seo/source/cybermedica-seo-implementation-manifest-v2.json" with { type: "json" };
import identityManifest from "../../data/seo/product-link-identities-v2.json" with { type: "json" };
import { buildStorefrontMetadata } from "../storefront/seo.ts";
import type { Manufacturer, Product } from "../storefront/types.ts";
import { SEO_P0_PATHS, type SeoP0Path } from "./paths.ts";

export { SEO_P0_PATHS, type SeoP0Path } from "./paths.ts";

export interface SeoLandingContent {
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: readonly (readonly [string, string])[];
  faq: readonly (readonly [string, string])[];
  cta: Readonly<{ title?: string; body: string }>;
}

export interface SeoLandingLink {
  href: `/${string}`;
  label: string;
  kind: "landing" | "product" | "manufacturer";
}

export const SEO_CANONICAL_ORIGIN = implementationManifest.canonicalOrigin;
export const SEO_STAGE_ORIGIN = implementationManifest.stageOrigin;

function normalizePublicBrand(value: string) {
  return value.replaceAll("CyberMedica", "Кибермедика");
}

export function getSeoLanding(path: SeoP0Path): SeoLandingContent {
  const landing = implementationManifest.p0Landings[path];
  return {
    title: normalizePublicBrand(landing.title),
    description: normalizePublicBrand(landing.description),
    h1: normalizePublicBrand(landing.h1),
    intro: normalizePublicBrand(landing.intro),
    sections: landing.sections.map(([title, body]) => [
      normalizePublicBrand(title),
      normalizePublicBrand(body),
    ] as const),
    faq: landing.faq.map(([question, answer]) => [
      normalizePublicBrand(question),
      normalizePublicBrand(answer),
    ] as const),
    cta: {
      title: normalizePublicBrand(landing.cta.title),
      body: normalizePublicBrand(landing.cta.body),
    },
  };
}

export function buildSeoLandingMetadata(path: SeoP0Path) {
  const landing = getSeoLanding(path);
  return buildStorefrontMetadata({
    title: landing.title,
    description: landing.description,
    canonical: path,
    absoluteTitle: true,
  });
}

export function isSeoP0Path(path: string): path is SeoP0Path {
  return (SEO_P0_PATHS as readonly string[]).includes(path);
}

function matchesProductIdentity(
  product: Product,
  identity: (typeof identityManifest.products)[number],
) {
  return product.id === identity.productId
    && product.slug === identity.slug
    && product.model === identity.model;
}

function matchesManufacturerIdentity(
  manufacturer: Manufacturer,
  identity: (typeof identityManifest.manufacturers)[number],
) {
  return manufacturer.id === identity.manufacturerId
    && manufacturer.slug === identity.slug
    && manufacturer.name === identity.name;
}

/**
 * Resolves the approved link graph against the current visible catalog.
 * Missing or drifted identities are omitted rather than replaced by a guessed link.
 */
export function resolveSeoLandingLinks(
  path: SeoP0Path,
  products: readonly Product[],
  manufacturers: readonly Manufacturer[],
): SeoLandingLink[] {
  const requestedLinks = implementationManifest.linkGraph[path] as readonly string[];
  const productsById = new Map(products.map((product) => [product.id, product]));
  const manufacturersById = new Map(
    manufacturers.map((manufacturer) => [manufacturer.id, manufacturer]),
  );

  return requestedLinks.flatMap((requested): SeoLandingLink[] => {
    if (isSeoP0Path(requested)) {
      return [{
        href: requested,
        label: getSeoLanding(requested).h1,
        kind: "landing",
      }];
    }

    const productIdentity = identityManifest.products.find(
      ({ key }) => key === requested,
    );
    if (productIdentity) {
      const product = productsById.get(productIdentity.productId);
      if (!product || !matchesProductIdentity(product, productIdentity)) return [];
      return [{
        href: `/catalog/${product.slug}`,
        label: product.name,
        kind: "product",
      }];
    }

    const manufacturerIdentity = identityManifest.manufacturers.find(
      ({ key }) => key === requested,
    );
    if (manufacturerIdentity) {
      const manufacturer = manufacturersById.get(manufacturerIdentity.manufacturerId);
      if (!manufacturer || !matchesManufacturerIdentity(manufacturer, manufacturerIdentity)) {
        return [];
      }
      return [{
        href: `/manufacturers/${manufacturer.slug}`,
        label: manufacturer.name,
        kind: "manufacturer",
      }];
    }

    return [];
  });
}

export function buildSeoLandingBreadcrumbs(path: SeoP0Path) {
  const landing = getSeoLanding(path);
  const isRoot = path === "/catalog/endoskopiya";
  return [
    { name: "Главная", path: "/" as const },
    { name: "Каталог", path: "/catalog" as const },
    ...(isRoot
      ? []
      : [{ name: "Оборудование для эндоскопии", path: "/catalog/endoskopiya" as const }]),
    { name: landing.h1, path },
  ];
}

export const seoImplementationManifest = implementationManifest;
export const seoIdentityManifest = identityManifest;
