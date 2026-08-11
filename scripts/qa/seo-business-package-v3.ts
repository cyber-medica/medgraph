import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

import { chromium, webkit, type BrowserType, type Page } from "playwright-core";

import publishedCatalogJson from "../../data/import/endomarket-stage-published-catalog.json" with { type: "json" };
import stageSnapshotJson from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };
import manufacturerContract from "../../data/seo/source/v3/cybermedica_manufacturer_seo_contract_v3.json" with { type: "json" };
import p1Landings from "../../data/seo/source/v3/cybermedica_seo_p1_landings_v3.json" with { type: "json" };
import productMetadataManifest from "../../data/seo/product-metadata-identities-v3.json" with { type: "json" };
import { composeEndoMarketStageCatalog } from "../../lib/storefront/endomarket-stage-catalog.ts";
import {
  mapCloudPreviewSnapshot,
  type CloudPreviewCatalogSnapshot,
} from "../../lib/storefront/cloud-preview-mapper.ts";
import {
  buildProductSeoMetadataV3,
  getManufacturerSeoContent,
  getProductSeoH1,
  SEO_P1_PATHS,
} from "../../lib/seo/implementation-v3.ts";
import type { StorefrontCatalog } from "../../lib/storefront/types.ts";

const origin = new URL(process.env.SEO_V3_ORIGIN ?? "http://127.0.0.1:3000");
const approvedOrigin = (
  origin.protocol === "https:"
  && (origin.hostname === "stage.cyber-medica.ru" || origin.hostname.endsWith(".vercel.app"))
) || (
  origin.protocol === "http:"
  && ["127.0.0.1", "localhost"].includes(origin.hostname)
);
assert.ok(approvedOrigin, "SEO_V3_ORIGIN must be Stage, Vercel Preview or loopback.");

const canonicalOrigin = "https://cyber-medica.ru";
const publishedCatalog = publishedCatalogJson as StorefrontCatalog;
const stageCatalog = composeEndoMarketStageCatalog(
  publishedCatalog,
  mapCloudPreviewSnapshot(stageSnapshotJson as unknown as CloudPreviewCatalogSnapshot),
);
const captureScreenshots = process.env.SEO_V3_SCREENSHOTS === "1";
const evidenceDir = "docs/reports/evidence/seo-business-package-v3-2026-08-11";
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

function expectedTitle(metadata: ReturnType<typeof buildProductSeoMetadataV3>) {
  if (typeof metadata.title === "string") return metadata.title;
  assert.ok(metadata.title && "absolute" in metadata.title);
  return metadata.title.absolute;
}

async function fetchText(path: string, expectedStatus = 200) {
  const response = await fetch(new URL(path, origin), {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
    headers: { "user-agent": "CyberMedica-SEO-v3-Stage-Audit/1.0" },
  });
  assert.equal(response.status, expectedStatus, `${path}: unexpected HTTP status.`);
  return response.text();
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index]);
    }
  }));
  return output;
}

assert.equal(stageCatalog.products.length, 114, "Stage must contain the reconciled 114-Product catalog.");
assert.equal(productMetadataManifest.products.length, 43, "Exact v3 metadata scope must remain 43.");

