import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type SourceManifestProduct = Readonly<{
  model: string;
  canonicalName: string;
  manufacturer: string;
  sourceUrl: string;
  applicationTags: string[];
  hardReference?: Readonly<{
    description?: string | null;
    features?: string[] | null;
    specifications?: Array<{ name: string; value: string }> | null;
    media_min?: number | null;
  }> | null;
}>;

type SourceManifest = Readonly<{
  products: SourceManifestProduct[];
}>;

type StageProduct = Readonly<{
  id: string;
  sourceUid: string;
  slug: string;
  title: string;
  model: string;
  description: string;
  keyFeatures: ReadonlyArray<Readonly<{ text: string; sortOrder: number }>>;
  characteristicGroups: ReadonlyArray<Readonly<{
    items: ReadonlyArray<Readonly<{
      label: string;
      value: string;
      unit: string | null;
      sortOrder: number;
    }>>;
  }>>;
  media: ReadonlyArray<Readonly<{
    url: string;
    role: "hero" | "gallery";
    alt: string;
  }>>;
}>;

type StageCatalog = Readonly<{ products: StageProduct[] }>;

type MediaAsset = Readonly<{
  productSlug: string;
  sourcePageUrl: string;
  sourceMediaUrl: string;
  localPath: string;
  sha256: string;
  role: "hero" | "gallery";
  alt: string;
}>;

type MediaManifest = Readonly<{ assets: MediaAsset[] }>;

type MediaAuditProduct = Readonly<{
  productSlug: string;
  cleanMediaCount: number;
  status: string;
  fallback: boolean;
}>;

type MediaAudit = Readonly<{ products: MediaAuditProduct[] }>;

type ExtractedPage = Readonly<{
  requestedUrl: string;
  resolvedUrl: string;
  sourcePageSha256: string;
  fetchedAt: string;
  sourceTitle: string;
  sourceDescription: string;
  sourceFeatures: string[];
  sourceSpecifications: Array<{ name: string; value: string }>;
  sourceSupplementalSections: Array<{ title: string; items: string[]; narrative: string }>;
  sourceMediaUrls: string[];
}>;

const ROOT = resolve(process.cwd());
const SOURCE_MANIFEST_PATH = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(ROOT, "data/import/source/endomarket-source-truth-manifest-v5.json");
const STAGE_CATALOG_PATH = resolve(ROOT, "data/import/endomarket-wave1-stage-catalog.json");
const MEDIA_MANIFEST_PATH = resolve(ROOT, "data/import/endomarket-wave1-media-manifest.json");
const MEDIA_AUDIT_PATH = resolve(ROOT, "data/import/endomarket-media-audit-v5.json");
const OUTPUT_PATH = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(ROOT, "data/import/endomarket-source-truth-reconciliation-v5.json");

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/139 Safari/537.36";
const MAX_CONCURRENCY = 4;
const DIRECT_SOURCE_URL_CORRECTIVES = Object.freeze<Record<string, string>>({
  "https://endomarket.ru/products/videokolonoskop-sonoscape-ec-430t":
    "https://endomarket.ru/products/videokolonoskop-sonoscape-es-430t",
});
const SOURCE_MEDIA_RECOVERY = Object.freeze<Record<string, Readonly<{
  localPath: string;
  sha256: string;
  alt: string;
  watermarkReview: "pass_manual_2026-08-09";
}>>>({
  "medinova-processor_1.png": {
    localPath: "/media/endomarket-wave1/913ba0760fc140f2fdae5a90.png",
    sha256: "913ba0760fc140f2fdae5a90f4cf4a60a5bc9d429e4a0a5d4e231b684aa8d939",
    alt: "Видеопроцессор HV-3101 Medinova, изображение 3",
    watermarkReview: "pass_manual_2026-08-09",
  },
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

const namedEntities = Object.freeze<Record<string, string>>({
  amp: "&",
  apos: "'",
  bull: "•",
  deg: "°",
  gt: ">",
  laquo: "«",
  ldquo: "“",
  lt: "<",
  mdash: "—",
  micro: "µ",
  nbsp: " ",
  ndash: "–",
  plusmn: "±",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  sup2: "²",
  trade: "™",
  reg: "®",
  copy: "©",
  hellip: "…",
  times: "×",
});

function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/giu, (entity, token: string) => {
    if (token.startsWith("#x")) return String.fromCodePoint(Number.parseInt(token.slice(2), 16));
    if (token.startsWith("#")) return String.fromCodePoint(Number.parseInt(token.slice(1), 10));
    return namedEntities[token.toLocaleLowerCase("en-US")] ?? entity;
  });
}

