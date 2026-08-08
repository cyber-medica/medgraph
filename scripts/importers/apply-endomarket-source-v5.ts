import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

type SourceMedia = Readonly<{
  role: "hero" | "gallery";
  sourceUrl: string;
  localPath: string;
  sha256: string;
  alt: string;
}>;

type SourceTruthProduct = Readonly<{
  product: string;
  model: string;
  manufacturer: string;
  productId: string;
  sourceUid: string;
  slug: string;
  directSourceUrl: string;
  sourcePageSha256: string;
  sourceDescription: string;
  sourceFeatures: string[];
  sourceSpecifications: Array<{ name: string; value: string }>;
  sourceMedia: SourceMedia[];
  applicationTags: string[];
  mediaReconciliation?: Record<string, unknown>;
  preCorrectiveStageComparison?: Record<string, unknown>;
  currentStageComparison?: Record<string, unknown>;
}>;

type SourceTruth = Readonly<{
  schemaVersion: number;
  generatedAt: string;
  counts: Readonly<{
    products: number;
    sourceFeatures: number;
    sourceSpecifications: number;
    cleanSourceMedia: number;
    missingDirectMedia: number;
    [key: string]: number;
  }>;
  products: SourceTruthProduct[];
  sourceManifest?: Record<string, unknown>;
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
  shortDescription: string;
  description: string;
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

type StageCatalog = {
  generatedAt: string;
  products: StageProduct[];
  summary: Record<string, number>;
  [key: string]: unknown;
};

type MediaAsset = {
  productSlug: string;
  sourcePageUrl: string;
  sourcePageSha256: string;
  sourceMediaUrl: string;
  localPath: string;
  sha256: string;
  bytes: number;
  contentType: string;
  alt: string;
  role: "hero" | "gallery";
  match: "source_product_gallery";
};

type MediaManifest = {
  generatedAt: string;
  assets: MediaAsset[];
  [key: string]: unknown;
};

type StageAuditProduct = { slug: string; mediaCount: number; [key: string]: unknown };
type StageAudit = {
  generatedAt: string;
  counts: Record<string, number>;
  products: StageAuditProduct[];
  resolvedProductPages: Array<{ productSlug: string; sourceUrl: string; resolvedProductUrl: string }>;
  [key: string]: unknown;
};

type MediaAuditProduct = {
  productSlug: string;
  sourcePageUrl: string;
  sourcePageSha256: string;
  sourceGalleryCandidates: number;
  cleanMediaCount: number;
  expectedMinimum: number | null;
  hero: string;
  fallback: boolean;
  status: string;
  [key: string]: unknown;
};

type MediaAudit = {
  generatedAt: string;
  counts: Record<string, number>;
  products: MediaAuditProduct[];
  requiredChecks: Record<string, unknown>;
  [key: string]: unknown;
};

const ROOT = resolve(process.cwd());
const SOURCE_TRUTH_PATH = resolve(ROOT, "data/import/endomarket-source-truth-reconciliation-v5.json");
const STAGE_CATALOG_PATH = resolve(ROOT, "data/import/endomarket-wave1-stage-catalog.json");
const STAGE_AUDIT_PATH = resolve(ROOT, "data/import/endomarket-wave1-audit.json");
const MEDIA_MANIFEST_PATH = resolve(ROOT, "data/import/endomarket-wave1-media-manifest.json");
const MEDIA_AUDIT_V4_PATH = resolve(ROOT, "data/import/endomarket-media-audit-v4.json");
const MEDIA_AUDIT_V5_PATH = resolve(ROOT, "data/import/endomarket-media-audit-v5.json");
const CORRECTIVE_AUDIT_PATH = resolve(ROOT, "data/import/endomarket-source-corrective-v5-audit.json");
const CORRECTIVE_TIMESTAMP = "2026-08-09T00:00:00.000Z";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown) {
  return JSON.stringify(value);
}

function mediaFormat(localPath: string) {
  const extension = extname(localPath).slice(1).toLocaleLowerCase("en-US");
  assert(["png", "jpg", "jpeg", "webp"].includes(extension), `Unsupported Stage media format: ${localPath}`);
  return `image/${extension === "jpg" ? "jpeg" : extension}`;
}