const robots = await fetchText("/robots.txt");
assert.match(robots, /Disallow:\s*\//iu);
assert.doesNotMatch(robots, /^Allow:\s*\//imu);
assert.match(robots, /Host:\s*https:\/\/cyber-medica\.ru/iu);

for (const path of SEO_P1_PATHS) {
  const html = await fetchText(path);
  const metadata = metadataFromHtml(html);
  const expected = p1Landings[path];
  assert.equal(metadata.title, expected.title, `${path}: title drift.`);
  assert.equal(metadata.description, expected.metaDescription, `${path}: description drift.`);
  assert.equal(metadata.h1, expected.h1, `${path}: H1 drift.`);
  assert.equal(metadata.canonical, `${canonicalOrigin}${path}`, `${path}: canonical drift.`);
  assert.match(metadata.robots, /noindex/iu);
  assert.match(metadata.robots, /nofollow/iu);
  assert.ok(html.includes(expected.intro), `${path}: exact intro missing.`);
  for (const section of expected.sections) {
    assert.ok(html.includes(section.h2), `${path}: section heading missing.`);
    assert.ok(html.includes(section.body), `${path}: exact section body missing.`);
  }
  for (const faq of expected.faq) {
    assert.ok(html.includes(faq.q) && html.includes(faq.a), `${path}: exact FAQ missing.`);
  }
  assert.ok(html.includes(expected.cta), `${path}: exact CTA missing.`);
  assert.doesNotMatch(html, /stage\.cyber-medica\.ru|\.vercel\.app/iu);
}

const productMetadata = await mapConcurrent(stageCatalog.products, 6, async (product) => {
  const html = await fetchText(`/catalog/${product.slug}`);
  const actual = metadataFromHtml(html);
  const category = stageCatalog.categories.find(({ id }) => id === product.categoryId);
  const expected = buildProductSeoMetadataV3({ product, category });
  assert.equal(actual.title, expectedTitle(expected), `${product.slug}: title drift.`);
  assert.equal(actual.description, expected.description, `${product.slug}: description drift.`);
  assert.equal(actual.canonical, `${canonicalOrigin}/catalog/${product.slug}`, `${product.slug}: canonical drift.`);
  assert.equal(actual.h1, getProductSeoH1(product), `${product.slug}: H1 drift.`);
  assert.match(actual.robots, /noindex/iu);
  assert.match(actual.robots, /nofollow/iu);
  assert.doesNotMatch(html, /stage\.cyber-medica\.ru|\.vercel\.app/iu);
  return actual;
});
assert.equal(new Set(productMetadata.map(({ title }) => title)).size, 114);
assert.equal(new Set(productMetadata.map(({ description }) => description)).size, 114);
assert.equal(new Set(productMetadata.map(({ canonical }) => canonical)).size, 114);

const specificManufacturerNames = ["SonoScape", "Medinova", "Hamilton Medical", "Mindray"] as const;
const specificManufacturers = specificManufacturerNames.map(
  (name) => [name, manufacturerContract[name]] as const,
);
for (const [name, expected] of specificManufacturers) {
  const manufacturer = stageCatalog.manufacturers.find(({ name: candidate }) => candidate === name);
  assert.ok(manufacturer, `${name}: manufacturer missing from Stage.`);
  const html = await fetchText(expected.path);
  const actual = metadataFromHtml(html);
  const resolved = getManufacturerSeoContent(manufacturer);
  assert.equal(actual.title, expected.title);
  assert.equal(actual.description, expected.description);
  assert.equal(actual.canonical, `${canonicalOrigin}${expected.path}`);
  assert.equal(actual.h1, expected.h1);
  assert.ok(html.includes(resolved.intro));
  assert.match(actual.robots, /noindex/iu);
}

const missingHtml = await fetchText("/catalog/__seo-v3-missing-product__", 404);
assert.match(missingHtml, /Страница не найдена/u);

const sitemap = await fetchText("/sitemap.xml");
assert.equal((sitemap.match(/<loc>/gu) ?? []).length, 0, "Stage sitemap must remain empty.");
assert.doesNotMatch(sitemap, /stage\.cyber-medica\.ru|\.vercel\.app/iu);

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${error.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (!message.text().includes("https://vercel.live/_next-live/feedback/feedback.js")) {
      errors.push(`console:error: ${message.text()}`);
    }
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
    ...(browserType === webkit ? {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1",
    } : {}),
  });
  const page = await context.newPage();
  const errors = collectRuntimeErrors(page);
  try {
    const routes = [
      "/",
      "/catalog",
      ...SEO_P1_PATHS,
      `/catalog/${stageCatalog.products[0].slug}`,
      specificManufacturers[0][1].path,
    ];
    for (const path of routes) {
      const response = await page.goto(new URL(path, origin).toString(), {
        waitUntil: "networkidle",
        timeout: 45_000,
      });
      assert.equal(response?.status(), 200, `${label}: ${path}.`);
      assert.ok((await page.locator("body").innerText()).trim().length > 100, `${label}: blank ${path}.`);
      assert.equal(await page.locator("h1").count(), 1, `${label}: H1 count on ${path}.`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
        `${label}: overflow on ${path}.`,
      );
    }
    assert.deepEqual(errors, [], `${label}: runtime errors.`);
    if (captureScreenshots) {
      await page.goto(new URL(SEO_P1_PATHS[0], origin).toString(), { waitUntil: "networkidle" });
      await page.screenshot({ path: `${evidenceDir}/transport-ventilators-${label}.png`, fullPage: true });
      await page.goto(new URL(SEO_P1_PATHS[1], origin).toString(), { waitUntil: "networkidle" });
      await page.screenshot({ path: `${evidenceDir}/anesthesia-machines-${label}.png`, fullPage: true });
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
  exactV3ProductMetadata: productMetadataManifest.products.length,
  preservedV2ProductMetadata: stageCatalog.products.length - productMetadataManifest.products.length,
  p1Landings: SEO_P1_PATHS.length,
  specificManufacturerPages: specificManufacturers.length,
  stageSitemapUrls: 0,
  plannedPublishedProducts: stageCatalog.products.length,
  browsers: ["chromium-desktop", "webkit-iphone"],
}));