function normalizeText(value: string) {
  return decodeEntities(value)
    .replace(/\u00a0/gu, " ")
    .replace(/[\t\r ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function textFromHtml(value: string) {
  return normalizeText(value
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/(?:p|div|h[1-6]|tr)>/giu, "\n")
    .replace(/<[^>]+>/gu, " "));
}

function extractMatches(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].map((match) => match[1] ?? "");
}

function mediaIdentity(value: string) {
  const url = new URL(value, "https://endomarket.ru");
  const basename = url.pathname.split("/").at(-1) ?? "";
  return basename.replace(/\.\d+x\d+w?(?=\.[^.]+$)/u, "").toLocaleLowerCase("en-US");
}

function normalizedComparable(value: string) {
  return normalizeText(value)
    .replace(/\s*([,;:/])\s*/gu, "$1")
    .replace(/-/gu, "–")
    .toLocaleLowerCase("ru-RU");
}

function parseTechnicalList(items: string[], sourceUrl: string) {
  const specifications: Array<{ name: string; value: string }> = [];
  for (const item of items) {
    const separated = item.match(/^(.+?)\s+[—–]\s+(.+)$/u);
    if (separated) {
      specifications.push({ name: separated[1]!.trim(), value: separated[2]!.trim() });
      continue;
    }
    if (/^макс\./iu.test(item) && specifications.length > 0) {
      const previous = specifications.at(-1)!;
      previous.value = `${previous.value}; ${item}`;
      continue;
    }
    const numeric = item.match(/^(.+?)\s+((?:<?\s*)?\d[\s\S]*)$/u);
    assert(numeric, `Unstructured technical source item: ${sourceUrl}: ${item}`);
    specifications.push({ name: numeric[1]!.trim(), value: numeric[2]!.trim() });
  }
  return specifications;
}

function extractPage(html: string, requestedUrl: string, resolvedUrl: string, fetchedAt: string): ExtractedPage {
  const sourceTitle = textFromHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu)?.[1] ?? "");
  assert(sourceTitle, `Direct page has no Product h1: ${requestedUrl}`);

  const tabs = html.match(/<div\s+class="tabs__content\s+active">([\s\S]*?)<\/div>/iu)?.[1] ?? "";
  const productDescription = html.match(/<div\s+class="product_description">([\s\S]*?)<\/div>/iu)?.[1] ?? "";
  const tabFeatures = extractMatches(tabs, /<li\b[^>]*>([\s\S]*?)<\/li>/giu)
    .map(textFromHtml)
    .filter(Boolean);
  const productDescriptionHeading = textFromHtml(productDescription.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/iu)?.[1] ?? "");
  const productDescriptionItems = extractMatches(productDescription, /<li\b[^>]*>([\s\S]*?)<\/li>/giu)
    .map(textFromHtml)
    .filter(Boolean);
  const productDescriptionNarrative = textFromHtml(productDescription
    .replace(/<ul\b[\s\S]*?<\/ul>/giu, "\n")
    .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/giu, "\n"));
  const productDescriptionIsFeatureSection = /особенност|преимуществ|возможност|функц/iu.test(productDescriptionHeading);
  const productDescriptionIsTechnicalSection = /технические характеристики/iu.test(productDescriptionHeading);
  const sourceFeatures = [
    ...tabFeatures,
    ...(productDescriptionIsFeatureSection ? productDescriptionItems : []),
  ];
  const sourceSupplementalSections = productDescription && !productDescriptionIsFeatureSection && !productDescriptionIsTechnicalSection
    ? [{
        title: productDescriptionHeading,
        items: productDescriptionItems,
        narrative: productDescriptionNarrative,
      }]
    : [];
  const primaryDescription = textFromHtml(tabs
    .replace(/<ul\b[\s\S]*?<\/ul>/giu, "\n")
    .replace(/<table\b[\s\S]*?<\/table>/giu, "\n")
    .replace(/<h3\b[^>]*>\s*(?:Основные особенности|Технические характеристики)\s*:?\s*<\/h3>/giu, "\n"));
  const supplementalDescription = sourceSupplementalSections.flatMap(({ title, items, narrative }) => [
    title,
    narrative,
    ...items.map((item) => `— ${item}`),
  ]).filter(Boolean).join("\n");
  const sourceDescription = [primaryDescription, supplementalDescription].filter(Boolean).join("\n\n");

  const parameterSection = html.match(/<div\s+class="product_parameters">([\s\S]*?)<!--\s*Характеристики товара \(The End\)\s*-->/iu)?.[1] ?? "";
  const parameterSpecifications = [...parameterSection.matchAll(
    /<li\b[^>]*>[\s\S]*?<div\s+class="tit">([\s\S]*?)<\/div>[\s\S]*?<div\s+class="val">([\s\S]*?)<\/div>[\s\S]*?<\/li>/giu,
  )].map((match) => ({
    name: textFromHtml(match[1] ?? ""),
    value: textFromHtml(match[2] ?? ""),
  })).filter(({ name, value }) => name && value);
  const tabularSpecifications = [...tabs.matchAll(/<table\b[^>]*class="[^"]*product_options[^"]*"[^>]*>([\s\S]*?)<\/table>/giu)]
    .flatMap((tableMatch) => [...(tableMatch[1] ?? "").matchAll(/<tr\b[^>]*>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/giu)])
    .map((match) => ({ name: textFromHtml(match[1] ?? ""), value: textFromHtml(match[2] ?? "") }))
    .filter(({ name, value }) => name && value);
  const technicalListSpecifications = productDescriptionIsTechnicalSection
    ? parseTechnicalList(productDescriptionItems, requestedUrl)
    : [];
  const sourceSpecifications = [...parameterSpecifications, ...tabularSpecifications, ...technicalListSpecifications];

  const gallerySection = html.match(/<div\s+class="slider slider-gallery-for">([\s\S]*?)<div\s+class="slider slider-gallery-nav">/iu)?.[1] ?? "";
  const sourceMediaUrls = extractMatches(gallerySection, /<img\s+src="([^"]+)"[^>]*>/giu)
    .map((url) => new URL(decodeEntities(url), resolvedUrl).toString());

  assert(sourceDescription || sourceFeatures.length > 0 || sourceSpecifications.length > 0, `Direct page has no auditable content: ${requestedUrl}`);
  assert(sourceMediaUrls.length > 0, `Direct page has no Product gallery: ${requestedUrl}`);
  assert(new Set(sourceFeatures).size === sourceFeatures.length, `Duplicate source feature: ${requestedUrl}`);
  assert(new Set(sourceSpecifications.map(({ name, value }) => `${name}\u0000${value}`)).size === sourceSpecifications.length, `Duplicate source specification: ${requestedUrl}`);
  assert(new Set(sourceMediaUrls.map(mediaIdentity)).size === sourceMediaUrls.length, `Duplicate source media: ${requestedUrl}`);

  return {
    requestedUrl,
    resolvedUrl,
    sourcePageSha256: sha256(html),
    fetchedAt,
    sourceTitle,
    sourceDescription,
    sourceFeatures,
    sourceSpecifications,
    sourceSupplementalSections,
    sourceMediaUrls,
  };
}

