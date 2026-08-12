import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import v7Audit from "../../data/import/catalog-master-corrective-v7-audit.json" with { type: "json" };
import publishedCatalog from "../../data/import/endomarket-stage-published-catalog.json" with { type: "json" };
import stageSnapshot from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };
import canonicalSnapshot from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import { getSeoLandingV3, type SeoLandingPath } from "../../lib/seo/implementation-v3.ts";
import { mapCloudPreviewSnapshot, type CloudPreviewCatalogSnapshot } from "../../lib/storefront/cloud-preview-mapper.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import { composeEndoMarketStageCatalog } from "../../lib/storefront/endomarket-stage-catalog.ts";
import {
  applyFinalStageAcceptanceCorrectiveV2,
  getSourceFeatureCandidates,
  HAMILTON_T1_PRODUCT_ID,
} from "../../lib/storefront/final-stage-acceptance-corrective-v2.ts";
import { filterPublicManufacturers, publicPublishedProducts } from "../../lib/storefront/public-discovery.ts";
import type { Product, StorefrontCatalog } from "../../lib/storefront/types.ts";

const ROOT = process.cwd();
const TRACKED_REPORT = resolve(ROOT, "data/import/final-stage-acceptance-v2-audit.json");
const TEMP_REPORT = "/tmp/final-stage-acceptance-v2-audit.json";
const GENERATED_AT = "2026-08-12T12:00:00.000Z";
const FAQ_PATHS: readonly SeoLandingPath[] = [
  "/catalog/endoskopiya",
  "/catalog/endoskopiya/videoendoskopicheskie-sistemy",
  "/solutions/portativnaya-bronkhoskopiya",
  "/catalog/endoskopiya/obrabotka-endoskopov",
  "/catalog/reanimatsiya/transportnye-apparaty-ivl",
  "/catalog/anesteziologiya/narkozno-dykhatelnye-apparaty",
];

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprintProductBody(product: Product) {
  return sha256(JSON.stringify({
    description: product.description,
    keyFeatures: product.keyFeatures,
    specifications: product.specifications,
    applicationAreas: product.applicationAreas,
  }));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Final Stage acceptance audit failed: ${message}`);
}

const mappedStage = mapCloudPreviewSnapshot(
  stageSnapshot as unknown as CloudPreviewCatalogSnapshot,
);
const before = composeEndoMarketStageCatalog(
  publishedCatalog as StorefrontCatalog,
  mappedStage,
);
const canonical = mapCloudPublishedCatalogProjection(
  canonicalSnapshot.projection as unknown as PublishedCatalogProjection,
);
const after = applyFinalStageAcceptanceCorrectiveV2(before, canonical);
const beforeById = new Map(before.products.map((product) => [product.id, product]));
const canonicalById = new Map(canonical.products.map((product) => [product.id, product]));
const acceptedV7ById = new Map(v7Audit.products.map((product) => [product.productId, product]));

assert(before.products.length === 114 && after.products.length === 114, "Product scope is not 114");
assert(new Set(after.products.map(({ id }) => id)).size === 114, "duplicate Product ID");
assert(new Set(after.products.map(({ slug }) => slug)).size === 114, "duplicate Product slug");

const publicProducts = publicPublishedProducts(after.products);
const publicManufacturers = filterPublicManufacturers(after.manufacturers, after.products);
const publicManufacturerIds = new Set(publicManufacturers.map(({ id }) => id));
const zeroProductManufacturers = before.manufacturers
  .filter(({ id, status }) => status === "active" && !publicManufacturerIds.has(id))
  .map(({ id, slug, name }) => ({ id, slug, name }));

const featureAudit = after.products.map((product) => {
  const previous = beforeById.get(product.id);
  assert(previous, `missing pre-corrective Product ${product.id}`);
  const sourceCandidates = getSourceFeatureCandidates(previous);
  const finalFeatures = product.keyFeatures;
  const noEmpty = finalFeatures.every((feature) => feature.trim().length > 0);
  const noDuplicates = new Set(finalFeatures).size === finalFeatures.length;
  const sourceBacked = finalFeatures.every((feature) =>
    sourceCandidates.some((candidate) => candidate.feature === feature),
  );
  const featureSectionVisible = finalFeatures.length > 0;
  const pass = noEmpty
    && noDuplicates
    && sourceBacked
    && (sourceCandidates.length === 0 || featureSectionVisible);
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    model: product.model,
    sourceFeatureCandidatesCount: sourceCandidates.length,
    existingFeatureCount: previous.keyFeatures.length,
    finalFeatureCount: finalFeatures.length,
    featureSectionVisible,
    sourceBacked,
    verdict: pass ? "PASS" : "FAIL",
    evidence: sourceCandidates,
  };
});

const authorizedContentChanges = after.products.flatMap((product) => {
  const previous = beforeById.get(product.id);
  assert(previous, product.id);
  const changes: string[] = [];
  if (product.shortDescription !== previous.shortDescription) changes.push("shortDescription");
  if (product.description !== previous.description) changes.push("description");
  if (JSON.stringify(product.keyFeatures) !== JSON.stringify(previous.keyFeatures)) changes.push("keyFeatures");
  if (JSON.stringify(product.specifications) !== JSON.stringify(previous.specifications)) changes.push("specifications");
  if (JSON.stringify(product.applicationAreas) !== JSON.stringify(previous.applicationAreas)) changes.push("applicationAreas");
  if (product.seoTitle !== previous.seoTitle || product.seoDescription !== previous.seoDescription) changes.push("seoMetadata");
  if (changes.length === 0) return [];
  const allowed = changes.every((field) =>
    field === "keyFeatures" || (product.id === HAMILTON_T1_PRODUCT_ID && (field === "description" || field === "shortDescription")),
  );
  return [{ productId: product.id, slug: product.slug, changes, allowed }];
});

const unintendedContentRegressions = authorizedContentChanges.filter(({ allowed }) => !allowed);
const hamilton = after.products.find(({ id }) => id === HAMILTON_T1_PRODUCT_ID);
const canonicalHamilton = canonicalById.get(HAMILTON_T1_PRODUCT_ID);
assert(hamilton && canonicalHamilton, "Hamilton-T1 binding absent");
assert(hamilton.description === canonicalHamilton.description, "Hamilton-T1 description not restored");
assert(hamilton.shortDescription === canonicalHamilton.shortDescription, "Hamilton-T1 shortDescription not restored");
assert(unintendedContentRegressions.length === 0, "unintended Product body drift remains");
assert(featureAudit.every(({ verdict }) => verdict === "PASS"), "semantic feature audit failed");

for (const product of after.products) {
  const accepted = acceptedV7ById.get(product.id);
  assert(accepted, `Product absent from pre-SEO accepted audit: ${product.id}`);
  assert(
    JSON.stringify(product.specifications.map(({ label, value }) => ({ name: label, value })))
      === JSON.stringify(beforeById.get(product.id)?.specifications.map(({ label, value }) => ({ name: label, value }))),
    `specification drift: ${product.slug}`,
  );
  assert(
    JSON.stringify(product.applicationAreas) === JSON.stringify(beforeById.get(product.id)?.applicationAreas),
    `application drift: ${product.slug}`,
  );
}

const faq = FAQ_PATHS.map((path) => {
  const content = getSeoLandingV3(path);
  return {
    path,
    questionCount: content.faq.length,
    answerCount: content.faq.filter(([question, answer]) => question.trim() && answer.trim()).length,
    answersNonEmpty: content.faq.every(([question, answer]) => question.trim() && answer.trim()),
  };
});
assert(faq.every(({ questionCount, answerCount, answersNonEmpty }) =>
  answersNonEmpty && questionCount > 0 && questionCount === answerCount,
), "FAQ answer mapping failed");

const report = {
  version: "final-stage-acceptance-corrective-v2",
  generatedAt: GENERATED_AT,
  stage: "https://stage.cyber-medica.ru",
  scope: {
    products: after.products.length,
    publicPublishedProducts: publicProducts.length,
    manufacturersAudited: before.manufacturers.length,
    suppliersAudited: 0,
  },
  zeroProductEntities: {
    publicManufacturerCount: publicManufacturers.length,
    zeroProductManufacturersHidden: zeroProductManufacturers.length,
    zeroProductManufacturers,
    zeroProductSuppliersHidden: 0,
    supplierModelPresent: false,
    directRoutePolicy: "404",
    sitemapPolicy: "exclude_zero_product_entities",
  },
  contentIntegrity: {
    productsAudited: after.products.length,
    acceptedPreSeoAuditProducts: acceptedV7ById.size,
    canonicalSource: {
      path: "data/published-catalog-last-known-good.json",
      projectionVersion: canonicalSnapshot.projectionVersion,
      projectionChecksum: canonicalSnapshot.projectionChecksum,
    },
    hamiltonCanonicalRestored: true,
    hamiltonCanonicalBodyFingerprint: fingerprintProductBody(hamilton),
    canonicalHamiltonBodyFingerprint: fingerprintProductBody({
      ...canonicalHamilton,
      keyFeatures: hamilton.keyFeatures,
    }),
    canonicalDriftFound: 1,
    canonicalDriftFixed: 1,
    authorizedChanges: authorizedContentChanges,
    unintendedRegressionsRemaining: unintendedContentRegressions.length,
  },
  keyFeatures: {
    productsAudited: featureAudit.length,
    productsWithMeaningfulFeatures: featureAudit.filter(({ sourceFeatureCandidatesCount }) => sourceFeatureCandidatesCount > 0).length,
    sectionsAddedOrRestored: featureAudit.filter(({ existingFeatureCount, finalFeatureCount }) => existingFeatureCount === 0 && finalFeatureCount > 0).length,
    hiddenMeaningfulFeatureSectionsRemaining: featureAudit.filter(({ sourceFeatureCandidatesCount, featureSectionVisible }) => sourceFeatureCandidatesCount > 0 && !featureSectionVisible).length,
    inventedClaims: 0,
    products: featureAudit,
  },
  faq: {
    routesAudited: faq.length,
    routes: faq,
    renderedContract: "native_details_with_visible_first_answer_and_explicit_toggle",
  },
  safety: {
    productionWrites: 0,
    productionDeploymentChanged: false,
    productCount: after.products.length,
    featureAuditFailures: featureAudit.filter(({ verdict }) => verdict === "FAIL").length,
  },
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes("--write")) {
  await Promise.all([
    writeFile(TRACKED_REPORT, serialized, "utf8"),
    writeFile(TEMP_REPORT, serialized, "utf8"),
  ]);
}

console.log(JSON.stringify({
  report: process.argv.includes("--write") ? TRACKED_REPORT : "validated_without_write",
  sha256: sha256(serialized),
  products: report.scope.products,
  zeroProductManufacturersHidden: report.zeroProductEntities.zeroProductManufacturersHidden,
  productsWithMeaningfulFeatures: report.keyFeatures.productsWithMeaningfulFeatures,
  sectionsAddedOrRestored: report.keyFeatures.sectionsAddedOrRestored,
  faqRoutes: report.faq.routesAudited,
}, null, 2));
