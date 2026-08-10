import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

import {
  chromium,
  webkit,
  type BrowserType,
  type Page,
} from "playwright-core";

import publishedCatalogJson from "../../data/import/endomarket-stage-published-catalog.json" with { type: "json" };
import identityManifest from "../../data/seo/product-link-identities-v2.json" with { type: "json" };
import manifest from "../../data/seo/source/cybermedica-seo-implementation-manifest-v2.json" with { type: "json" };
import type { StorefrontCatalog } from "../../lib/storefront/types.ts";

const origin = new URL(process.env.SEO_V2_ORIGIN ?? "http://127.0.0.1:3000");
const approvedOrigin = (
  origin.protocol === "https:"
  && (
    origin.hostname === "stage.cyber-medica.ru"
    || origin.hostname.endsWith(".vercel.app")
  )
) || (
  origin.protocol === "http:"
  && ["127.0.0.1", "localhost"].includes(origin.hostname)
);
assert.ok(approvedOrigin, "SEO_V2_ORIGIN must be Stage, Vercel Preview or loopback.");

const publishedCatalog = publishedCatalogJson as StorefrontCatalog;
const canonicalOrigin = manifest.canonicalOrigin;
const p0Paths = Object.keys(manifest.p0Landings) as Array<keyof typeof manifest.p0Landings>;
const evidenceDir = "docs/reports/evidence/seo-content-search-architecture-v2-2026-08-11";
const captureScreenshots = process.env.SEO_V2_SCREENSHOTS === "1";
if (captureScreenshots) await mkdir(evidenceDir, { recursive: true });

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ").trim());
}

function tagContent(html: string, pattern: RegExp, label: string) {
  const match = html.match(pattern);
  assert.ok(match?.[1], `${label} is missing.`);
  return decodeHtml(match[1]);
}

function metadataFromHtml(html: string) {
  return {
    title: tagContent(html, /<title>([^<]+)<\/title>/u, "title"),
    description: tagContent(
      html,
      /<meta[^>]+name="description"[^>]+content="([^"]+)"[^>]*>/u,
      "meta description",
    ),
    canonical: tagContent(
      html,
      /<link[^>]+rel="canonical"[^>]+href="([^"]+)"[^>]*>/u,
      "canonical",
    ),
    robots: tagContent(
      html,
      /<meta[^>]+name="robots"[^>]+content="([^"]+)"[^>]*>/u,
      "robots",
    ),
    h1: stripHtml(tagContent(html, /<h1[^>]*>([\s\S]*?)<\/h1>/u, "h1")),
  };
}

async function fetchText(path: string, expectedStatus = 200) {
  const response = await fetch(new URL(path, origin), {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
    headers: { "user-agent": "CyberMedica-SEO-v2-Stage-Audit/1.0" },
  });
  assert.equal(response.status, expectedStatus, `${path}: unexpected HTTP status.`);
  return response.text();
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index], index);
    }
  }));
  return output;
}