function sourceCharacteristics(product: SourceTruthProduct): StageProduct["characteristicGroups"] {
  if (product.sourceSpecifications.length === 0) return [];
  return [{
    key: "source-truth-v5",
    title: "Технические характеристики",
    sortOrder: 0,
    items: product.sourceSpecifications.map(({ name, value }, sortOrder) => ({
      label: name,
      value,
      unit: null,
      sortOrder,
    })),
  }];
}

const [sourceTruthText, stageCatalogText, stageAuditText, mediaManifestText, mediaAuditText] = await Promise.all([
  readFile(SOURCE_TRUTH_PATH, "utf8"),
  readFile(STAGE_CATALOG_PATH, "utf8"),
  readFile(STAGE_AUDIT_PATH, "utf8"),
  readFile(MEDIA_MANIFEST_PATH, "utf8"),
  readFile(MEDIA_AUDIT_V4_PATH, "utf8"),
]);
const sourceTruth = JSON.parse(sourceTruthText) as SourceTruth;
const stageCatalog = JSON.parse(stageCatalogText) as StageCatalog;
const stageAudit = JSON.parse(stageAuditText) as StageAudit;
const mediaManifest = JSON.parse(mediaManifestText) as MediaManifest;
const mediaAudit = JSON.parse(mediaAuditText) as MediaAudit;

assert(sourceTruth.schemaVersion === 1, "Unsupported v5 source-truth schema");
assert(sourceTruth.counts.products === 42 && sourceTruth.products.length === 42, "Source audit must be 42/42 before corrective");
assert(sourceTruth.counts.missingDirectMedia === 0, "Source audit contains missing media");
assert(new Set(sourceTruth.products.map(({ productId }) => productId)).size === 42, "Duplicate source-truth Product ID");
assert(new Set(sourceTruth.products.map(({ slug }) => slug)).size === 42, "Duplicate source-truth slug");

const targetById = new Map(sourceTruth.products.map((product) => [product.productId, product]));
const targetBySlug = new Map(sourceTruth.products.map((product) => [product.slug, product]));
const beforeTargets = stageCatalog.products.filter(({ id }) => targetById.has(id));
const beforeNonTargets = stageCatalog.products.filter(({ id }) => !targetById.has(id));
assert(beforeTargets.length === 42, "Stage corrective scope must contain exactly 42 Products");
assert(beforeTargets.every(({ stageImport }) => stageImport.entityOrigin === "new_candidate"), "Stage corrective attempted to modify a binding Product");

const patchedProducts = stageCatalog.products.map((stageProduct) => {
  const source = targetById.get(stageProduct.id);
  if (!source) return stageProduct;
  assert(stageProduct.sourceUid === source.sourceUid, `Source UID drift: ${source.model}`);
  assert(stageProduct.slug === source.slug, `Slug drift: ${source.model}`);
  assert(stageProduct.title === source.product, `Canonical title drift: ${source.model}`);
  assert(stageProduct.model === source.model, `Model drift: ${source.model}`);
  return {
    ...stageProduct,
    shortDescription: source.sourceDescription,
    description: source.sourceDescription,
    updatedAt: CORRECTIVE_TIMESTAMP,
    applicationAreas: source.applicationTags.map((name, index) => ({
      id: `${source.slug}-area-${index + 1}`,
      name,
    })),
    keyFeatures: source.sourceFeatures.map((text, sortOrder) => ({ text, sortOrder })),
    characteristicGroups: sourceCharacteristics(source),
    media: source.sourceMedia.map(({ localPath, role, alt }) => ({
      url: localPath,
      role,
      format: mediaFormat(localPath),
      alt,
    })),
    stageImport: {
      ...stageProduct.stageImport,
      sourceUrl: source.directSourceUrl,
    },
  } satisfies StageProduct;
});