async function fetchPage(url: string) {
  const parsed = new URL(url);
  assert(parsed.protocol === "https:" && parsed.hostname === "endomarket.ru" && parsed.pathname.startsWith("/products/"), `Non-direct EndoMarket Product URL rejected: ${url}`);
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
  });
  assert(response.ok, `Direct source request failed ${response.status}: ${url}`);
  const contentType = response.headers.get("content-type") ?? "";
  assert(contentType.includes("text/html"), `Direct source returned non-HTML content: ${url}`);
  const html = await response.text();
  const fetchedAt = new Date().toISOString();
  return extractPage(html, url, response.url, fetchedAt);
}

async function mapConcurrent<T, R>(values: readonly T[], limit: number, callback: (value: T, index: number) => Promise<R>) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(values[index]!, index);
    }
  }));
  return results;
}

const [sourceManifestText, stageCatalogText, mediaManifestText, mediaAuditText, previousOutputText] = await Promise.all([
  readFile(SOURCE_MANIFEST_PATH, "utf8"),
  readFile(STAGE_CATALOG_PATH, "utf8"),
  readFile(MEDIA_MANIFEST_PATH, "utf8"),
  readFile(MEDIA_AUDIT_PATH, "utf8"),
  readFile(OUTPUT_PATH, "utf8").catch(() => null),
]);
const sourceManifest = JSON.parse(sourceManifestText) as SourceManifest;
const stageCatalog = JSON.parse(stageCatalogText) as StageCatalog;
const mediaManifest = JSON.parse(mediaManifestText) as MediaManifest;
const mediaAudit = JSON.parse(mediaAuditText) as MediaAudit;
const previousOutput = previousOutputText ? JSON.parse(previousOutputText) as {
  products?: Array<{ model: string; preCorrectiveStageComparison?: Record<string, unknown> }>;
} : null;
const previousPreComparisonByModel = new Map(
  (previousOutput?.products ?? []).flatMap((product) => product.preCorrectiveStageComparison
    ? [[product.model, product.preCorrectiveStageComparison] as const]
    : []),
);

