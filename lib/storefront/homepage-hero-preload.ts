import "server-only";

import { preload } from "react-dom";

import publishedCatalogSnapshotJson from "../../data/published-catalog-last-known-good.json" with { type: "json" };

const HOMEPAGE_HERO_PRODUCT_SLUG =
  "767632362-330695211247-apparat-ivl-hamilton-t1";
const HOMEPAGE_HERO_IMAGE_SIZES =
  "(max-width: 639px) 32vw, (max-width: 1023px) 24vw, 18vw";
const NEXT_IMAGE_WIDTHS = [
  128, 160, 192, 256, 320, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
] as const;

const bundledHeroMedia = publishedCatalogSnapshotJson.projection.products
  .find(({ slug }) => slug === HOMEPAGE_HERO_PRODUCT_SLUG)
  ?.media;
const bundledHeroImageUrl = bundledHeroMedia?.find(({ role }) => role === "hero")?.url
  ?? bundledHeroMedia?.[0]?.url;

function optimizedImageUrl(source: string, width: number) {
  return `/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`;
}

/**
 * Emit the responsive resource hint before the homepage suspends on its live
 * catalog read. The rendered Product still comes from the authoritative live
 * projection; this validated bundled URL is only a non-visible early hint.
 */
export function preloadHomepageHeroImage() {
  if (!bundledHeroImageUrl) return;
  const imageSrcSet = NEXT_IMAGE_WIDTHS
    .map((width) => `${optimizedImageUrl(bundledHeroImageUrl, width)} ${width}w`)
    .join(", ");

  preload(optimizedImageUrl(bundledHeroImageUrl, 3840), {
    as: "image",
    fetchPriority: "high",
    imageSizes: HOMEPAGE_HERO_IMAGE_SIZES,
    imageSrcSet,
  });
}
