import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildBreadcrumbJsonLd,
  buildStorefrontMetadata,
  normalizePublicBrand,
  serializeStorefrontJsonLd,
  STOREFRONT_SITE_URL,
} from "../../lib/storefront/seo.ts";
import { isProductionIndexingEnvironment } from "../../lib/storefront/indexing.ts";
import { buildRobots } from "../../app/robots.ts";

const productionIndexingEnvironment = {
  VERCEL_ENV: "production",
  CATALOG_DATA_SOURCE: "cloud_published",
  CYBERMEDICA_SUPABASE_PROJECT_REF: "clbzibuusyuajsylcbvl",
  CYBERMEDICA_SUPABASE_URL: "https://clbzibuusyuajsylcbvl.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL: "https://clbzibuusyuajsylcbvl.supabase.co",
};

function setEnvironment(values: Record<string, string | undefined>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test("Storefront uses the approved canonical apex domain", () => {
  assert.equal(STOREFRONT_SITE_URL, "https://cyber-medica.ru");
  assert.equal(normalizePublicBrand("Каталог CyberMedica"), "Каталог Кибермедика");
});

test("Storefront metadata helper builds canonical social and robots fields", () => {
  const restore = setEnvironment(productionIndexingEnvironment);
  try {
    const metadata = buildStorefrontMetadata({
      title: "Test product",
      description: "Test description",
      canonical: "/catalog/test-product",
      image: { url: "/test-product.jpg", alt: "Test product" },
    });

    assert.equal(metadata.title, "Test product");
    assert.equal(metadata.description, "Test description");
    assert.equal(metadata.alternates?.canonical, "/catalog/test-product");
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.equal(metadata.openGraph?.url, "/catalog/test-product");
    assert.equal(metadata.openGraph?.siteName, "Кибермедика");
    assert.equal(metadata.openGraph?.locale, "ru_RU");
    const twitter = metadata.twitter as
      | { card?: string; images?: string[] }
      | undefined;
    assert.equal(twitter?.card, "summary_large_image");
    assert.deepEqual(twitter?.images, ["/test-product.jpg"]);
  } finally {
    restore();
  }
});

test("Production indexing requires the exact published Production binding", () => {
  assert.equal(isProductionIndexingEnvironment(productionIndexingEnvironment), true);
  assert.equal(
    isProductionIndexingEnvironment({
      ...productionIndexingEnvironment,
      VERCEL_ENV: "preview",
    }),
    false,
  );
  assert.equal(
    isProductionIndexingEnvironment({
      ...productionIndexingEnvironment,
      CYBERMEDICA_SUPABASE_PROJECT_REF: "gjlpkqdhlzbfnzzoxlsk",
      CYBERMEDICA_SUPABASE_URL: "https://gjlpkqdhlzbfnzzoxlsk.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://gjlpkqdhlzbfnzzoxlsk.supabase.co",
    }),
    false,
  );
});

test("Production robots allow public crawling and disallow private surfaces", () => {
  const rulesValue = buildRobots(productionIndexingEnvironment).rules;
  const rules = Array.isArray(rulesValue) ? rulesValue[0] : rulesValue;
  assert.equal(rules?.userAgent, "*");
  assert.equal(rules?.allow, "/");
  assert.deepEqual(rules?.disallow, [
    "/internal/",
    "/auth/",
    "/api/",
    "/admin/",
    "/workspace/",
    "/tender/",
    "/knowledge/",
    "/thanks",
  ]);
});

test("Preview robots remain globally disallowed", () => {
  const rulesValue = buildRobots({
    ...productionIndexingEnvironment,
    VERCEL_ENV: "preview",
    CATALOG_DATA_SOURCE: "cloud_preview",
    CYBERMEDICA_SUPABASE_PROJECT_REF: "gjlpkqdhlzbfnzzoxlsk",
    CYBERMEDICA_SUPABASE_URL: "https://gjlpkqdhlzbfnzzoxlsk.supabase.co",
    NEXT_PUBLIC_SUPABASE_URL: "https://gjlpkqdhlzbfnzzoxlsk.supabase.co",
  }).rules;
  const rules = Array.isArray(rulesValue) ? rulesValue[0] : rulesValue;
  assert.equal(rules?.allow, undefined);
  assert.equal(rules?.disallow, "/");
});

test("Storefront routes use the unified SEO helper", async () => {
  const routes = [
    "app/page.tsx",
    "app/catalog/page.tsx",
    "app/catalog/[slug]/page.tsx",
    "app/manufacturers/page.tsx",
    "app/manufacturers/[slug]/page.tsx",
    "app/compare/page.tsx",
    "app/search/page.tsx",
  ];
  const sources = await Promise.all(
    routes.map((route) => readFile(route, "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /buildStorefrontMetadata/u);
    assert.doesNotMatch(source, /verticals\/fs510|public-product-page/iu);
  }
});

test("breadcrumb JSON-LD is absolute deterministic and safely serialized", () => {
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Главная", path: "/" },
    { name: "Каталог <оборудования>", path: "/catalog" },
  ]);

  assert.deepEqual(breadcrumb.itemListElement, [
    {
      "@type": "ListItem",
      position: 1,
      name: "Главная",
      item: `${STOREFRONT_SITE_URL}/`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Каталог <оборудования>",
      item: `${STOREFRONT_SITE_URL}/catalog`,
    },
  ]);
  assert.equal(serializeStorefrontJsonLd(breadcrumb).includes("<"), false);
  assert.match(
    serializeStorefrontJsonLd(breadcrumb),
    /\\u003cоборудования\\u003e/u,
  );
});

test("query metadata can be noindex-follow without weakening the environment gate", () => {
  const restore = setEnvironment(productionIndexingEnvironment);
  try {
    const metadata = buildStorefrontMetadata({
      title: "Search",
      description: "Search results",
      canonical: "/search",
      noindexFollow: true,
    });

    assert.deepEqual(metadata.robots, { index: false, follow: true });
  } finally {
    restore();
  }
});

test("Storefront sitemap and metadata share one site URL constant", async () => {
  const source = await readFile("lib/storefront/storefront-sitemap.ts", "utf8");

  assert.match(source, /STOREFRONT_SITE_URL.*\.\/seo\.ts/u);
  assert.doesNotMatch(source, /https:\/\/cybermedica\.ru/u);
});
