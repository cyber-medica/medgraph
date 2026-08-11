import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import publishedCatalogJson from "../../data/import/endomarket-stage-published-catalog.json" with { type: "json" };
import stageSnapshotJson from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };
import legacyInventory from "../../data/seo/legacy-url-inventory-v3.json" with { type: "json" };
import manufacturerContract from "../../data/seo/source/v3/cybermedica_manufacturer_seo_contract_v3.json" with { type: "json" };
import p1Landings from "../../data/seo/source/v3/cybermedica_seo_p1_landings_v3.json" with { type: "json" };
import releaseManifest from "../../data/operations/production-launch-release-v1-manifest.json" with { type: "json" };
import productMetadataManifest from "../../data/seo/product-metadata-identities-v3.json" with { type: "json" };
import { composeEndoMarketStageCatalog } from "../../lib/storefront/endomarket-stage-catalog.ts";
import {
  mapCloudPreviewSnapshot,
  type CloudPreviewCatalogSnapshot,
} from "../../lib/storefront/cloud-preview-mapper.ts";
import type { StorefrontCatalog } from "../../lib/storefront/types.ts";
import {
  buildProductSeoMetadataV3,
  getExactProductSeo,
  getManufacturerSeoContent,
  getProductSeoH1,
  getSeoLandingV3,
  orderManufacturerProductsV3,
  resolveSeoLandingLinksV3,
  SEO_LANDING_PATHS,
  SEO_P1_PATHS,
} from "../../lib/seo/implementation-v3.ts";
import { buildStorefrontSitemapFromCatalog } from "../../lib/storefront/storefront-sitemap.ts";

const sourceFiles = [
  ["data/seo/source/v3/cybermedica_seo_business_package_v3.json", "47ed6c80fe2b164d1e55e279d9216b6d346477e47d898976766d3caa5e32a3e8"],
  ["data/seo/source/v3/cybermedica_legacy_url_migration_policy_v3.md", "e0a94c12a948a69824451752a537fac5b1774f0f9890088cd604c74306d4c3e9"],
  ["data/seo/source/v3/cybermedica_manufacturer_seo_contract_v3.json", "4dfda75ab0e30987701d99f25ca8520750697feb3992dfd90fec1632f405d03d"],
  ["data/seo/source/v3/cybermedica_seo_p1_landings_v3.json", "25b61dde770ad3da89c948f0cb42827266fda81100b60f1026ea04dedad89403"],
  ["data/seo/source/v3/cybermedica_seo_keyword_core_v3.csv", "bcf3aa51befa18a0a3108ae339bfc31c17e4558f86a7e2974a9b04361d9318d4"],
  ["data/seo/source/v3/cybermedica_seo_metadata_new43_v3.csv", "ff717b89600bc2bad648191da2008e7af1fa67844b412b0ad58f6f613781721f"],
  ["data/seo/source/v3/cybermedica_codex_seo_v3_implementation_delta.txt", "f0e672d83ee3fa53d045ece56c488698d520a62deddfa1b6b13713078cd9a987"],
] as const;

const publishedCatalog = publishedCatalogJson as StorefrontCatalog;
const stageCatalog = composeEndoMarketStageCatalog(
  publishedCatalog,
  mapCloudPreviewSnapshot(stageSnapshotJson as unknown as CloudPreviewCatalogSnapshot),
);

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  rows[0][0] = rows[0][0].replace(/^\uFEFF/u, "");
  const [header, ...values] = rows;
  return values.map((columns) => Object.fromEntries(
    header.map((name, index) => [name, columns[index] ?? ""]),
  ));
}

function metadataTitle(metadata: ReturnType<typeof buildProductSeoMetadataV3>) {
  if (typeof metadata.title === "string") return metadata.title;
  return metadata.title && "absolute" in metadata.title ? metadata.title.absolute : null;
}

test("authoritative SEO v3 package is tracked with normalized repository line endings", async () => {
  for (const [path, expected] of sourceFiles) {
    const content = await readFile(path);
    const digest = createHash("sha256").update(content).digest("hex");
    const normalizedDigest = createHash("sha256")
      .update(content.toString("utf8").replace(/\n$/u, ""))
      .digest("hex");
    assert.ok(digest === expected || normalizedDigest === expected, path);
  }
});

test("43 metadata rows reconcile to exact Production IDs, source UIDs and slugs", async () => {
  const sourceRows = parseCsv(await readFile(sourceFiles[5][0], "utf8"));
  assert.equal(sourceRows.length, 43);
  assert.equal(releaseManifest.products.length, 43);
  assert.equal(productMetadataManifest.products.length, 43);

  for (const source of sourceRows) {
    const releaseMatches = releaseManifest.products.filter((product) =>
      product.model === source.model
      && product.sourceSnapshot.manufacturer === source.manufacturer
    );
    assert.equal(releaseMatches.length, 1, `${source.manufacturer} ${source.model}`);
    const release = releaseMatches[0];
    const reconciled = productMetadataManifest.products.find(
      ({ dbProductId }) => dbProductId === release.id,
    );
    assert.ok(reconciled);
    assert.equal(reconciled.sourceUid, release.sourceUid);
    assert.equal(reconciled.slug, release.slug);
    assert.equal(reconciled.title, source.seo_title);
    assert.equal(reconciled.description, source.meta_description);
    assert.equal(reconciled.h1, source.h1);
    assert.equal(reconciled.canonical, `/catalog/${release.slug}`);
    assert.equal(reconciled.sourceUrl, source.source_url);
  }

  for (const key of ["dbProductId", "sourceUid", "slug", "title", "description", "canonical"] as const) {
    assert.equal(new Set(productMetadataManifest.products.map((entry) => entry[key])).size, 43, key);
  }
});

