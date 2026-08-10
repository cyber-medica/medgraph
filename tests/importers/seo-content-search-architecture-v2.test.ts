import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import publishedCatalogJson from "../../data/import/endomarket-stage-published-catalog.json" with { type: "json" };
import stageSnapshotJson from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };
import sourceManifest from "../../data/seo/source/cybermedica-seo-implementation-manifest-v2.json" with { type: "json" };
import { composeEndoMarketStageCatalog } from "../../lib/storefront/endomarket-stage-catalog.ts";
import {
  mapCloudPreviewSnapshot,
  type CloudPreviewCatalogSnapshot,
} from "../../lib/storefront/cloud-preview-mapper.ts";
import { getPlainProductType, STOREFRONT_SITE_URL } from "../../lib/storefront/seo.ts";
import { buildStorefrontSitemapFromCatalog } from "../../lib/storefront/storefront-sitemap.ts";
import { buildProductStructuredData } from "../../lib/storefront/structured-data.ts";
import type { StorefrontCatalog } from "../../lib/storefront/types.ts";
import {
  getSeoLanding,
  resolveSeoLandingLinks,
  SEO_P0_PATHS,
  seoIdentityManifest,
} from "../../lib/seo/implementation-v2.ts";

const sourceFiles = [
  [
    "data/seo/source/cybermedica-seo-content-search-architecture-v2.md",
    "c53768c9669619c0be8e7c569d0bcb89b989a9c90fc2b80e4b93403a11fa0e0d",
  ],
  [
    "data/seo/source/cybermedica-codex-seo-implementation-only-v2.txt",
    "ecf77df9fd593bd7d00c0924a04467317b4a208f2cc92ac20118a42fa9320ec4",
  ],
] as const;

const publishedCatalog = publishedCatalogJson as StorefrontCatalog;
const stageCatalog = composeEndoMarketStageCatalog(
  publishedCatalog,
  mapCloudPreviewSnapshot(stageSnapshotJson as unknown as CloudPreviewCatalogSnapshot),
);

test("authoritative SEO v2 inputs are tracked byte-for-byte", async () => {
  for (const [path, expected] of sourceFiles) {
    const digest = createHash("sha256").update(await readFile(path)).digest("hex");
    assert.equal(digest, expected, path);
  }

  const manifest = JSON.parse(
    await readFile(
      "data/seo/source/cybermedica-seo-implementation-manifest-v2.json",
      "utf8",
    ),
  ) as unknown;
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, canonicalize(child)]),
      );
    }
    return value;
  };
  const semanticDigest = createHash("sha256")
    .update(`${JSON.stringify(canonicalize(manifest))}\n`)
    .digest("hex");
  assert.equal(
    semanticDigest,
    "478ef0973af7bc023c40f7bddc8a8b0a544ee3389df0d31de8fd7714a1b6b60e",
    "The repository manifest must remain semantically identical to the user source; only the patch tool's terminal newline is normalized.",
  );
});

test("P0 routing and copy are exact manifest values", async () => {
  assert.deepEqual(SEO_P0_PATHS, Object.keys(sourceManifest.p0Landings));
  for (const path of SEO_P0_PATHS) {
    const landing = getSeoLanding(path);
    assert.deepEqual(landing, sourceManifest.p0Landings[path]);
    const source = await readFile(
      path === "/solutions/portativnaya-bronkhoskopiya"
        ? "app/solutions/portativnaya-bronkhoskopiya/page.tsx"
        : `app${path}/page.tsx`,
      "utf8",
    );
    assert.match(source, new RegExp(`const path = "${path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`));
    assert.match(source, /<SeoLandingPage path=\{path\}/u);
  }
});

test("P0 link graph resolves exact unique identities and never guessed names", () => {
  assert.equal(stageCatalog.products.length, 114);
  assert.equal(new Set(seoIdentityManifest.products.map(({ productId }) => productId)).size, 8);
  assert.equal(new Set(seoIdentityManifest.products.map(({ slug }) => slug)).size, 8);

  for (const path of SEO_P0_PATHS) {
    const links = resolveSeoLandingLinks(
      path,
      stageCatalog.products,
      stageCatalog.manufacturers,
    );
    assert.equal(links.length, sourceManifest.linkGraph[path].length, path);
    assert.ok(links.every(({ href }) => href.startsWith("/")), path);
  }

  const drifted = stageCatalog.products.map((product) =>
    product.id === seoIdentityManifest.products[0].productId
      ? { ...product, model: "DRIFTED" }
      : product
  );
  const driftedLinks = resolveSeoLandingLinks(
    "/catalog/endoskopiya/videoendoskopicheskie-sistemy",
    drifted,
    stageCatalog.manufacturers,
  );
  assert.equal(driftedLinks.some(({ label }) => label.includes("HD-350")), false);
});