await Promise.all(Object.values(SOURCE_MEDIA_RECOVERY).map(async ({ localPath, sha256: expectedChecksum }) => {
  const bytes = await readFile(resolve(ROOT, `public${localPath}`));
  assert(sha256(bytes) === expectedChecksum, `Recovered clean media checksum drift: ${localPath}`);
}));

assert(sourceManifest.products.length === 42, "v5 source manifest must contain exactly 42 Products");
assert(new Set(sourceManifest.products.map(({ model }) => model)).size === 42, "v5 Product models must be unique");
assert(new Set(sourceManifest.products.map(({ canonicalName }) => canonicalName)).size === 42, "v5 Product names must be unique");

const directUrlFor = (sourceUrl: string) => DIRECT_SOURCE_URL_CORRECTIVES[sourceUrl] ?? sourceUrl;
const sourceUrls = [...new Set(sourceManifest.products.map(({ sourceUrl }) => directUrlFor(sourceUrl)))];
const fetchedPages = await mapConcurrent(sourceUrls, MAX_CONCURRENCY, async (url, index) => {
  process.stderr.write(`[${index + 1}/${sourceUrls.length}] ${url}\n`);
  return fetchPage(url);
});
const pagesByUrl = new Map(fetchedPages.map((page) => [page.requestedUrl, page]));
const stageByModel = new Map(stageCatalog.products.map((product) => [product.model, product]));
const mediaAuditBySlug = new Map(mediaAudit.products.map((product) => [product.productSlug, product]));

