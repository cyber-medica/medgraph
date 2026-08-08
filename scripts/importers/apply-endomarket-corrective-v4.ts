import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

type CorrectiveSpecification = Readonly<{
  group: string;
  items: ReadonlyArray<Readonly<{ name: string; value: string; unit?: string }>>;
}>;

type CorrectiveProduct = Readonly<{
  name: string;
  manufacturer: string;
  model: string;
  source_url: string;
  source_category: string;
  cyber_category: string;
  candidate_slug: string;
  short_description: string;
  full_description: string;
  key_features: string[];
  specifications: CorrectiveSpecification[];
  seo_title: string;
  seo_description: string;
  application_areas: string[];
  source_media_evidence: Readonly<{
    status: string;
    min_images: number | null;
    note: string;
  }>;
  media_source_requirements?: Readonly<{
    minimum_source_images_expected: number;
    missing_media_is_blocker_for_this_product: boolean;
  }>;
  presentation: Readonly<{
    applicationAreaTags: string[];
    featureSectionTitle: string;
    showFeatureSection: boolean;
    hideCountryWhenMissing: boolean;
    catalogShowSpecifications: boolean;
    productDetailShowAllApplicationTags: boolean;
    productDetailApplicationTagsOverflowCounter: boolean;
    manufacturerBlockPlacement: string;
  }>;
}>;

type Corrective = Readonly<{
  version: number;
  products: CorrectiveProduct[];
}>;

type StageMedia = {
  url: string;
  role: "hero" | "gallery";
  format: string;
  alt: string;
};

type StageProduct = {
  id: string;
  sourceUid: string;
  slug: string;
  title: string;
  model: string;
  seoTitle: string;
  seoDescription: string;
  shortDescription: string;
  description: string;
  publicationStatus: string;
  published: boolean;
  updatedAt: string;
  applicationAreas: Array<{ id: string; name: string }>;
  keyFeatures: Array<{ text: string; sortOrder: number }>;
  characteristicGroups: Array<{
    key: string;
    title: string;
    sortOrder: number;
    items: Array<{ label: string; value: string; unit: string | null; sortOrder: number }>;
  }>;
  media: StageMedia[];
  stageImport: {
    entityOrigin: "new_candidate" | "existing_duplicate";
    sourceName: string;
    sourceUrl: string;
    sourceUid: string;
    productId: string;
  };
  [key: string]: unknown;
};

type StageSnapshot = {
  schemaVersion: number;
  generatedAt: string;
  products: StageProduct[];
  summary: Record<string, number>;
  [key: string]: unknown;
};

type StageAudit = {
  counts: Record<string, number>;
  products: Array<Record<string, unknown> & { slug: string; mediaCount: number }>;
  duplicateBindings: Array<{
    sourceCandidateSlug: string;
    productId: string;
  }>;
  resolvedProductPages: Array<{
    productSlug: string;
    sourceUrl: string;
    resolvedProductUrl: string;
  }>;
  [key: string]: unknown;
};

type MediaAsset = Readonly<{
  productSlug: string;
  sourcePageUrl: string;
  sourcePageSha256: string;
  sourceMediaUrl: string;
  localPath: string;
  alt: string;
  role: "hero" | "gallery";
  sha256: string;
  bytes: number;
  contentType: string;
  match: "source_product_gallery";
}>;

type MediaManifest = {
  schemaVersion: number;
  generatedAt: string;
  assets: MediaAsset[];
  [key: string]: unknown;
};

const ROOT = resolve(process.cwd());
const SNAPSHOT_PATH = resolve(ROOT, "data/import/endomarket-wave1-stage-catalog.json");
const AUDIT_PATH = resolve(ROOT, "data/import/endomarket-wave1-audit.json");
const MANIFEST_PATH = resolve(ROOT, "data/import/endomarket-wave1-media-manifest.json");
const MEDIA_AUDIT_V4_PATH = resolve(ROOT, "data/import/endomarket-media-audit-v4.json");
const MEDIA_ROOT = resolve(ROOT, "public/media/endomarket-wave1");
const CORRECTIVE_PATH = resolve(ROOT, "data/import/source/endomarket-business-content-corrective-v4.json");
const CSV_PATH = resolve(ROOT, "data/import/source/endomarket-name-media-audit-v4.csv");
const SPEC_PATH = resolve(ROOT, "data/import/source/cybermedica-endomarket-corrective-v4-business-spec.md");
const ROADMAP_PATH = resolve(ROOT, "data/import/source/cybermedica-launch-to-ads-roadmap-2026-08-08.md");
const CORRECTIVE_TIMESTAMP = "2026-08-08T00:00:00.000Z";