const robots = await fetchText("/robots.txt");
assert.match(robots, /User-agent:\s*\*/iu);
assert.match(robots, /Disallow:\s*\//iu);
assert.doesNotMatch(robots, /^Allow:\s*\//imu);
assert.match(robots, /Host:\s*https:\/\/cyber-medica\.ru/iu);

const expectedLinkHrefs = new Map<string, string>([
  ...Object.keys(manifest.p0Landings).map((path) => [path, path] as const),
  ...identityManifest.products.map(({ key, slug }) => [key, `/catalog/${slug}`] as const),
  ...identityManifest.manufacturers.map(({ key, slug }) => [key, `/manufacturers/${slug}`] as const),
]);

for (const path of p0Paths) {
  const html = await fetchText(path);
  const metadata = metadataFromHtml(html);
  const expected = manifest.p0Landings[path];
  assert.equal(metadata.title, expected.title, `${path}: title drift.`);
  assert.equal(metadata.description, expected.description, `${path}: description drift.`);
  assert.equal(metadata.canonical, `${canonicalOrigin}${path}`, `${path}: canonical drift.`);
  assert.equal(metadata.h1, expected.h1, `${path}: H1 drift.`);
  assert.match(metadata.robots, /noindex/iu, `${path}: Stage must be noindex.`);
  assert.match(metadata.robots, /nofollow/iu, `${path}: Stage must be nofollow.`);
  assert.doesNotMatch(html, /stage\.cyber-medica\.ru|\.vercel\.app/iu);
  assert.match(html, /application\/ld\+json/u, `${path}: JSON-LD missing.`);

  for (const target of manifest.linkGraph[path]) {
    const href = expectedLinkHrefs.get(target);
    assert.ok(href, `${path}: no exact identity mapping for ${target}.`);
    assert.match(
      html,
      new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`, "u"),
      `${path}: crawlable link missing for ${target}.`,
    );
  }
}

const productMetadata = await mapConcurrent(
  publishedCatalog.products,
  6,
  async (product) => {
    const html = await fetchText(`/catalog/${product.slug}`);
    const metadata = metadataFromHtml(html);
    const category = publishedCatalog.categories.find(({ id }) => id === product.categoryId);
    const productType = product.specifications.find(
      ({ label, value }) => label.trim().toLocaleLowerCase("ru-RU") === "тип товара"
        && value.trim().length > 0,
    )?.value.trim() ?? category?.name.trim() ?? "медицинское оборудование";
    assert.equal(metadata.title, `${product.name} — ${productType} | CyberMedica`, `${product.slug}: title.`);
    assert.equal(metadata.description, product.seoDescription, `${product.slug}: description.`);
    assert.equal(metadata.canonical, `${canonicalOrigin}/catalog/${product.slug}`, `${product.slug}: canonical.`);
    assert.equal(metadata.h1, product.name, `${product.slug}: H1.`);
    assert.match(metadata.robots, /noindex/iu, `${product.slug}: Stage noindex.`);
    assert.match(metadata.robots, /nofollow/iu, `${product.slug}: Stage nofollow.`);
    assert.doesNotMatch(html, /stage\.cyber-medica\.ru|\.vercel\.app/iu);
    return metadata;
  },
);
assert.equal(new Set(productMetadata.map(({ title }) => title)).size, 71);
assert.equal(new Set(productMetadata.map(({ description }) => description)).size, 71);
assert.equal(new Set(productMetadata.map(({ canonical }) => canonical)).size, 71);

const missingHtml = await fetchText("/catalog/__seo-v2-missing-product__", 404);
assert.match(missingHtml, /Страница не найдена/u);
assert.doesNotMatch(missingHtml, /<meta[^>]+name="robots"[^>]+content="index/iu);

const catalogHtml = await fetchText("/catalog");
assert.doesNotMatch(catalogHtml, /Made on Tilda|medvist\.ru|tilda\.cc/iu);
assert.match(catalogHtml, /Каталог медицинских изделий/u);

const sitemap = await fetchText("/sitemap.xml");
assert.doesNotMatch(sitemap, /stage\.cyber-medica\.ru|\.vercel\.app/iu);
assert.equal((sitemap.match(/<loc>/gu) ?? []).length, 0, "Stage sitemap must remain empty.");

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${error.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const previewToolbarCsp = message.text().includes(
      "https://vercel.live/_next-live/feedback/feedback.js",
    );
    if (!previewToolbarCsp) errors.push(`console:error: ${message.text()}`);
  });
  return errors;
}

async function runBrowserProfile(
  browserType: BrowserType,
  label: string,
  viewport: { width: number; height: number },
) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    ...(browserType === webkit
      ? {
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1",
        }
      : {}),
  });
  const page = await context.newPage();
  const errors = collectRuntimeErrors(page);
  try {
    for (const path of ["/", "/catalog", ...p0Paths, `/catalog/${publishedCatalog.products[0].slug}`]) {
      const response = await page.goto(new URL(path, origin).toString(), {
        waitUntil: "networkidle",
        timeout: 45_000,
      });
      assert.equal(response?.status(), 200, `${label}: ${path}.`);
      assert.ok((await page.locator("body").innerText()).trim().length > 100, `${label}: blank ${path}.`);
      assert.equal(await page.locator("h1").count(), 1, `${label}: one H1 on ${path}.`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
        `${label}: overflow on ${path}.`,
      );
    }
    assert.deepEqual(errors, [], `${label}: runtime errors.`);
    if (captureScreenshots) {
      await page.goto(new URL("/catalog/endoskopiya", origin).toString(), { waitUntil: "networkidle" });
      await page.screenshot({ path: `${evidenceDir}/p0-endoscopy-${label}.png`, fullPage: true });
      await page.goto(new URL("/solutions/portativnaya-bronkhoskopiya", origin).toString(), { waitUntil: "networkidle" });
      await page.screenshot({ path: `${evidenceDir}/p0-portable-bronchoscopy-${label}.png`, fullPage: true });
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

await runBrowserProfile(chromium, "chromium-desktop", { width: 1440, height: 900 });
await runBrowserProfile(webkit, "webkit-iphone", { width: 390, height: 844 });

console.info(JSON.stringify({
  status: "pass",
  origin: origin.origin,
  p0Landings: p0Paths.length,
  productMetadata: productMetadata.length,
  plannedProductionSitemapUrls: 103,
  stageSitemapUrls: 0,
  browsers: ["chromium-desktop", "webkit-iphone"],
}));
