import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import test from "node:test";

import { notFound, unstable_rethrow } from "next/navigation.js";

import {
  parsePublishedCatalogProjection,
  type PublishedCatalogProjection,
} from "../../lib/published-catalog/contracts.ts";
import { APPROVED_PUBLIC_MEDIA_HOSTS } from "../../lib/public-media-policy.ts";
import {
  CLOUD_PUBLISHED_MAX_RESPONSE_BYTES,
  CloudPublishedCatalogRepositoryError,
  loadValidatedPublishedCatalogProjection,
} from "../../lib/storefront/cloud-published-response.ts";
import { buildStorefrontSitemapFromCatalog } from "../../lib/storefront/storefront-sitemap.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import {
  SupabaseEnvironmentError,
  validateSupabaseProjectOrigin,
} from "../../lib/supabase/env.ts";

const timestamp = "2026-07-27T00:00:00.000Z";
const responseOptions = { rethrowFrameworkError: () => undefined };

function projection(): PublishedCatalogProjection {
  return {
    schemaVersion: 1,
    generatedAt: timestamp,
    products: [{
      id: "published-product",
      slug: "published-product",
      title: "Published Product",
      model: "PP-1",
      shortDescription: "Public summary",
      description: "Public description.",
      manufacturerId: "manufacturer-public-id",
      categoryId: "category-public-id",
      status: "active",
      applicationAreas: [{ id: "area-public-id", name: "Intensive Care" }],
      keyFeatures: [],
      characteristicGroups: [],
      media: [{
        url: "https://static.tildacdn.com/equipment.webp",
        role: "primary",
        format: "image/webp",
        sortOrder: 10,
      }],
      documents: [],
      registrations: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    manufacturers: [{
      id: "manufacturer-public-id",
      slug: "published-manufacturer",
      name: "Published Manufacturer",
      description: "Public manufacturer description.",
      countryCode: "CH",
      website: "https://example.invalid/manufacturer",
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    categories: [{
      id: "category-public-id",
      slug: "published-category",
      name: "Published Category",
      description: "Public category description.",
      position: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    applicationAreas: [{
      id: "area-public-id",
      slug: "intensive-care",
      name: "Intensive Care",
      description: "Public application area.",
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    summary: {
      productCount: 1,
      manufacturerCount: 1,
      categoryCount: 1,
      applicationAreaCount: 1,
    },
  };
}

function cloneProjection(): PublishedCatalogProjection {
  return structuredClone(projection());
}

function responseFor(
  value: unknown,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function assertInvalidProjection(value: unknown) {
  await assert.rejects(
    () => loadValidatedPublishedCatalogProjection(
      async () => responseFor(value),
      responseOptions,
    ),
    (error: unknown) => error instanceof CloudPublishedCatalogRepositoryError
      && error.code === "invalid_payload"
      && error.message === "Published catalog is unavailable.",
  );
}

test("service-role storefront origin accepts only a canonical Supabase project origin", () => {
  const canonical = "https://gjlpkqdhlzbfnzzoxlsk.supabase.co";
  assert.equal(validateSupabaseProjectOrigin(canonical), canonical);
  assert.equal(
    validateSupabaseProjectOrigin("https://GJLPKQDHLZBFNZZOXLSK.SUPABASE.CO/"),
    canonical,
  );

  const rejected = [
    "https://example.com",
    "https://localhost",
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
    "https://10.0.0.1",
    "http://gjlpkqdhlzbfnzzoxlsk.supabase.co",
    "https://user:password@gjlpkqdhlzbfnzzoxlsk.supabase.co",
    "https://gjlpkqdhlzbfnzzoxlsk.supabase.co:8443",
    "https://gjlpkqdhlzbfnzzoxlsk.supabase.co/rest/v1",
    "https://gjlpkqdhlzbfnzzoxlsk.supabase.co?target=other",
    "https://gjlpkqdhlzbfnzzoxlsk.supabase.co#fragment",
    "https://gjlpkqdhlzbfnzzoxlsk.supabase.co.attacker.example",
    "https://gjlpkqdhlzbfnzzoxlsk.supabase.co.",
    "https://xn--gjlpkqdhlzbfnzzoxlsk.supabase.co",
    "https://%67jlpkqdhlzbfnzzoxlsk.supabase.co",
    "not-a-url",
  ];

  rejected.forEach((value) => {
    assert.throws(
      () => validateSupabaseProjectOrigin(value),
      (error: unknown) => error instanceof SupabaseEnvironmentError
        && error.message === "NEXT_PUBLIC_SUPABASE_URL must be an approved Supabase project origin."
        && !error.message.includes(value),
    );
  });

  assert.equal(
    validateSupabaseProjectOrigin("http://127.0.0.1:54321", {
      allowLocalDevelopment: true,
    }),
    "http://127.0.0.1:54321",
  );
  assert.equal(
    validateSupabaseProjectOrigin("http://[::1]:54321", {
      allowLocalDevelopment: true,
    }),
    "http://[::1]:54321",
  );
});

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => {
    if (error) reject(error);
    else resolve();
  }));
}

test("redirect:error rejects 301/302/303/307/308 without forwarding service headers", async () => {
  const leakedHeaders: Array<{ apikey?: string; authorization?: string }> = [];
  const target = createServer((request, response) => {
    leakedHeaders.push({
      apikey: request.headers.apikey as string | undefined,
      authorization: request.headers.authorization,
    });
    response.end("unexpected");
  });
  target.listen(0, "127.0.0.1");
  await once(target, "listening");
  const targetAddress = target.address();
  assert.ok(targetAddress && typeof targetAddress !== "string");

  let status = 301;
  let location = `http://127.0.0.1:${targetAddress.port}/target`;
  const origin = createServer((request, response) => {
    if (request.url === "/same-target") {
      leakedHeaders.push({
        apikey: request.headers.apikey as string | undefined,
        authorization: request.headers.authorization,
      });
      response.end("unexpected");
      return;
    }
    response.writeHead(status, { Location: location });
    response.end();
  });
  origin.listen(0, "127.0.0.1");
  await once(origin, "listening");
  const originAddress = origin.address();
  assert.ok(originAddress && typeof originAddress !== "string");

  try {
    for (const redirectStatus of [301, 302, 303, 307, 308]) {
      status = redirectStatus;
      for (const targetLocation of [
        `http://127.0.0.1:${targetAddress.port}/target`,
        `http://127.0.0.1:${originAddress.port}/same-target`,
      ]) {
        location = targetLocation;
        await assert.rejects(() => fetch(
          `http://127.0.0.1:${originAddress.port}/start`,
          {
            method: "POST",
            redirect: "error",
            headers: {
              apikey: "service-role-secret",
              Authorization: "Bearer service-role-secret",
            },
          },
        ));
      }
    }
    assert.deepEqual(leakedHeaders, []);
  } finally {
    await Promise.all([closeServer(origin), closeServer(target)]);
  }
});

test("server client locks target origin and forces redirect:error after caller options", async () => {
  const source = await readFile("lib/supabase/client.server.ts", "utf8");
  const spreadIndex = source.indexOf("...init,");
  const redirectIndex = source.indexOf('redirect: "error"');
  assert.match(source, /requestUrl\.origin !== new URL\(url\)\.origin/u);
  assert.ok(spreadIndex >= 0 && redirectIndex > spreadIndex);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)/u);
});

test("Next.js control-flow exceptions are rethrown and transport errors stay sanitized", async () => {
  let nextControlFlowError: unknown;
  try {
    notFound();
  } catch (error) {
    nextControlFlowError = error;
  }
  assert.ok(nextControlFlowError);
  await assert.rejects(
    () => loadValidatedPublishedCatalogProjection(
      async () => { throw nextControlFlowError; },
      { rethrowFrameworkError: unstable_rethrow },
    ),
    (error: unknown) => error === nextControlFlowError,
  );

  const secret = "service-role-secret-and-raw-url";
  await assert.rejects(
    () => loadValidatedPublishedCatalogProjection(async () => {
      throw new Error(secret);
    }, responseOptions),
    (error: unknown) => error instanceof CloudPublishedCatalogRepositoryError
      && error.code === "transport"
      && !error.message.includes(secret),
  );
});

test("snapshot identity and relational ambiguity fail closed", async () => {
  const duplicateCases: Array<{
    collection: "products" | "manufacturers" | "categories" | "applicationAreas";
    field: "id" | "slug";
    summary: "productCount" | "manufacturerCount" | "categoryCount" | "applicationAreaCount";
  }> = [
    { collection: "products", field: "id", summary: "productCount" },
    { collection: "products", field: "slug", summary: "productCount" },
    { collection: "manufacturers", field: "id", summary: "manufacturerCount" },
    { collection: "manufacturers", field: "slug", summary: "manufacturerCount" },
    { collection: "categories", field: "id", summary: "categoryCount" },
    { collection: "categories", field: "slug", summary: "categoryCount" },
    { collection: "applicationAreas", field: "id", summary: "applicationAreaCount" },
    { collection: "applicationAreas", field: "slug", summary: "applicationAreaCount" },
  ];

  for (const { collection, field, summary } of duplicateCases) {
    const value = cloneProjection();
    const original = value[collection][0];
    value[collection].push({
      ...original,
      id: field === "id" ? original.id : `${original.id}-other`,
      slug: field === "slug" ? original.slug : `${original.slug}-other`,
    } as never);
    value.summary[summary] += 1;
    await assertInvalidProjection(value);
  }

  const brokenManufacturer = cloneProjection();
  brokenManufacturer.products[0].manufacturerId = "missing-manufacturer";
  await assertInvalidProjection(brokenManufacturer);

  const brokenCategory = cloneProjection();
  brokenCategory.products[0].categoryId = "missing-category";
  await assertInvalidProjection(brokenCategory);

  const brokenArea = cloneProjection();
  brokenArea.products[0].applicationAreas[0].id = "missing-area";
  await assertInvalidProjection(brokenArea);

  const mismatchedArea = cloneProjection();
  mismatchedArea.products[0].applicationAreas[0].name = "Conflicting Name";
  await assertInvalidProjection(mismatchedArea);

  const duplicateAreaReference = cloneProjection();
  duplicateAreaReference.products[0].applicationAreas.push({
    ...duplicateAreaReference.products[0].applicationAreas[0],
  });
  await assertInvalidProjection(duplicateAreaReference);

  const uppercaseSlug = cloneProjection();
  uppercaseSlug.products[0].slug = "Published-Product";
  await assertInvalidProjection(uppercaseSlug);

  assert.deepEqual(parsePublishedCatalogProjection(projection()), projection());
});

test("published media validation shares the exact Next.js hostname allowlist", async () => {
  assert.deepEqual(APPROVED_PUBLIC_MEDIA_HOSTS, [
    "cyber-medica.ru",
    "static.tildacdn.com",
  ]);
  const config = await readFile("next.config.ts", "utf8");
  assert.match(config, /APPROVED_PUBLIC_MEDIA_HOSTS/u);
  assert.match(config, /remotePatterns: APPROVED_PUBLIC_MEDIA_HOSTS\.map/u);

  for (const url of [
    "https://unknown.example/equipment.webp",
    "http://static.tildacdn.com/equipment.webp",
    "https://static.tildacdn.com:8443/equipment.webp",
    "https://user:password@static.tildacdn.com/equipment.webp",
  ]) {
    const value = cloneProjection();
    value.products[0].media[0].url = url;
    await assertInvalidProjection(value);
  }

  const canonicalMedia = cloneProjection();
  canonicalMedia.products[0].media[0].url =
    "https://cyber-medica.ru/media/endomarket-wave1/equipment.webp";
  assert.deepEqual(
    parsePublishedCatalogProjection(canonicalMedia),
    canonicalMedia,
  );
  assert.deepEqual(parsePublishedCatalogProjection(projection()), projection());
});

test("bounded reader enforces actual decoded bytes before parsing", async () => {
  const maximumBytes = 4096;
  const serialized = JSON.stringify(projection());
  assert.ok(Buffer.byteLength(serialized) < maximumBytes);

  const exactBody = `${serialized}${" ".repeat(maximumBytes - Buffer.byteLength(serialized))}`;
  const exact = await loadValidatedPublishedCatalogProjection(
    async () => new Response(exactBody, {
      headers: { "Content-Length": String(maximumBytes) },
    }),
    { ...responseOptions, maximumBytes },
  );
  assert.equal(exact.products.length, 1);

  for (const response of [
    new Response(`${exactBody} `),
    new Response(`${exactBody} `, { headers: { "Content-Length": "1" } }),
    new Response(serialized, { headers: { "Content-Length": String(maximumBytes + 1) } }),
    new Response("{".repeat(maximumBytes + 1)),
  ]) {
    await assert.rejects(
      () => loadValidatedPublishedCatalogProjection(
        async () => response,
        { ...responseOptions, maximumBytes },
      ),
      (error: unknown) => error instanceof CloudPublishedCatalogRepositoryError
        && error.code === "payload_too_large"
        && error.message === "Published catalog is unavailable.",
    );
  }

  const chunks = [serialized.slice(0, 100), serialized.slice(100)];
  const chunked = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)));
      controller.close();
    },
  });
  const chunkedValue = await loadValidatedPublishedCatalogProjection(
    async () => new Response(chunked),
    { ...responseOptions, maximumBytes },
  );
  assert.equal(chunkedValue.products[0].slug, "published-product");

  await assert.rejects(
    () => loadValidatedPublishedCatalogProjection(
      async () => new Response("not-json"),
      { ...responseOptions, maximumBytes },
    ),
    (error: unknown) => error instanceof CloudPublishedCatalogRepositoryError
      && error.code === "invalid_payload",
  );

  const streamSecret = "stream-secret-must-not-leak";
  const failedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error(streamSecret));
    },
  });
  await assert.rejects(
    () => loadValidatedPublishedCatalogProjection(
      async () => new Response(failedStream),
      { ...responseOptions, maximumBytes },
    ),
    (error: unknown) => error instanceof CloudPublishedCatalogRepositoryError
      && error.code === "transport"
      && !error.message.includes(streamSecret),
  );

  assert.equal(CLOUD_PUBLISHED_MAX_RESPONSE_BYTES, 8 * 1024 * 1024);
});

