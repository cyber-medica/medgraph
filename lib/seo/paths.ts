export const SEO_P0_PATHS = [
  "/catalog/endoskopiya",
  "/catalog/endoskopiya/videoendoskopicheskie-sistemy",
  "/solutions/portativnaya-bronkhoskopiya",
  "/catalog/endoskopiya/obrabotka-endoskopov",
] as const;

export type SeoP0Path = (typeof SEO_P0_PATHS)[number];

export const SEO_P1_PATHS = [
  "/catalog/reanimatsiya/transportnye-apparaty-ivl",
  "/catalog/anesteziologiya/narkozno-dykhatelnye-apparaty",
] as const;

export type SeoP1Path = (typeof SEO_P1_PATHS)[number];

export const SEO_LANDING_PATHS = [...SEO_P0_PATHS, ...SEO_P1_PATHS] as const;

export type SeoLandingPath = (typeof SEO_LANDING_PATHS)[number];