const products = sourceManifest.products.map((manifestProduct) => {
  const directSourceUrl = directUrlFor(manifestProduct.sourceUrl);
  const page = pagesByUrl.get(directSourceUrl);
  assert(page, `Missing fetched direct page: ${directSourceUrl}`);
  const stageProduct = stageByModel.get(manifestProduct.model);
  assert(stageProduct, `Stage Product missing: ${manifestProduct.model}`);
  assert(stageProduct.title === manifestProduct.canonicalName, `Stage Product title drift: ${manifestProduct.model}`);
  assert(
    normalizedComparable(page.sourceTitle) === normalizedComparable(manifestProduct.canonicalName)
      || normalizedComparable(page.sourceTitle).includes(normalizedComparable(manifestProduct.manufacturer)),
    `Direct Product title mismatch for ${manifestProduct.model}: ${page.sourceTitle}`,
  );

  const sourceMediaByKey = new Map(page.sourceMediaUrls.map((url) => [mediaIdentity(url), url]));
  const localMedia = mediaManifest.assets.filter(({ productSlug }) => productSlug === stageProduct.slug);
  const localMediaByKey = new Map(localMedia.map((asset) => [mediaIdentity(asset.sourceMediaUrl), asset]));
  const cleanAudit = mediaAuditBySlug.get(stageProduct.slug);
  assert(cleanAudit?.status === "pass" && cleanAudit.fallback === false, `Clean media audit failed: ${manifestProduct.model}`);

  const sourceMedia = page.sourceMediaUrls.map((sourceUrl, index) => {
    const asset = localMediaByKey.get(mediaIdentity(sourceUrl));
    const recovery = SOURCE_MEDIA_RECOVERY[mediaIdentity(sourceUrl)];
    assert(asset || recovery, `Direct gallery asset is not available locally for ${manifestProduct.model}: ${sourceUrl}`);
    return {
      role: index === 0 ? "hero" as const : "gallery" as const,
      sourceUrl,
      localPath: recovery?.localPath ?? asset!.localPath,
      sha256: recovery?.sha256 ?? asset!.sha256,
      alt: recovery?.alt ?? asset!.alt,
      watermarkReview: recovery?.watermarkReview ?? "pass_v4_clean_media_audit",
      pendingManifestBinding: !asset || Boolean(recovery && asset.localPath !== recovery.localPath),
    };
  });
  const obsoleteLocalMedia = localMedia.filter((asset) => !sourceMediaByKey.has(mediaIdentity(asset.sourceMediaUrl)));
  const importedChecksums = sourceMedia.map(({ sha256: checksum }) => checksum);
  assert(new Set(importedChecksums).size === importedChecksums.length, `Duplicate clean media checksum: ${manifestProduct.model}`);

  const stageFeatures = stageProduct.keyFeatures.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(({ text }) => text);
  const stageSpecifications = stageProduct.characteristicGroups.flatMap((group) => group.items)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ label, value, unit }) => ({ name: label, value: `${value}${unit ? ` ${unit}` : ""}` }));
  const stageMediaChecksums = stageProduct.media.map(({ url }) => localMedia.find(({ localPath }) => localPath === url)?.sha256).filter(Boolean);
  const acceptedReference = manifestProduct.model === "EB-500" ? manifestProduct.hardReference : null;
  if (manifestProduct.model === "EB-500") {
    assert(acceptedReference?.description, "Product Owner-accepted EB-500 source description is missing");
    assert(acceptedReference.features?.length === 6, "Product Owner-accepted EB-500 features must remain 6/6");
    assert(acceptedReference.specifications?.length === 7, "Product Owner-accepted EB-500 specifications must remain 7/7");
    assert(page.sourceFeatures.length === 6 && page.sourceSpecifications.length === 7, "EB-500 direct-page structure drifted from the accepted reference");
  }
  const sourceDescription = acceptedReference?.description ?? page.sourceDescription;
  const sourceFeatures = acceptedReference?.features ?? page.sourceFeatures;
  const sourceSpecifications = acceptedReference?.specifications ?? page.sourceSpecifications;

  const observedStageComparison = {
    descriptionMatch: normalizedComparable(stageProduct.description) === normalizedComparable(sourceDescription),
    features: `${stageFeatures.length}/${sourceFeatures.length}`,
    featuresExactMatch: JSON.stringify(stageFeatures.map(normalizedComparable)) === JSON.stringify(sourceFeatures.map(normalizedComparable)),
    specifications: `${stageSpecifications.length}/${sourceSpecifications.length}`,
    specificationsExactMatch: JSON.stringify(stageSpecifications.map(({ name, value }) => ({ name: normalizedComparable(name), value: normalizedComparable(value) }))) === JSON.stringify(sourceSpecifications.map(({ name, value }) => ({ name: normalizedComparable(name), value: normalizedComparable(value) }))),
    media: `${stageProduct.media.length}/${sourceMedia.length}`,
    mediaExactMatch: stageProduct.media.length === sourceMedia.length && stageMediaChecksums.length === sourceMedia.length && sourceMedia.every(({ sha256: checksum }) => Boolean(checksum) && stageMediaChecksums.includes(checksum)),
  };

  return {
    product: manifestProduct.canonicalName,
    model: manifestProduct.model,
    manufacturer: manifestProduct.manufacturer,
    productId: stageProduct.id,
    sourceUid: stageProduct.sourceUid,
    slug: stageProduct.slug,
    manifestSourceUrl: manifestProduct.sourceUrl,
    directSourceUrl,
    resolvedSourceUrl: page.resolvedUrl,
    sourcePageSha256: page.sourcePageSha256,
    sourceFetchedAt: page.fetchedAt,
    sourceTitle: page.sourceTitle,
    sourceDescription,
    sourceFeaturesCount: sourceFeatures.length,
    sourceFeatures,
    sourceSpecificationsCount: sourceSpecifications.length,
    sourceSpecifications,
    sourceSupplementalSections: page.sourceSupplementalSections,
    acceptedReference: acceptedReference ? "product_owner_accepted_eb500" : null,
    sourceMediaCount: sourceMedia.length,
    sourceMedia,
    mediaReconciliation: {
      previousCleanAuditCount: cleanAudit.cleanMediaCount,
      missingDirectMedia: 0,
      pendingManifestBindings: sourceMedia.filter(({ pendingManifestBinding }) => pendingManifestBinding).length,
      obsoleteLocalMedia: obsoleteLocalMedia.map(({ sourceMediaUrl, localPath, sha256: checksum }) => ({ sourceMediaUrl, localPath, sha256: checksum })),
      sourceAssetsComplete: true,
      currentBindingComplete: sourceMedia.every(({ pendingManifestBinding }) => !pendingManifestBinding) && obsoleteLocalMedia.length === 0,
    },
    applicationTags: manifestProduct.applicationTags,
    preCorrectiveStageComparison: previousPreComparisonByModel.get(manifestProduct.model) ?? observedStageComparison,
    currentStageComparison: observedStageComparison,
  };
});