test("cloud_published sitemap consumes one coherent snapshot without build-time RPC fan-out", async () => {
  const mapped = mapCloudPublishedCatalogProjection(projection());
  const sitemap = buildStorefrontSitemapFromCatalog(mapped);
  const paths = sitemap.map(({ url }) => new URL(url).pathname);
  assert.ok(paths.includes("/catalog/published-product"));
  assert.ok(paths.includes("/manufacturers/published-manufacturer"));

  const [sitemapSource, productPage, manufacturerPage, repository] = await Promise.all([
    readFile("app/sitemap.ts", "utf8"),
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
    readFile("app/manufacturers/[slug]/page.tsx", "utf8"),
    readFile("lib/storefront/cloud-published-catalog-repository.ts", "utf8"),
  ]);
  assert.equal(sitemapSource.match(/await loadCloudPublishedCatalog\(\)/gu)?.length, 1);
  assert.match(sitemapSource, /export const dynamic = "force-dynamic"/u);
  assert.match(productPage, /storefrontDataSource === "cloud_published"\) return \[\]/u);
  assert.match(manufacturerPage, /storefrontDataSource === "cloud_published"\) return \[\]/u);
  assert.match(productPage, /export const dynamic = "force-dynamic"/u);
  assert.match(manufacturerPage, /export const dynamic = "force-dynamic"/u);
  assert.match(repository, /cache\(requestCloudPublishedCatalog\)/u);
  assert.match(repository, /VERCEL_ENV === undefined/u);
  assert.match(repository, /process\.env\.VERCEL !== "1"/u);
  assert.doesNotMatch(repository, /CloudPreviewCatalogRepository|staticCatalogRepository/u);
});

test("corrective scope remains read-only and leaves protected contracts unchanged", async () => {
  const [repository, response, contract, service, types, sitemap] = await Promise.all([
    readFile("lib/storefront/cloud-published-catalog-repository.ts", "utf8"),
    readFile("lib/storefront/cloud-published-response.ts", "utf8"),
    readFile("lib/storefront/catalog-repository.ts", "utf8"),
    readFile("lib/storefront/product-service.ts", "utf8"),
    readFile("lib/storefront/types.ts", "utf8"),
    readFile("app/sitemap.ts", "utf8"),
  ]);
  const correctiveRuntime = `${repository}\n${response}\n${sitemap}`;
  assert.match(repository, /cloud_published_storefront_catalog_v1/u);
  assert.doesNotMatch(correctiveRuntime, /\b(?:PATCH|PUT|DELETE)\b|publication|initialize/iu);
  assert.doesNotMatch(correctiveRuntime, /cloud_storefront_preview_catalog|preview_draft/u);
  assert.equal(contract.includes("cloud_published"), false);
  assert.equal(service.includes("cloud_published"), false);
  assert.equal(types.includes("cloud_published"), false);
});
