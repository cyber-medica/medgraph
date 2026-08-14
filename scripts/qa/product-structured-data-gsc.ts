import { writeFile } from "node:fs/promises";

import publishedSnapshotJson from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";

type JsonObject = Record<string, unknown>;

const projection = publishedSnapshotJson.projection as unknown as PublishedCatalogProjection;
const origin = new URL(process.env.CYBERMEDICA_AUDIT_ORIGIN ?? "https://cyber-medica.ru").origin;
const canonicalOrigin = "https://cyber-medica.ru";
const outputPath = process.env.CYBERMEDICA_AUDIT_OUTPUT;
const expectedStrategy = process.env.CYBERMEDICA_AUDIT_STRATEGY ?? "auto";
const allowFailures = process.env.CYBERMEDICA_AUDIT_ALLOW_FAILURES === "1";
const concurrency = 8;
const imageResolutionCache = new Map<string, Promise<boolean>>();

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;|&#38;/giu, "&")
    .replace(/&lt;|&#60;/giu, "<")
    .replace(/&gt;|&#62;/giu, ">")
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function firstMatch(value: string, pattern: RegExp) {
  return pattern.exec(value)?.[1] ?? null;
}

function jsonLdNodes(html: string) {
  const nodes: JsonObject[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu;
  for (const match of html.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(match[1] ?? "null") as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          nodes.push(value as JsonObject);
        }
      }
    } catch {
      nodes.push({ "@type": "InvalidJsonLd" });
    }
  }
  return nodes;
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}

function schemaImages(node: JsonObject | undefined) {
  if (!node) return [];
  const mainEntity = node.mainEntity && typeof node.mainEntity === "object"
    ? node.mainEntity as JsonObject
    : undefined;
  const raw = node.image ?? mainEntity?.image;
  return (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .filter((value): value is string => typeof value === "string");
}

async function imageResolves(url: string | undefined) {
  if (!url) return false;
  const cached = imageResolutionCache.get(url);
  if (cached) return cached;
  const request = (async () => {
    try {
      const response = await fetch(url, {
        headers: { Range: "bytes=0-0", "User-Agent": "CyberMedica-Structured-Data-Audit/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      await response.body?.cancel();
      return response.ok && (response.headers.get("content-type") ?? "").startsWith("image/");
    } catch {
      return false;
    }
  })();
  imageResolutionCache.set(url, request);
  return request;
}

async function auditProduct(row: PublishedCatalogProjection["products"][number], index: number) {
  const route = `/catalog/${row.slug}`;
  const requestUrl = new URL(route, origin);
  requestUrl.searchParams.set("structured-data-audit", `${Date.now()}-${index}`);
  const response = await fetch(requestUrl, {
    headers: { "User-Agent": "CyberMedica-Structured-Data-Audit/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const html = await response.text();
  const nodes = jsonLdNodes(html);
  const itemPageNode = nodes.find((node) => node["@type"] === "ItemPage");
  const mainEntityNode = itemPageNode?.mainEntity && typeof itemPageNode.mainEntity === "object"
    ? itemPageNode.mainEntity as JsonObject
    : undefined;
  const productGraphCount = nodes.filter((node) => node["@type"] === "Product").length;
  const breadcrumbGraphCount = nodes.filter((node) => node["@type"] === "BreadcrumbList").length;
  const h1 = decodeHtml(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/iu) ?? "");
  const canonical = firstMatch(
    html,
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/iu,
  ) ?? firstMatch(
    html,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/iu,
  );
  const description = String(mainEntityNode?.description ?? itemPageNode?.description ?? "");
  const imageUrls = schemaImages(itemPageNode);
  const urls = stringsIn(nodes).flatMap((value) => {
    try {
      return value.startsWith("http") ? [new URL(value)] : [];
    } catch {
      return [];
    }
  });
  const forbiddenHosts = urls
    .map(({ hostname }) => hostname)
    .filter((hostname) => /(?:^|\.)stage\.cyber-medica\.ru$|\.vercel\.app$|(?:^|\.)medvist\.ru$/iu.test(hostname));
  const imageResolution = await Promise.all(imageUrls.map(imageResolves));
  const allImagesResolvable = imageUrls.length > 0 && imageResolution.every(Boolean);
  const structuredName = String(mainEntityNode?.name ?? itemPageNode?.name ?? "");
  const descriptionIsPlainText = Boolean(description)
    && !/<[^>]+>|&(?:nbsp|amp|lt|gt|quot|apos);/iu.test(description);
  const offersPresent = stringsIn(nodes).some((value) => value === "offers")
    || nodes.some((node) => "offers" in node)
    || Boolean(mainEntityNode && "offers" in mainEntityNode);
  const reviewPresent = nodes.some((node) => "review" in node)
    || Boolean(mainEntityNode && "review" in mainEntityNode);
  const aggregateRatingPresent = nodes.some((node) => "aggregateRating" in node)
    || Boolean(mainEntityNode && "aggregateRating" in mainEntityNode);
  const validationErrors = [
    ...(response.status === 200 ? [] : [`http_${response.status}`]),
    ...(itemPageNode?.["@type"] === "ItemPage" ? [] : ["missing_item_page"]),
    ...(mainEntityNode?.["@type"] === "MedicalDevice" ? [] : ["invalid_main_entity_type"]),
    ...(breadcrumbGraphCount === 1 ? [] : [`breadcrumb_graph_count_${breadcrumbGraphCount}`]),
    ...(productGraphCount === 0 ? [] : [`product_graph_count_${productGraphCount}`]),
    ...(Boolean(h1) && structuredName === h1 ? [] : ["structured_name_h1_mismatch"]),
    ...(descriptionIsPlainText ? [] : ["structured_description_not_plain_text"]),
    ...(canonical === `${canonicalOrigin}${route}` ? [] : ["canonical_mismatch"]),
    ...(allImagesResolvable ? [] : ["structured_image_unresolved"]),
    ...(forbiddenHosts.length === 0 ? [] : ["forbidden_host_detected"]),
    ...(offersPresent ? ["offers_present"] : []),
    ...(reviewPresent ? ["review_present"] : []),
    ...(aggregateRatingPresent ? ["aggregate_rating_present"] : []),
  ];

  return {
    productId: row.id,
    slug: row.slug,
    canonicalUrl: canonical,
    httpStatus: response.status,
    h1,
    structuredName,
    nameMatchesH1: Boolean(h1) && structuredName === h1,
    pageType: String(itemPageNode?.["@type"] ?? ""),
    mainEntityType: String(mainEntityNode?.["@type"] ?? ""),
    structuredDescriptionPlainText: description,
    imageCount: imageUrls.length,
    allImagesResolvable,
    breadcrumbGraphCount,
    productGraphCount,
    offersPresent,
    reviewPresent,
    aggregateRatingPresent,
    forbiddenHostDetected: forbiddenHosts.length > 0,
    validationStatus: validationErrors.length === 0 ? "PASS" : "FAIL",
    validationErrors,
  };
}

async function mapConcurrent<T, R>(values: readonly T[], worker: (value: T, index: number) => Promise<R>) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index]!, index);
    }
  }));
  return results;
}