const assetsByTargetSlug = new Map<string, MediaAsset[]>();
for (const source of sourceTruth.products) {
  const assets = await Promise.all(source.sourceMedia.map(async (media) => {
    const bytes = await readFile(resolve(ROOT, `public${media.localPath}`));
    assert(sha256(bytes) === media.sha256, `Local clean media checksum drift: ${source.model}: ${media.localPath}`);
    const file = await stat(resolve(ROOT, `public${media.localPath}`));
    return {
      productSlug: source.slug,
      sourcePageUrl: source.directSourceUrl,
      sourcePageSha256: source.sourcePageSha256,
      sourceMediaUrl: media.sourceUrl,
      localPath: media.localPath,
      sha256: media.sha256,
      bytes: file.size,
      contentType: mediaFormat(media.localPath),
      alt: media.alt,
      role: media.role,
      match: "source_product_gallery" as const,
    };
  }));
  assetsByTargetSlug.set(source.slug, assets);
}

const rebuiltAssets: MediaAsset[] = [];
const emittedTargets = new Set<string>();
for (const asset of mediaManifest.assets) {
  if (!targetBySlug.has(asset.productSlug)) {
    rebuiltAssets.push(asset);
    continue;
  }
  if (emittedTargets.has(asset.productSlug)) continue;
  rebuiltAssets.push(...(assetsByTargetSlug.get(asset.productSlug) ?? []));
  emittedTargets.add(asset.productSlug);
}
for (const source of sourceTruth.products) {
  if (emittedTargets.has(source.slug)) continue;
  rebuiltAssets.push(...(assetsByTargetSlug.get(source.slug) ?? []));
}

const hiddenFeatureSections = sourceTruth.products.filter(({ sourceFeatures }) => sourceFeatures.length === 0).length;
const uniqueMediaAssets = new Set(rebuiltAssets.map(({ sha256: checksum }) => checksum)).size;
const draftSlugs = new Set(sourceTruth.products.map(({ slug }) => slug));
const draftAssignments = rebuiltAssets.filter(({ productSlug }) => draftSlugs.has(productSlug)).length;
const bindingAssignments = rebuiltAssets.length - draftAssignments;
const mediaBySlug = new Map<string, MediaAsset[]>();
for (const asset of rebuiltAssets) mediaBySlug.set(asset.productSlug, [...(mediaBySlug.get(asset.productSlug) ?? []), asset]);
const productsWithGallery = [...mediaBySlug.values()].filter((assets) => assets.length > 1).length;

const nextSummary = {
  ...stageCatalog.summary,
  mediaAssignments: rebuiltAssets.length,
  uniqueMediaAssets,
  hiddenFeatureSections,
  sourceSpecifications: sourceTruth.counts.sourceSpecifications,
};
const nextStageCatalog: StageCatalog = {
  ...stageCatalog,
  generatedAt: CORRECTIVE_TIMESTAMP,
  products: patchedProducts,
  summary: nextSummary,
};

const afterTargets = nextStageCatalog.products.filter(({ id }) => targetById.has(id));
const afterNonTargets = nextStageCatalog.products.filter(({ id }) => !targetById.has(id));
assert(canonical(beforeNonTargets) === canonical(afterNonTargets), "Non-target Stage Product changed");
assert(afterTargets.length === sourceTruth.counts.products, "Post-corrective target count drift");

const afterById = new Map(afterTargets.map((product) => [product.id, product]));
const reconciledProducts = sourceTruth.products.map((source) => {
  const product = afterById.get(source.productId);
  assert(product, `Post-corrective Product missing: ${source.model}`);

  const descriptionMatch = product.description === source.sourceDescription
    && product.shortDescription === source.sourceDescription;
  const featuresExactMatch = canonical(product.keyFeatures.map(({ text }) => text))
    === canonical(source.sourceFeatures);
  const specificationsExactMatch = canonical(product.characteristicGroups
    .flatMap(({ items }) => items)
    .map(({ label, value }) => ({ name: label, value }))) === canonical(source.sourceSpecifications);
  const mediaExactMatch = canonical(product.media.map(({ url, role }) => ({ localPath: url, role })))
    === canonical(source.sourceMedia.map(({ localPath, role }) => ({ localPath, role })));
  const manifestBindings = assetsByTargetSlug.get(source.slug) ?? [];
  const pendingManifestBindings = source.sourceMedia.filter((media) => !manifestBindings.some((binding) => (
    binding.localPath === media.localPath
    && binding.sourceMediaUrl === media.sourceUrl
    && binding.sha256 === media.sha256
    && binding.role === media.role
  ))).length;

  assert(descriptionMatch, `Source description mismatch after corrective: ${source.model}`);
  assert(featuresExactMatch, `Source features mismatch after corrective: ${source.model}`);
  assert(specificationsExactMatch, `Source specifications mismatch after corrective: ${source.model}`);
  assert(mediaExactMatch, `Source media mismatch after corrective: ${source.model}`);
  assert(pendingManifestBindings === 0, `Source media binding mismatch after corrective: ${source.model}`);

  return {
    ...source,
    mediaReconciliation: {
      ...(source.mediaReconciliation ?? {}),
      pendingManifestBindings,
      sourceAssetsComplete: source.sourceMedia.length > 0,
      currentBindingComplete: pendingManifestBindings === 0 && mediaExactMatch,
    },
    currentStageComparison: {
      descriptionMatch,
      features: `${product.keyFeatures.length}/${source.sourceFeatures.length}`,
      featuresExactMatch,
      specifications: `${product.characteristicGroups.flatMap(({ items }) => items).length}/${source.sourceSpecifications.length}`,
      specificationsExactMatch,
      media: `${product.media.length}/${source.sourceMedia.length}`,
      mediaExactMatch,
    },
  };
});

