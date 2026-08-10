export const SEO_P0_PATHS = [
  "/catalog/endoskopiya",
  "/catalog/endoskopiya/videoendoskopicheskie-sistemy",
  "/solutions/portativnaya-bronkhoskopiya",
  "/catalog/endoskopiya/obrabotka-endoskopov",
] as const;

export type SeoP0Path = (typeof SEO_P0_PATHS)[number];