const EXPECTED_SOURCE_HASHES = Object.freeze({
  corrective: "d2e92c83e7102e83b4be141184d72ec38e55225b779b74391a5b35bfcee34412",
  csv: "ea1eb746e9d6d9678773e50b32e6cb39b91b6df3fb40a7e94712335e9df30d3e",
  spec: "3370b0423797089d4b8326c39eb94ad2ffa58d148deeb534f23b4fb57f63aff1",
  roadmap: "a41567e45251bfe1c32bf8c161cd8b0f0f19a66ad42ddff3c9674570a82cbd68",
});

const SOURCE_PAGE_OVERRIDES = Object.freeze<Record<string, string>>({
  "medinova-19-hd": "https://endomarket.ru/products/meditsinskij-monitor-medinova-19-hd",
  "medinova-24-full-hd": "https://endomarket.ru/products/meditsinskij-monitor-medinova-24-full-hd",
  "medinova-27-full-hd": "https://endomarket.ru/products/meditsinskij-monitor-medinova-27-full-hd",
  "medinova-55-4k": "https://endomarket.ru/products/meditsinskij-monitor-medinova-55-4k",
  "sonoscape-ec-430t": "https://endomarket.ru/products/videokolonoskop-sonoscape-es-430t",
  "zerts-1": "https://endomarket.ru/products/kushetka-elektromehanicheskaya-zerts",
  "pentax-epk-i5000": "https://endomarket.ru/products/videoprotsessor-pentax-epki5000",
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function parseCsv(value: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell.replace(/\r$/u, ""));
    rows.push(row);
  }
  assert(!quoted, "v4 CSV has an unterminated quoted field");
  return rows;
}

function validateCsv(corrective: Corrective, csvText: string) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/u, ""));
  const header = rows[0] ?? [];
  const expected = [
    "model",
    "canonical_name_v4",
    "source_category",
    "source_url",
    "source_media_status",
    "min_source_images_evidenced",
    "media_note",
    "final_application_tags",
  ];
  assert(JSON.stringify(header) === JSON.stringify(expected), "v4 media audit CSV header drift");
  assert(rows.length === 43, "v4 media audit CSV must contain exactly 42 Product rows");
  const byModel = new Map(corrective.products.map((product) => [product.model, product]));
  for (const columns of rows.slice(1)) {
    assert(columns.length === expected.length, `v4 CSV column drift for ${columns[0]}`);
    const product = byModel.get(columns[0]!);
    assert(product, `v4 CSV has an unknown Product model: ${columns[0]}`);
    assert(columns[1] === product.name, `v4 CSV canonical name drift: ${product.model}`);
    assert(columns[2] === product.source_category, `v4 CSV source category drift: ${product.model}`);
    assert(columns[3] === product.source_url, `v4 CSV source URL drift: ${product.model}`);
    assert(columns[4] === product.source_media_evidence.status, `v4 CSV media status drift: ${product.model}`);
    assert(
      columns[5] === (product.source_media_evidence.min_images?.toString() ?? ""),
      `v4 CSV minimum media drift: ${product.model}`,
    );
    assert(columns[6] === product.source_media_evidence.note, `v4 CSV media note drift: ${product.model}`);
    assert(
      columns[7] === product.application_areas.join(" | "),
      `v4 CSV application tags drift: ${product.model}`,
    );
  }
  assert(byModel.size === rows.length - 1, "v4 CSV Product coverage drift");
}