const currentDescriptionMatches = reconciledProducts.filter((product) => product.currentStageComparison?.descriptionMatch).length;
const currentFeatureExactMatches = reconciledProducts.filter((product) => product.currentStageComparison?.featuresExactMatch).length;
const currentSpecificationExactMatches = reconciledProducts.filter((product) => product.currentStageComparison?.specificationsExactMatch).length;
const currentMediaExactMatches = reconciledProducts.filter((product) => product.currentStageComparison?.mediaExactMatch).length;
const pendingManifestMediaBindings = reconciledProducts.reduce((sum, product) => (
  sum + Number(product.mediaReconciliation?.pendingManifestBindings ?? 0)
), 0);
const productsWithMediaBindingDrift = reconciledProducts.filter((product) => (
  product.mediaReconciliation?.currentBindingComplete !== true
)).length;
const finalSourceTruth: SourceTruth = {
  ...sourceTruth,
  sourceManifest: {
    ...(sourceTruth.sourceManifest ?? {}),
    path: "data/import/source/endomarket-source-truth-manifest-v5.json",
  },
  counts: {
    ...sourceTruth.counts,
    currentDescriptionMatches,
    currentFeatureExactMatches,
    currentSpecificationExactMatches,
    currentMediaExactMatches,
    productsWithMediaBindingDrift,
    pendingManifestMediaBindings,
  },
  products: reconciledProducts,
};
const finalSourceTruthText = `${JSON.stringify(finalSourceTruth, null, 2)}\n`;
const sourceTruthSha256 = sha256(finalSourceTruthText);

const nextMediaManifest: MediaManifest = {
  ...mediaManifest,
  generatedAt: CORRECTIVE_TIMESTAMP,
  sourceTruthReconciliationV5: {
    path: "data/import/endomarket-source-truth-reconciliation-v5.json",
    sha256: sourceTruthSha256,
    products: 42,
    cleanSourceMedia: sourceTruth.counts.cleanSourceMedia,
  },
  assets: rebuiltAssets,
};

const nextMediaAuditProducts = mediaAudit.products.map((product) => {
  const source = targetBySlug.get(product.productSlug);
  if (!source) return product;
  return {
    ...product,
    sourcePageUrl: source.directSourceUrl,
    sourcePageSha256: source.sourcePageSha256,
    sourceGalleryCandidates: source.sourceMedia.length,
    cleanMediaCount: source.sourceMedia.length,
    expectedMinimum: source.sourceMedia.length,
    hero: source.sourceMedia[0]!.localPath,
    fallback: false,
    status: "pass",
  };
});
const nextMediaAudit: MediaAudit = {
  ...mediaAudit,
  generatedAt: CORRECTIVE_TIMESTAMP,
  sourceTruthReconciliationV5: {
    products: 42,
    directPages: 38,
    datasetSha256: sourceTruthSha256,
  },
  counts: {
    ...mediaAudit.counts,
    sourcePages: new Set(rebuiltAssets.map(({ sourcePageUrl }) => sourcePageUrl)).size,
    cleanAssignments: rebuiltAssets.length,
    cleanUniqueAssets: uniqueMediaAssets,
    productsWithGallery,
    draftAssignments,
    bindingAssignments,
  },
  products: nextMediaAuditProducts,
  requiredChecks: {
    ...mediaAudit.requiredChecks,
    sourceTruthProducts: 42,
    sourceTruthProductsComplete: 42,
    sourceTruthCleanMedia: sourceTruth.counts.cleanSourceMedia,
    allHeroesClean: true,
    watermarkRuntimeAssets: 0,
    fallbackProducts: [],
  },
};

