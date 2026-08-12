import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left: string, right: string) {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (Math.max(leftLuminance, rightLuminance) + 0.05)
    / (Math.min(leftLuminance, rightLuminance) + 0.05);
}

test("public catalog reads use a short shared validated cache while health stays live", async () => {
  const [repository, health] = await Promise.all([
    source("lib/storefront/cloud-published-catalog-repository.ts"),
    source("app/internal/health/catalog/route.ts"),
  ]);

  assert.match(repository, /unstable_cache\(/u);
  assert.match(repository, /PUBLISHED_CATALOG_CACHE_REVALIDATE_SECONDS = 60/u);
  assert.match(repository, /tags: \[PUBLISHED_CATALOG_CACHE_TAG\]/u);
  assert.match(repository, /cache\(requestCloudPublishedCatalog\)/u);
  assert.match(repository, /loadCloudPublishedCatalogFresh/u);
  assert.match(health, /await loadCloudPublishedCatalogFresh\(\)/u);
  assert.doesNotMatch(health, /await loadCloudPublishedCatalog\(\)/u);
  assert.doesNotMatch(
    repository,
    /\b(?:PATCH|PUT|DELETE)\b|insert into|update cloud\./iu,
  );
});

test("the measured homepage LCP owns priority and below-fold imagery stays lazy", async () => {
  const [hero, loading, carousel, gallery, productCard, header, footer, config] = await Promise.all([
    source("components/home/Hero.tsx"),
    source("app/loading.tsx"),
    source("components/home/FeaturedProductsCarousel.tsx"),
    source("components/catalog/ProductGallery.tsx"),
    source("components/storefront/ProductCard.tsx"),
    source("components/layout/Header.tsx"),
    source("components/home/Footer.tsx"),
    source("next.config.ts"),
  ]);

  assert.match(hero, /<Image[\s\S]+?preload[\s\S]+?fetchPriority="high"[\s\S]+?sizes=/u);
  assert.doesNotMatch(hero, /\bpriority\b/u);
  assert.match(hero, /\(max-width: 639px\) 32vw/u);
  assert.match(loading, /min-h-screen/u);
  assert.doesNotMatch(loading, /min-h-\[70vh\]/u);
  assert.match(carousel, /loading="lazy"/u);
  assert.doesNotMatch(carousel, /loading=.*eager/u);
  assert.match(gallery, /fetchPriority=\{selectedImageIndex === 0 \? "high" : "auto"\}/u);
  assert.match(gallery, /\(max-width: 1024px\) 90vw, 40vw/u);
  assert.match(productCard, /\(max-width: 767px\) 92vw/u);
  assert.match(header, /width=\{184\}[\s\S]+?height=\{39\}/u);
  assert.doesNotMatch(header, /fetchPriority="high"/u);
  assert.match(footer, /width=\{160\}[\s\S]+?height=\{34\}/u);
  assert.match(config, /imageSizes: \[32, 48, 64, 96, 128, 160, 192, 256, 320, 384\]/u);
});

test("Metrica retains the immediate R9 queue but leaves the critical render path", async () => {
  const runtime = await source("components/analytics/AttributionRuntime.tsx");
  const queue = runtime.indexOf('window.ym(counterId, "init"');
  const defer = runtime.indexOf("window.setTimeout(loadMetrica, 5_000)");
  const append = runtime.indexOf("document.head.append(script)");

  assert.ok(queue >= 0);
  assert.ok(defer > queue);
  assert.ok(append > queue);
  assert.match(runtime, /pointerdown/u);
  assert.match(runtime, /keydown/u);
  assert.match(runtime, /data-cybermedica-metrica/u);
});

test("secondary foreground color meets normal-text contrast on light surfaces", async () => {
  const styles = await source("app/globals.css");
  const match = styles.match(/--cm-dim:\s*(#[0-9a-f]{6})/iu);
  assert.ok(match);
  const foreground = match[1];

  for (const background of ["#ffffff", "#f4f7fa", "#eef2f7", "#dcf0f4"]) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
  }
});