function characteristicGroups(product: CorrectiveProduct): StageProduct["characteristicGroups"] {
  return product.specifications.flatMap((group, groupIndex) => {
    const title = group.group.trim();
    const seen = new Set<string>();
    const items = group.items.flatMap((item, itemIndex) => {
      const label = item.name.trim();
      const value = item.value.trim();
      const unit = item.unit?.trim() || null;
      const key = `${label.toLocaleLowerCase("ru-RU")}|${value.toLocaleLowerCase("ru-RU")}|${unit ?? ""}`;
      if (!label || !value || seen.has(key)) return [];
      seen.add(key);
      return [{ label, value, unit, sortOrder: itemIndex }];
    });
    if (!title || items.length === 0) return [];
    return [{
      key: `source-${groupIndex + 1}`,
      title,
      sortOrder: groupIndex,
      items,
    }];
  });
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/gu, "&").replace(/&#x2F;|&#47;/giu, "/");
}

function isWatermarkedSource(url: string) {
  return /\.(?:1200x1200|420x400|250x250|105x85)w\./iu.test(new URL(url).pathname);
}

function isThumbnailSource(url: string) {
  return /\.(?:105x85|250x250)\./iu.test(new URL(url).pathname);
}

function sourceIdentity(url: string) {
  return basename(new URL(url).pathname).replace(/\.(?:1200x1200|420x400|250x250|105x85)w?(?=\.)/iu, "");
}

function sourceGalleryMedia(html: string) {
  const start = html.indexOf('<div class="slider slider-gallery-for">');
  const end = start === -1 ? -1 : html.indexOf('<div class="slider slider-gallery-nav">', start);
  assert(start >= 0 && end > start, "EndoMarket Product source has no primary gallery");
  const gallery = html.slice(start, end);
  const allUrls = [...gallery.matchAll(/(?:src|href)=["']([^"']+\/files\/products\/[^"']+)["']/giu)]
    .map((match) => new URL(decodeHtml(match[1]!), "https://endomarket.ru").toString());
  const rejectedWatermark = allUrls.filter(isWatermarkedSource);
  const cleanCandidates = allUrls.filter((url) => !isWatermarkedSource(url));
  const byIdentity = new Map<string, string[]>();
  for (const url of cleanCandidates) {
    const values = byIdentity.get(sourceIdentity(url)) ?? [];
    values.push(url);
    byIdentity.set(sourceIdentity(url), values);
  }
  const selected = [...byIdentity.values()].map((urls) =>
    [...new Set(urls)].sort((left, right) => Number(isThumbnailSource(left)) - Number(isThumbnailSource(right)))[0]!,
  );
  const rejectedVariants = cleanCandidates.length - selected.length;
  return { selected, rejectedWatermark, rejectedVariants };
}

async function fetchWithRetry(url: string) {
  let finalError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15 CyberMedica-Stage-Audit/4.0",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return response;
      finalError = new Error(`HTTP ${response.status}: ${url}`);
    } catch (error) {
      finalError = error;
    }
    if (attempt < 2) await new Promise((resolveDelay) => setTimeout(resolveDelay, 300 * (attempt + 1)));
  }
  throw finalError;
}

function imageExtension(contentType: string, url: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  const fromPath = extname(new URL(url).pathname).toLowerCase();
  return [".png", ".webp", ".gif", ".jpg", ".jpeg"].includes(fromPath) ? fromPath : ".jpg";
}

async function downloadSourceMedia(
  product: StageProduct,
  sourcePageUrl: string,
  sourcePageSha256: string,
  mediaUrls: readonly string[],
  cache: Map<string, Omit<MediaAsset, "productSlug" | "sourcePageUrl" | "sourcePageSha256" | "alt" | "role" | "match">>,
) {
  const assets: MediaAsset[] = [];
  const seenDigests = new Set<string>();
  let exactDuplicateRejects = 0;
  for (const sourceMediaUrl of mediaUrls) {
    let shared = cache.get(sourceMediaUrl);
    if (!shared) {
      const response = await fetchWithRetry(sourceMediaUrl);
      assert(new URL(response.url).hostname === "endomarket.ru", "EndoMarket media redirected off source host");
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      assert(contentType.startsWith("image/"), `EndoMarket media is not an image: ${sourceMediaUrl}`);
      const body = new Uint8Array(await response.arrayBuffer());
      assert(body.byteLength > 500 && body.byteLength <= 8 * 1024 * 1024, `Invalid EndoMarket media size: ${sourceMediaUrl}`);
      const digest = sha256(body);
      const fileName = `${digest.slice(0, 24)}${imageExtension(contentType, sourceMediaUrl)}`;
      const diskPath = resolve(MEDIA_ROOT, fileName);
      await mkdir(dirname(diskPath), { recursive: true });
      await writeFile(diskPath, body);
      shared = {
        sourceMediaUrl,
        localPath: `/media/endomarket-wave1/${fileName}`,
        sha256: digest,
        bytes: body.byteLength,
        contentType,
      };
      cache.set(sourceMediaUrl, shared);
    }
    if (seenDigests.has(shared.sha256)) {
      exactDuplicateRejects += 1;
      continue;
    }
    seenDigests.add(shared.sha256);
    const position = assets.length;
    assets.push({
      productSlug: product.slug,
      sourcePageUrl,
      sourcePageSha256,
      ...shared,
      alt: `${product.title}, изображение ${position + 1}`,
      role: position === 0 ? "hero" : "gallery",
      match: "source_product_gallery",
    });
  }
  return { assets, exactDuplicateRejects };
}

