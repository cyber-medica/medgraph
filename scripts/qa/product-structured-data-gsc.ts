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
  const productNode = nodes.find((node) => node["@type"] === "Product");
  const itemPageNode = nodes.find((node) => node["@type"] === "ItemPage");
  const breadcrumbNode = nodes.find((node) => node["@type"] === "BreadcrumbList");
  const identityNode = itemPageNode ?? productNode;
  const h1 = decodeHtml(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/iu) ?? "");
  const canonical = firstMatch(
    html,
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/iu,
  ) ?? firstMatch(
    html,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/iu,
  );
  const description = String(identityNode?.description ?? "");
  const imageUrls = schemaImages(identityNode);
  const provider = itemPageNode?.provider && typeof itemPageNode.provider === "object"
    ? itemPageNode.provider as JsonObject
    : undefined;
  const brand = productNode?.brand && typeof productNode.brand === "object"
    ? productNode.brand as JsonObject
    : undefined;
  const offer = productNode?.offers && typeof productNode.offers === "object"
    ? productNode.offers as JsonObject
    : undefined;
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
  const productEligibilityErrors = productNode
    ? [
        ...(productNode.offers || productNode.review || productNode.aggregateRating
          ? []
          : ["missing_offers_review_aggregateRating"]),
        ...(offer && !(offer.price || (offer.priceSpecification as JsonObject | undefined)?.price)
          ? ["offer_missing_price"]
          : []),
      ]
    : [];
  const primaryImageResolved = await imageResolves(imageUrls[0]);

  return {
    route,
    productId: row.id,
    slug: row.slug,
    model: row.model,
    publicationState: row.status,
    httpStatus: response.status,
    finalUrl: response.url.split("?")[0],
    h1,
    canonical,
    productDetected: Boolean(productNode),
    itemPageDetected: Boolean(itemPageNode),
    breadcrumbDetected: Boolean(breadcrumbNode),
    name: String(identityNode?.name ?? ""),
    nameMatchesH1: Boolean(h1) && identityNode?.name === h1,
    descriptionPlainText: Boolean(description) && !/<[^>]+>|&(?:nbsp|amp|lt|gt|quot|apos);/iu.test(description),
    brandOrProvider: String(brand?.name ?? provider?.name ?? ""),
    imageCount: imageUrls.length,
    imageResolved: primaryImageResolved,
    imageHosts: [...new Set(imageUrls.map((value) => new URL(value).hostname))],
    offers: Boolean(productNode?.offers),
    review: Boolean(productNode?.review),
    aggregateRating: Boolean(productNode?.aggregateRating),
    googleProductRichResultEligible: Boolean(productNode) && productEligibilityErrors.length === 0,
    productEligibilityErrors,
    forbiddenHosts: [...new Set(forbiddenHosts)],
    pass: response.status === 200
      && Boolean(identityNode)
      && Boolean(breadcrumbNode)
      && Boolean(h1)
      && identityNode?.name === h1
      && Boolean(description)
      && !/<[^>]+>|&(?:nbsp|amp|lt|gt|quot|apos);/iu.test(description)
      && canonical === `${canonicalOrigin}${route}`
      && imageUrls.length > 0
      && primaryImageResolved
      && forbiddenHosts.length === 0,
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
const productDetected = products.filter((entry) => entry.productDetected).length;
const itemPageDetected = products.filter((entry) => entry.itemPageDetected).length;
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
    breadcrumbDetected: products.filter((entry) => entry.breadcrumbDetected).length,
    namesMatchH1: products.filter((entry) => entry.nameMatchesH1).length,
    plainTextDescriptions: products.filter((entry) => entry.descriptionPlainText).length,
    imagesResolved: products.filter((entry) => entry.imageResolved).length,
    googleProductRichResultEligible: products.filter((entry) => entry.googleProductRichResultEligible).length,
    missingOfferReviewRating: products.filter((entry) => entry.productEligibilityErrors.includes("missing_offers_review_aggregateRating")).length,
    forbiddenHostFindings: products.reduce((total, entry) => total + entry.forbiddenHosts.length, 0),
    pass: products.filter((entry) => entry.pass).length,
    strategyMatches,
  },
  products,
};

if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary, null, 2));

if (!allowFailures && (products.length !== 114 || !strategyMatches || report.summary.pass !== products.length)) {
  process.exitCode = 1;
}