assert(products.length === 42, "Reconciliation must contain exactly 42 Products");
assert(products.every(({ sourceMediaCount }) => sourceMediaCount > 0), "Every source Product must have source media");
const generatedAt = new Date().toISOString();
const output = {
  schemaVersion: 1,
  generatedAt,
  sourcePolicy: {
    authoritativeContent: "DIRECT_ENDOMARKET_PRODUCT_PAGE",
    previousGenericPackages: "NON_AUTHORITATIVE_FOR_PRODUCT_CONTENT",
    extraction: "complete_description_all_feature_bullets_all_technical_characteristics_all_clean_unique_gallery_media",
  },
  sourceManifest: {
    path: SOURCE_MANIFEST_PATH,
    sha256: sha256(sourceManifestText),
  },
  counts: {
    products: products.length,
    uniqueDirectPages: sourceUrls.length,
    descriptions: products.filter(({ sourceDescription }) => sourceDescription).length,
    sourceFeatures: products.reduce((total, product) => total + product.sourceFeaturesCount, 0),
    sourceSpecifications: products.reduce((total, product) => total + product.sourceSpecificationsCount, 0),
    cleanSourceMedia: products.reduce((total, product) => total + product.sourceMediaCount, 0),
    preCorrectiveDescriptionMatches: products.filter(({ preCorrectiveStageComparison }) => preCorrectiveStageComparison.descriptionMatch).length,
    preCorrectiveFeatureExactMatches: products.filter(({ preCorrectiveStageComparison }) => preCorrectiveStageComparison.featuresExactMatch).length,
    preCorrectiveSpecificationExactMatches: products.filter(({ preCorrectiveStageComparison }) => preCorrectiveStageComparison.specificationsExactMatch).length,
    preCorrectiveMediaExactMatches: products.filter(({ preCorrectiveStageComparison }) => preCorrectiveStageComparison.mediaExactMatch).length,
    currentDescriptionMatches: products.filter(({ currentStageComparison }) => currentStageComparison.descriptionMatch).length,
    currentFeatureExactMatches: products.filter(({ currentStageComparison }) => currentStageComparison.featuresExactMatch).length,
    currentSpecificationExactMatches: products.filter(({ currentStageComparison }) => currentStageComparison.specificationsExactMatch).length,
    currentMediaExactMatches: products.filter(({ currentStageComparison }) => currentStageComparison.mediaExactMatch).length,
    productsWithMediaBindingDrift: products.filter(({ mediaReconciliation }) => !mediaReconciliation.currentBindingComplete).length,
    missingDirectMedia: products.reduce((total, product) => total + product.mediaReconciliation.missingDirectMedia, 0),
    pendingManifestMediaBindings: products.reduce((total, product) => total + product.mediaReconciliation.pendingManifestBindings, 0),
    obsoleteLocalMedia: products.reduce((total, product) => total + product.mediaReconciliation.obsoleteLocalMedia.length, 0),
  },
  products,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ outputPath: OUTPUT_PATH, sha256: sha256(`${JSON.stringify(output, null, 2)}\n`), counts: output.counts }, null, 2)}\n`);
