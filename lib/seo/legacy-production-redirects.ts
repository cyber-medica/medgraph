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

/** Returns a canonical one-hop destination for an approved legacy URL. */
export function resolveLegacyProductionRedirect(url: URL): string | null {
  const exactProductDestination = LEGACY_TILDA_PRODUCT_REDIRECTS.get(url.pathname);
  if (exactProductDestination) return exactProductDestination;
  if (url.pathname !== "/catalog") return null;

  const filters = legacyTildaFilters(url);
  if (filters.length === 0) return null;

  const brandFilters = filters.filter(([key]) => key.startsWith("tfc_brand"));
  if (filters.length === 1 && brandFilters.length === 1) {
    const value = brandFilters[0]?.[1] ?? "";
    const mapping = LEGACY_BRAND_DESTINATIONS.find(({ pattern }) => pattern.test(value));
    if (mapping) return mapping.destination;
  }

  return "/catalog";
}