test("all 71 planned indexable Products have unique metadata inputs", () => {
  assert.equal(publishedCatalog.products.length, 71);
  const categories = new Map(publishedCatalog.categories.map((category) => [category.id, category]));
  const titles = publishedCatalog.products.map((product) => {
    const type = getPlainProductType(product, categories.get(product.categoryId));
    return `${product.name} — ${type} | CyberMedica`;
  });
  const descriptions = publishedCatalog.products.map(({ seoDescription }) => seoDescription?.trim());

  assert.equal(new Set(titles).size, 71);
  assert.equal(descriptions.every(Boolean), true);
  assert.equal(new Set(descriptions).size, 71);
  assert.equal(
    titles.every((title) => title.endsWith(" | CyberMedica") && !title.includes("undefined")),
    true,
  );
});

test("production sitemap is canonical and contains only approved content routes", () => {
  const sitemap = buildStorefrontSitemapFromCatalog(publishedCatalog);
  const urls = sitemap.map(({ url }) => url);
  assert.equal(urls.length, 103);
  assert.equal(new Set(urls).size, 103);
  assert.ok(urls.every((url) => url.startsWith(`${STOREFRONT_SITE_URL}/`)));
  assert.ok(SEO_P0_PATHS.every((path) => urls.includes(`${STOREFRONT_SITE_URL}${path}`)));
  assert.equal(urls.filter((url) => url.includes("/catalog/")).length, 74);
  assert.equal(urls.some((url) => /stage\.|vercel\.app|\/search|\/compare|\/request/u.test(url)), false);
});

test("Product JSON-LD is truthful and breadcrumbs include category", () => {
  for (const product of publishedCatalog.products) {
    const manufacturer = publishedCatalog.manufacturers.find(({ id }) => id === product.manufacturerId);
    const category = publishedCatalog.categories.find(({ id }) => id === product.categoryId);
    assert.ok(category);
    const [schema, breadcrumb] = buildProductStructuredData({ product, manufacturer, category });
    const serialized = JSON.stringify(schema);
    assert.doesNotMatch(
      serialized,
      /"(?:offers|price|availability|aggregateRating|review|rating)"/u,
    );
    assert.deepEqual(
      (breadcrumb.itemListElement as Array<{ name: string }>).map(({ name }) => name),
      ["Главная", "Каталог", category.name, product.name],
    );
  }
});

test("P0 page implementation contains crawlable links and no legacy origins", async () => {
  const source = await readFile("components/seo/SeoLandingPage.tsx", "utf8");
  assert.match(source, /<Link[\s\S]*href=\{link\.href\}/u);
  assert.match(source, /data-seo-link-kind/u);
  assert.doesNotMatch(source, /tilda|medvist\.ru|stage\.cyber-medica\.ru|vercel\.app/iu);
});

test("missing Product guard sets HTTP 404 before streaming and remains read-only", async () => {
  const [proxy, existence] = await Promise.all([
    readFile("proxy.ts", "utf8"),
    readFile("lib/storefront/product-slug-existence.server.ts", "utf8"),
  ]);
  assert.match(proxy, /"\/catalog\/:slug"/u);
  assert.match(proxy, /existence === "missing"/u);
  assert.match(proxy, /NextResponse\.next\(\{[\s\S]*status: 404/u);
  assert.match(proxy, /X-Robots-Tag": "noindex, nofollow"/u);
  assert.match(existence, /ProductSlugExistence = "exists" \| "missing" \| "unavailable"/u);
  assert.match(existence, /Transport failure is not evidence that a public Product is missing/u);
  assert.doesNotMatch(
    existence,
    /\b(?:insert|update|delete|upsert|publish|approve|service_role_key)\b/iu,
  );
});