test("v3 overrides exact launch Products and preserves the accepted v2 fallback", () => {
  assert.equal(stageCatalog.products.length, 114);
  const categories = new Map(stageCatalog.categories.map((category) => [category.id, category]));
  const titles: string[] = [];
  const descriptions: string[] = [];
  const canonicals: string[] = [];

  for (const product of stageCatalog.products) {
    const metadata = buildProductSeoMetadataV3({
      product,
      category: categories.get(product.categoryId),
      fallbackDescription: product.shortDescription || product.description,
    });
    const approved = getExactProductSeo(product);
    const title = metadataTitle(metadata);
    assert.ok(title);
    titles.push(title);
    descriptions.push(metadata.description ?? "");
    canonicals.push(String(metadata.alternates?.canonical));

    if (approved) {
      assert.equal(title, approved.title);
      assert.equal(metadata.description, approved.description);
      assert.equal(getProductSeoH1(product), approved.h1);
    } else {
      assert.equal(getProductSeoH1(product), product.name);
    }
  }

  assert.equal(stageCatalog.products.filter(getExactProductSeo).length, 43);
  assert.equal(new Set(titles).size, 114);
  assert.equal(new Set(descriptions).size, 114);
  assert.equal(new Set(canonicals).size, 114);
});

test("two P1 landings render the exact supplied content and only exact published links", async () => {
  assert.deepEqual(SEO_P1_PATHS, Object.keys(p1Landings));
  for (const path of SEO_P1_PATHS) {
    const source = p1Landings[path];
    const content = getSeoLandingV3(path);
    assert.equal(content.title, source.title);
    assert.equal(content.description, source.metaDescription);
    assert.equal(content.h1, source.h1);
    assert.equal(content.intro, source.intro);
    assert.deepEqual(content.sections, source.sections.map(({ h2, body }) => [h2, body]));
    assert.deepEqual(content.faq, source.faq.map(({ q, a }) => [q, a]));
    assert.deepEqual(content.cta, { body: source.cta });

    const routeSource = await readFile(`app${path}/page.tsx`, "utf8");
    assert.match(routeSource, /buildSeoLandingMetadataV3/u);
    assert.match(routeSource, /<SeoLandingPage path=\{path\}/u);
  }

  const transportLinks = resolveSeoLandingLinksV3(
    SEO_P1_PATHS[0],
    stageCatalog.products,
    stageCatalog.manufacturers,
  );
  assert.deepEqual(transportLinks.map(({ href }) => href), [
    "/catalog/767632362-330695211247-apparat-ivl-hamilton-t1",
  ]);
  assert.deepEqual(
    resolveSeoLandingLinksV3(SEO_P1_PATHS[1], stageCatalog.products, stageCatalog.manufacturers),
    [],
    "WATO EX-35 and WATO A8 are not published and must not receive guessed links.",
  );
});

test("manufacturer SEO contract is exact for four manufacturers and generic elsewhere", () => {
  for (const name of ["SonoScape", "Medinova", "Hamilton Medical", "Mindray"] as const) {
    const manufacturer = stageCatalog.manufacturers.find((entry) => entry.name === name);
    assert.ok(manufacturer);
    const content = getManufacturerSeoContent(manufacturer);
    const source = manufacturerContract[name];
    assert.equal(content.source, "specific");
    assert.equal(content.title, source.title);
    assert.equal(content.description, source.description);
    assert.equal(content.h1, source.h1);
    assert.equal(content.intro, source.intro);
    assert.deepEqual(content.priorityLinks, source.priorityLinks);

    const products = stageCatalog.products.filter(({ manufacturerId }) => manufacturerId === manufacturer.id);
    const ordered = orderManufacturerProductsV3(products, content.priorityLinks);
    const publishedPriority = source.priorityLinks.filter((model) =>
      products.some((product) => product.model === model)
    );
    assert.deepEqual(ordered.slice(0, publishedPriority.length).map(({ model }) => model), publishedPriority);
  }

  const bowa = stageCatalog.manufacturers.find(({ name }) => name === "BOWA");
  assert.ok(bowa);
  const generic = getManufacturerSeoContent(bowa);
  assert.equal(generic.source, "generic");
  assert.equal(generic.title, "BOWA — медицинское оборудование | Кибермедика");
  assert.doesNotMatch(JSON.stringify(generic), /официальн(?:ый|ого) (?:дилер|дистрибьютор)/iu);
});

test("sitemap derives counts from the visible catalog and includes both P1 routes", () => {
  const sitemap = buildStorefrontSitemapFromCatalog(stageCatalog);
  const urls = sitemap.map(({ url }) => url);
  const expected = stageCatalog.products.length
    + stageCatalog.manufacturers.length
    + 3
    + SEO_LANDING_PATHS.length;
  assert.equal(urls.length, expected);
  assert.equal(new Set(urls).size, expected);
  for (const path of SEO_P1_PATHS) {
    assert.ok(urls.includes(`https://cyber-medica.ru${path}`));
  }
  assert.equal(urls.some((url) => /stage\.|vercel\.app|endomarket\.ru/iu.test(url)), false);
});

test("legacy migration stays fail-closed until actual URL inventory exists", async () => {
  assert.equal(legacyInventory.status, "pending_search_console_and_yandex_webmaster_export");
  assert.deepEqual(legacyInventory.mappings, []);
  const config = await readFile("next.config.ts", "utf8");
  assert.doesNotMatch(config, /medvist\.ru|tilda(?:\.cc)?|destination:\s*["']\/(?:catalog)?["']/iu);
  assert.match(config, /www\.cyber-medica\.ru/u);
});
