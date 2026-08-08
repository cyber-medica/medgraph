import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

import { validateStorefrontCatalog } from "../../lib/storefront/schemas.ts";

const SOURCE_ORIGIN = "https://cyber-medica.ru";
const EXPECTED_PUBLISHED_PRODUCTS = 71;
const OUTPUT_PATH = "data/import/endomarket-stage-published-catalog.json";
const AUDIT_PATH = "data/import/endomarket-stage-published-catalog-audit.json";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function flightPayload(html: string) {
  const chunks: string[] = [];
  const scripts = html.matchAll(
    /<script>self\.__next_f\.push\((\[1,"(?:[^"\\]|\\.)*"\])\)<\/script>/gu,
  );
  for (const match of scripts) {
    const value = JSON.parse(match[1]!) as [number, string];
    chunks.push(value[1]);
  }
  assert.ok(chunks.length > 0, "The canonical catalog did not expose a React Flight payload.");
  return chunks.join("");
}

function balancedObject(source: string, start: number) {
  assert.equal(source[start], "{");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("The canonical catalog Flight properties were incomplete.");
}

async function readPublicJson(path: string) {
  const response = await fetch(new URL(path, SOURCE_ORIGIN), {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    headers: { "User-Agent": "CyberMedica-EndoMarket-Stage-Snapshot/1.0" },
  });
  assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

const catalogResponse = await fetch(new URL("/catalog?endomarket_stage_snapshot=1", SOURCE_ORIGIN), {
  cache: "no-store",
  signal: AbortSignal.timeout(45_000),
  headers: { "User-Agent": "CyberMedica-EndoMarket-Stage-Snapshot/1.0" },
});
assert.equal(catalogResponse.status, 200);
assert.equal(catalogResponse.headers.get("server"), "Vercel");
const html = await catalogResponse.text();
assert.doesNotMatch(html, /Made on Tilda|medvist\.ru/iu);

const payload = flightPayload(html);
const propsStart = payload.indexOf('{"initialQuery":');
assert.ok(propsStart >= 0, "The canonical CatalogClient properties were not found.");
const props = JSON.parse(balancedObject(payload, propsStart)) as {
  products: unknown[];
  manufacturers: unknown[];
  categories: unknown[];
};
const health = await readPublicJson("/internal/health/catalog");

assert.equal(props.products.length, EXPECTED_PUBLISHED_PRODUCTS);
assert.equal(new Set(props.products.map((value) => (value as { id: string }).id)).size, EXPECTED_PUBLISHED_PRODUCTS);
assert.equal(new Set(props.products.map((value) => (value as { slug: string }).slug)).size, EXPECTED_PUBLISHED_PRODUCTS);
assert.equal(health.snapshotProductCount, EXPECTED_PUBLISHED_PRODUCTS);
assert.equal(health.projectionVersion, 73);
assert.equal(health.fallbackActive, false);

const generatedAt = new Date().toISOString();
const catalog = validateStorefrontCatalog({
  products: props.products,
  manufacturers: props.manufacturers,
  categories: props.categories,
  summary: {
    schemaVersion: 1,
    generatedAt,
    productCount: props.products.length,
    activeProductCount: props.products.length,
    manufacturerCount: props.manufacturers.length,
    categoryCount: props.categories.length,
  },
});
assert.equal(catalog.products.every(({ status }) => status === "active"), true);

const audit = {
  schemaVersion: 1,
  generatedAt,
  source: `${SOURCE_ORIGIN}/catalog`,
  sourceHtmlSha256: sha256(html),
  projectionVersion: health.projectionVersion,
  projectionChecksumPrefix: health.projectionChecksumPrefix,
  products: catalog.products.length,
  manufacturers: catalog.manufacturers.length,
  categories: catalog.categories.length,
  uniqueProductIds: new Set(catalog.products.map(({ id }) => id)).size,
  uniqueProductSlugs: new Set(catalog.products.map(({ slug }) => slug)).size,
  unpublishedProducts: catalog.products.filter(({ status }) => status !== "active").length,
  lifecycleFields: 0,
  credentialsUsed: false,
  productionWrites: 0,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.info(JSON.stringify(audit));