const products = await mapConcurrent(projection.products, auditProduct);
const productDetected = products.reduce((total, entry) => total + entry.productGraphCount, 0);
const itemPageDetected = products.filter((entry) => entry.pageType === "ItemPage").length;
const strategyMatches = expectedStrategy === "auto"
  || (expectedStrategy === "product" && productDetected === products.length)
  || (expectedStrategy === "item-page" && itemPageDetected === products.length && productDetected === 0);
const report = {
  version: "product-structured-data-gsc-audit-v1",
  generatedAt: new Date().toISOString(),
  origin,
  expectedStrategy,
  summary: {
    products: products.length,
    http200: products.filter((entry) => entry.httpStatus === 200).length,
    productDetected,
    itemPageDetected,
    medicalDeviceDetected: products.filter((entry) => entry.mainEntityType === "MedicalDevice").length,
    breadcrumbDetected: products.filter((entry) => entry.breadcrumbGraphCount === 1).length,
    namesMatchH1: products.filter((entry) => entry.nameMatchesH1).length,
    plainTextDescriptions: products.filter((entry) => Boolean(entry.structuredDescriptionPlainText)
      && !/<[^>]+>|&(?:nbsp|amp|lt|gt|quot|apos);/iu.test(entry.structuredDescriptionPlainText)).length,
    imagesResolved: products.filter((entry) => entry.allImagesResolvable).length,
    offersPresent: products.filter((entry) => entry.offersPresent).length,
    reviewPresent: products.filter((entry) => entry.reviewPresent).length,
    aggregateRatingPresent: products.filter((entry) => entry.aggregateRatingPresent).length,
    forbiddenHostFindings: products.filter((entry) => entry.forbiddenHostDetected).length,
    pass: products.filter((entry) => entry.validationStatus === "PASS").length,
    strategyMatches,
  },
  products,
};

if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary, null, 2));

if (!allowFailures && (products.length !== 114 || !strategyMatches || report.summary.pass !== products.length)) {
  process.exitCode = 1;
}