async function mapConcurrent<T, R>(values: readonly T[], limit: number, worker: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let next = 0;
  async function run() {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await worker(values[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return results;
}

async function main() {
  const [snapshotText, auditText, manifestText, correctiveText, csvText, specText, roadmapText] = await Promise.all([
    readFile(SNAPSHOT_PATH, "utf8"),
    readFile(AUDIT_PATH, "utf8"),
    readFile(MANIFEST_PATH, "utf8"),
    readFile(CORRECTIVE_PATH, "utf8"),
    readFile(CSV_PATH, "utf8"),
    readFile(SPEC_PATH, "utf8"),
    readFile(ROADMAP_PATH, "utf8"),
  ]);
  assert(sha256(correctiveText) === EXPECTED_SOURCE_HASHES.corrective, "v4 corrective source hash drift");
  assert(sha256(csvText) === EXPECTED_SOURCE_HASHES.csv, "v4 media audit CSV hash drift");
  assert(sha256(specText) === EXPECTED_SOURCE_HASHES.spec, "v4 business spec hash drift");
  assert(sha256(roadmapText) === EXPECTED_SOURCE_HASHES.roadmap, "v4 roadmap source hash drift");

  const snapshot = JSON.parse(snapshotText) as StageSnapshot;
  const audit = JSON.parse(auditText) as StageAudit;
  const manifest = JSON.parse(manifestText) as MediaManifest;
  const corrective = JSON.parse(correctiveText) as Corrective;
  assert(corrective.version === 4, "EndoMarket corrective version drift");
  assert(corrective.products.length === 42, "v4 corrective must contain exactly 42 Products");
  assert(new Set(corrective.products.map(({ candidate_slug }) => candidate_slug)).size === 42, "v4 Product slug collision");
  assert(new Set(corrective.products.map(({ model }) => model)).size === 42, "v4 Product model collision");
  validateCsv(corrective, csvText);

  const candidates = snapshot.products.filter(({ stageImport }) => stageImport.entityOrigin === "new_candidate");
  const bindings = snapshot.products.filter(({ stageImport }) => stageImport.entityOrigin === "existing_duplicate");
  assert(candidates.length === 42, "Stage draft candidate scope drift");
  assert(bindings.length === 9, "Stage binding scope drift");
  const candidatesBySlug = new Map(candidates.map((product) => [product.slug, product]));
  for (const correction of corrective.products) {
    const product = candidatesBySlug.get(correction.candidate_slug);
    assert(product, `v4 Product is missing from Stage: ${correction.candidate_slug}`);
    assert(product.model === correction.model, `v4 Product model drift: ${correction.candidate_slug}`);
    assert(correction.presentation.featureSectionTitle === "Ключевые особенности", `v4 feature section title drift: ${correction.model}`);
    assert(correction.presentation.hideCountryWhenMissing, `v4 country policy drift: ${correction.model}`);
    assert(!correction.presentation.catalogShowSpecifications, `v4 catalog specification policy drift: ${correction.model}`);
    assert(correction.presentation.productDetailShowAllApplicationTags, `v4 Product Detail tag policy drift: ${correction.model}`);
    assert(!correction.presentation.productDetailApplicationTagsOverflowCounter, `v4 Product Detail overflow policy drift: ${correction.model}`);
    assert(correction.presentation.manufacturerBlockPlacement === "last_content_block", `v4 manufacturer placement drift: ${correction.model}`);

    product.title = correction.name;
    product.model = correction.model;
    product.seoTitle = correction.seo_title;
    product.seoDescription = correction.seo_description;
    product.shortDescription = correction.short_description;
    product.description = correction.full_description;
    product.updatedAt = CORRECTIVE_TIMESTAMP;
    product.applicationAreas = correction.application_areas.map((name, index) => ({
      id: `${correction.candidate_slug}-area-${index + 1}`,
      name,
    }));
    product.keyFeatures = correction.presentation.showFeatureSection
      ? correction.key_features.map((text, sortOrder) => ({ text, sortOrder }))
      : [];
    product.characteristicGroups = characteristicGroups(correction);
  }

  const totalSpecifications = candidates.reduce(
    (total, product) => total + product.characteristicGroups.reduce((count, group) => count + group.items.length, 0),
    0,
  );
  const hiddenFeatureSections = candidates.filter(({ keyFeatures }) => keyFeatures.length === 0).length;
  assert(totalSpecifications === 128, `v4 source characteristic count drift: ${totalSpecifications}`);
  assert(hiddenFeatureSections === 10, `v4 hidden feature section count drift: ${hiddenFeatureSections}`);

  const resolvedBySlug = new Map(audit.resolvedProductPages.map((row) => [row.productSlug, row.resolvedProductUrl]));
  const bindingSlugByProductId = new Map(
    audit.duplicateBindings.map((binding) => [binding.productId, binding.sourceCandidateSlug]),
  );
  const pageUrlBySlug = new Map<string, string>();
  const sourceSlugByProductSlug = new Map<string, string>();
  for (const product of snapshot.products) {
    const sourceSlug = product.stageImport.entityOrigin === "existing_duplicate"
      ? bindingSlugByProductId.get(product.id)
      : product.slug;
    assert(sourceSlug, `No EndoMarket binding slug for Product: ${product.slug}`);
    const url = SOURCE_PAGE_OVERRIDES[sourceSlug] ?? resolvedBySlug.get(sourceSlug) ?? product.stageImport.sourceUrl;
    assert(url && new URL(url).pathname.startsWith("/products/"), `No exact EndoMarket Product source page: ${sourceSlug}`);
    pageUrlBySlug.set(product.slug, url);
    sourceSlugByProductSlug.set(product.slug, sourceSlug);
  }

  const uniquePageUrls = [...new Set(pageUrlBySlug.values())].sort();
  const pageResults = await mapConcurrent(uniquePageUrls, 4, async (url) => {
    const response = await fetchWithRetry(url);
    assert(new URL(response.url).hostname === "endomarket.ru", `Unexpected EndoMarket source redirect: ${url}`);
    const html = await response.text();
    assert(html.length > 1_000, `EndoMarket source response is unexpectedly empty: ${url}`);
    const gallery = sourceGalleryMedia(html);
    assert(gallery.selected.length > 0, `EndoMarket source gallery has no clean media: ${url}`);
    return { url, status: response.status, sha256: sha256(html), ...gallery };
  });
  const pagesByUrl = new Map(pageResults.map((page) => [page.url, page]));

  const downloadCache = new Map<string, Omit<MediaAsset, "productSlug" | "sourcePageUrl" | "sourcePageSha256" | "alt" | "role" | "match">>();
  const assets: MediaAsset[] = [];
  const productMediaAudit: Array<Record<string, unknown>> = [];
  let exactDuplicateRejects = 0;
  for (const product of snapshot.products) {
    const sourcePageUrl = pageUrlBySlug.get(product.slug)!;
    const page = pagesByUrl.get(sourcePageUrl)!;
    const result = await downloadSourceMedia(product, sourcePageUrl, page.sha256, page.selected, downloadCache);
    exactDuplicateRejects += result.exactDuplicateRejects;
    product.media = result.assets.map((asset) => ({
      url: asset.localPath,
      role: asset.role,
      format: asset.contentType,
      alt: asset.alt,
    }));
    assets.push(...result.assets);
    const correction = candidatesBySlug.has(product.slug)
      ? corrective.products.find(({ candidate_slug }) => candidate_slug === product.slug)
      : undefined;
    const expectedMinimum = correction?.media_source_requirements?.minimum_source_images_expected
      ?? correction?.source_media_evidence.min_images
      ?? null;
    if (expectedMinimum !== null) {
      assert(result.assets.length >= expectedMinimum, `${product.model} clean media below v4 evidence minimum: ${result.assets.length}/${expectedMinimum}`);
    }
    if (product.slug === "sonoscape-ec-430t") {
      assert(result.assets.length >= 3, "EC-430T must have at least three clean source images");
    }
    productMediaAudit.push({
      productSlug: product.slug,
      sourceBindingSlug: sourceSlugByProductSlug.get(product.slug),
      productId: product.id,
      sourceUid: product.sourceUid,
      model: product.model,
      entityOrigin: product.stageImport.entityOrigin,
      sourcePageUrl,
      sourcePageSha256: page.sha256,
      sourceGalleryCandidates: page.selected.length,
      cleanMediaCount: result.assets.length,
      expectedMinimum,
      watermarkVariantsRejected: page.rejectedWatermark.length,
      cleanVariantDuplicatesRejected: page.rejectedVariants,
      exactContentDuplicatesRejected: result.exactDuplicateRejects,
      hero: result.assets[0]?.localPath ?? null,
      fallback: false,
      status: "pass",
    });
  }

  const usedPaths = new Set(assets.map(({ localPath }) => localPath));
  const diskFiles = await readdir(MEDIA_ROOT);
  const removedFiles: string[] = [];
  for (const fileName of diskFiles) {
    const publicPath = `/media/endomarket-wave1/${fileName}`;
    if (usedPaths.has(publicPath)) continue;
    await rm(resolve(MEDIA_ROOT, fileName));
    removedFiles.push(publicPath);
  }

  const watermarkVariantsRejected = pageResults.reduce((sum, page) => sum + page.rejectedWatermark.length, 0);
  const cleanVariantDuplicatesRejected = pageResults.reduce((sum, page) => sum + page.rejectedVariants, 0);
  const uniqueMediaAssets = new Set(assets.map(({ sha256: digest }) => digest)).size;
  const draftMediaCount = candidates.reduce((total, product) => total + product.media.length, 0);
  const bindingMediaCount = bindings.reduce((total, product) => total + product.media.length, 0);
  assert(snapshot.products.every((product) => product.media[0]?.role === "hero"), "Every Stage Product must have clean hero media");
  assert(assets.every(({ sourceMediaUrl }) => !isWatermarkedSource(sourceMediaUrl)), "Watermarked source survived v4 media recovery");
  assert(assets.every(({ alt }) => alt.trim().length > 0), "Stage media alt text is missing");

  snapshot.generatedAt = CORRECTIVE_TIMESTAMP;
  snapshot.summary = {
    ...snapshot.summary,
    normalizedEquipmentRows: 51,
    newDraftCandidates: 42,
    existingDuplicateBindings: 9,
    mediaAssignments: assets.length,
    uniqueMediaAssets,
    sourceSpecifications: totalSpecifications,
    hiddenFeatureSections,
    watermarkVariantsRejected,
    duplicateMediaRejected: cleanVariantDuplicatesRejected + exactDuplicateRejects,
  };
  audit.generatedAt = CORRECTIVE_TIMESTAMP;
  audit.counts = snapshot.summary;
  audit.products = audit.products.map((row) => ({
    ...row,
    mediaCount: snapshot.products.find(({ slug }) => slug === row.slug)?.media.length ?? 0,
  }));
  audit.resolvedProductPages = audit.resolvedProductPages.map((row) => ({
    ...row,
    resolvedProductUrl: SOURCE_PAGE_OVERRIDES[row.productSlug] ?? row.resolvedProductUrl,
  }));
  audit.businessContentCorrective = {
    version: 4,
    productCount: 42,
    sourceSpecificationCount: totalSpecifications,
    hiddenFeatureSections,
    sourceFiles: [
      { fileName: basename(CORRECTIVE_PATH), sha256: EXPECTED_SOURCE_HASHES.corrective },
      { fileName: basename(CSV_PATH), sha256: EXPECTED_SOURCE_HASHES.csv },
      { fileName: basename(SPEC_PATH), sha256: EXPECTED_SOURCE_HASHES.spec },
      { fileName: basename(ROADMAP_PATH), sha256: EXPECTED_SOURCE_HASHES.roadmap },
    ],
    csvJsonConsistency: "pass",
    media: {
      sourcePagesVerified: uniquePageUrls.length,
      stageProductsVerified: 51,
      cleanAssignments: assets.length,
      cleanUniqueAssets: uniqueMediaAssets,
      productsSourceChecked: 51,
      productsWithCleanHero: snapshot.products.filter(({ media }) => media[0]?.role === "hero").length,
      productsWithGallery: snapshot.products.filter(({ media }) => media.length > 1).length,
      productsWithoutUsableCleanMedia: 0,
      draftAssignments: draftMediaCount,
      bindingAssignments: bindingMediaCount,
      watermarkVariantsRejected,
      cleanVariantDuplicatesRejected,
      exactContentDuplicatesRejected: exactDuplicateRejects,
      nearDuplicateRejected: 0,
      obsoleteLocalFilesRemoved: removedFiles.length,
      fallbacks: 0,
    },
  };
  manifest.generatedAt = CORRECTIVE_TIMESTAMP;
  manifest.assets = assets;
  manifest.businessContentCorrective = {
    version: 4,
    productCount: 42,
    stageProductCount: 51,
    watermarkVariantsRejected,
    duplicateMediaRejected: cleanVariantDuplicatesRejected + exactDuplicateRejects,
  };

  const mediaAudit = {
    schemaVersion: 1,
    generatedAt: CORRECTIVE_TIMESTAMP,
    source: {
      domain: "endomarket.ru",
      policy: "primary Product gallery img sources only; responsive source variants ending in w rejected as EM/EndoMarket watermarked",
    },
    counts: {
      products: 51,
      newDraftProducts: 42,
      existingBindings: 9,
      sourcePages: uniquePageUrls.length,
      cleanAssignments: assets.length,
      cleanUniqueAssets: uniqueMediaAssets,
      productsSourceChecked: 51,
      productsWithCleanHero: snapshot.products.filter(({ media }) => media[0]?.role === "hero").length,
      productsWithGallery: snapshot.products.filter(({ media }) => media.length > 1).length,
      productsWithoutUsableCleanMedia: 0,
      draftAssignments: draftMediaCount,
      bindingAssignments: bindingMediaCount,
      watermarkVariantsRejected,
      cleanVariantDuplicatesRejected,
      exactContentDuplicatesRejected: exactDuplicateRejects,
      nearDuplicateRejected: 0,
      obsoleteLocalFilesRemoved: removedFiles.length,
      fallbacks: 0,
    },
    requiredChecks: {
      ec430tMinimumCleanMedia: 3,
      ec430tActualCleanMedia: snapshot.products.find(({ slug }) => slug === "sonoscape-ec-430t")?.media.length ?? 0,
      allHeroesClean: true,
      watermarkRuntimeAssets: 0,
      genuinelyNoUsableCleanMediaProducts: [],
      fallbackProducts: [],
    },
    products: productMediaAudit,
    removedLocalFiles: removedFiles,
  };

  await Promise.all([
    writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`),
    writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`),
    writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(MEDIA_AUDIT_V4_PATH, `${JSON.stringify(mediaAudit, null, 2)}\n`),
  ]);

  console.info(JSON.stringify({
    event: "endomarket_corrective_v4_applied",
    productsCorrected: 42,
    sourceSpecifications: totalSpecifications,
    hiddenFeatureSections,
    sourcePagesVerified: uniquePageUrls.length,
    cleanMediaAssignments: assets.length,
    uniqueMediaAssets,
    watermarkVariantsRejected,
    duplicateMediaRejected: cleanVariantDuplicatesRejected + exactDuplicateRejects,
    obsoleteLocalFilesRemoved: removedFiles.length,
    ec430tMedia: snapshot.products.find(({ slug }) => slug === "sonoscape-ec-430t")?.media.length ?? 0,
  }));
}

await main();
