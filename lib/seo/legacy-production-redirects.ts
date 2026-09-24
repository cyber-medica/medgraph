import legacyInventoryJson from "../../data/seo/legacy-url-inventory-v3.json" with { type: "json" };

export const LEGACY_TILDA_PRODUCT_REDIRECTS = new Map<string, string>([
  [
    "/catalog/tproduct/767632362-163731865692-uzi-apparat-mindray-resona-7",
    "/catalog/767632362-163731865692-uzi-apparat-mindray-resona-7",
  ],
  [
    "/catalog/tproduct/767632362-513492182572-gastrofibroskop-pentax-fg-29v",
    "/catalog/767632362-513492182572-gastrofibroskop-pentax-fg-29v",
  ],
  [
    "/catalog/tproduct/767632362-159912360691-portativnii-monitor-patsienta-benevision",
    "/catalog/767632362-159912360691-portativnii-monitor-patsienta-benevision",
  ],
]);

export type LegacyProductAction = "REDIRECT" | "GONE" | "REVIEW";

export interface LegacyProductRouteMapping {
  stableProductIdentifier: string;
  currentCanonicalPath: string | null;
  action: LegacyProductAction;
}

export type LegacyProductRouteResolution = LegacyProductRouteMapping | null;
export type LegacyProductPathResolver = (
  pathname: string,
) => LegacyProductRouteResolution;

export type LegacyProductionRouteResolution =
  | { status: 301; destination: string }
  | { status: 410 }
  | null;

const LEGACY_PRODUCT_PATH_PATTERN =
  /^\/catalog\/(?:tproduct|product)\/767632362-(\d{12})(?:-[^/]+)?$/u;

/** Builds a stable-ID resolver and rejects ambiguous inventory at module load. */
export function createLegacyProductPathResolver(
  mappings: readonly LegacyProductRouteMapping[],
): LegacyProductPathResolver {
  const mappingsByStableId = new Map<string, LegacyProductRouteMapping>();

  for (const mapping of mappings) {
    if (mappingsByStableId.has(mapping.stableProductIdentifier)) {
      throw new Error(
        `Duplicate legacy Product stable ID: ${mapping.stableProductIdentifier}`,
      );
    }
    if (
      mapping.action === "REDIRECT"
      && !mapping.currentCanonicalPath?.match(/^\/catalog\/[^/]+$/u)
    ) {
      throw new Error(
        `Legacy Product ${mapping.stableProductIdentifier} has no exact canonical destination.`,
      );
    }
    mappingsByStableId.set(mapping.stableProductIdentifier, mapping);
  }

  return (pathname) => {
    const stableProductIdentifier = pathname.match(
      LEGACY_PRODUCT_PATH_PATTERN,
    )?.[1];
    return stableProductIdentifier
      ? mappingsByStableId.get(stableProductIdentifier) ?? null
      : null;
  };
}

const resolveLegacyProductPath = createLegacyProductPathResolver(
  legacyInventoryJson.mappings as unknown as readonly LegacyProductRouteMapping[],
);

const LEGACY_BRAND_DESTINATIONS = [
  { pattern: /mindray/iu, destination: "/manufacturers/mindray" },
  { pattern: /pentax/iu, destination: "/manufacturers/pentax-medical" },
  {
    pattern: /(?:general\s*electric|\bge\b)/iu,
    destination: "/manufacturers/ge-healthcare",
  },
] as const;

function legacyTildaFilters(url: URL) {
  return [...url.searchParams.entries()].filter(([key]) => key.startsWith("tfc_"));
}

/** Resolves an approved redirect or an evidence-backed Gone response. */
export function resolveLegacyProductionRoute(
  url: URL,
  resolveProduct: LegacyProductPathResolver = resolveLegacyProductPath,
): LegacyProductionRouteResolution {
  const exactProductDestination = LEGACY_TILDA_PRODUCT_REDIRECTS.get(url.pathname);
  if (exactProductDestination) {
    return { status: 301, destination: exactProductDestination };
  }

  const product = resolveProduct(url.pathname);
  if (product?.action === "REDIRECT" && product.currentCanonicalPath) {
    return { status: 301, destination: product.currentCanonicalPath };
  }
  if (product?.action === "GONE") return { status: 410 };
  if (url.pathname !== "/catalog") return null;

  const filters = legacyTildaFilters(url);
  if (filters.length === 0) return null;

  const brandFilters = filters.filter(([key]) => key.startsWith("tfc_brand"));
  if (filters.length === 1 && brandFilters.length === 1) {
    const value = brandFilters[0]?.[1] ?? "";
    const mapping = LEGACY_BRAND_DESTINATIONS.find(({ pattern }) => pattern.test(value));
    if (mapping) return { status: 301, destination: mapping.destination };
  }

  return { status: 301, destination: "/catalog" };
}

/** Returns a canonical one-hop destination for an approved legacy URL. */
export function resolveLegacyProductionRedirect(url: URL): string | null {
  const resolution = resolveLegacyProductionRoute(url);
  return resolution?.status === 301 ? resolution.destination : null;
}