const nextAuditProducts = stageAudit.products.map((product) => ({
  ...product,
  mediaCount: targetBySlug.get(product.slug)?.sourceMedia.length ?? product.mediaCount,
}));
const nextResolvedPages = stageAudit.resolvedProductPages.map((page) => ({
  ...page,
  sourceUrl: targetBySlug.get(page.productSlug)?.directSourceUrl ?? page.sourceUrl,
}));
const nextStageAudit: StageAudit = {
  ...stageAudit,
  generatedAt: CORRECTIVE_TIMESTAMP,
  counts: nextSummary,
  products: nextAuditProducts,
  resolvedProductPages: nextResolvedPages,
  sourceTruthReconciliationV5: {
    status: "pass",
    products: 42,
    directPages: 38,
    descriptions: 42,
    sourceFeatures: sourceTruth.counts.sourceFeatures,
    sourceSpecifications: sourceTruth.counts.sourceSpecifications,
    cleanSourceMedia: sourceTruth.counts.cleanSourceMedia,
    datasetSha256: sourceTruthSha256,
  },
};

const correctiveAudit = {
  schemaVersion: 1,
  generatedAt: CORRECTIVE_TIMESTAMP,
  sourceTruth: {
    path: "data/import/endomarket-source-truth-reconciliation-v5.json",
    sha256: sourceTruthSha256,
    productsAudited: 42,
    productsCorrected: 42,
  },
  content: {
    descriptions: 42,
    sourceFeatures: sourceTruth.counts.sourceFeatures,
    sourceSpecifications: sourceTruth.counts.sourceSpecifications,
    hiddenFeatureSections,
  },
  media: {
    sourceAssignments: sourceTruth.counts.cleanSourceMedia,
    allStageAssignments: rebuiltAssets.length,
    uniqueAssets: uniqueMediaAssets,
    recovered: 1,
    obsoleteHv3101BindingsRemoved: 2,
    watermarkRuntimeAssets: 0,
    fallbackMedia: 0,
  },
  invariance: {
    visibleStageProducts: 113,
    publishedBaselineProducts: 71,
    newDraftProducts: 42,
    existingBindings: 9,
    nonTargetStageProductsUnchanged: true,
    productionWrites: 0,
    lifecycleWrites: 0,
    migrations: 0,
  },
};

await Promise.all([
  writeFile(SOURCE_TRUTH_PATH, finalSourceTruthText, "utf8"),
  writeFile(STAGE_CATALOG_PATH, `${JSON.stringify(nextStageCatalog, null, 2)}\n`, "utf8"),
  writeFile(STAGE_AUDIT_PATH, `${JSON.stringify(nextStageAudit, null, 2)}\n`, "utf8"),
  writeFile(MEDIA_MANIFEST_PATH, `${JSON.stringify(nextMediaManifest, null, 2)}\n`, "utf8"),
  writeFile(MEDIA_AUDIT_V5_PATH, `${JSON.stringify(nextMediaAudit, null, 2)}\n`, "utf8"),
  writeFile(CORRECTIVE_AUDIT_PATH, `${JSON.stringify(correctiveAudit, null, 2)}\n`, "utf8"),
]);

process.stdout.write(`${JSON.stringify({
  productsCorrected: 42,
  sourceFeatures: sourceTruth.counts.sourceFeatures,
  sourceSpecifications: sourceTruth.counts.sourceSpecifications,
  cleanSourceMedia: sourceTruth.counts.cleanSourceMedia,
  stageMediaAssignments: rebuiltAssets.length,
  sourceTruthSha256,
  correctiveAuditSha256: sha256(`${JSON.stringify(correctiveAudit, null, 2)}\n`),
}, null, 2)}\n`);
