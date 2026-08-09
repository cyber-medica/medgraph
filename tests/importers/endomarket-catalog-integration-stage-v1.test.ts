import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import snapshotJson from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };
import auditJson from "../../data/import/endomarket-wave1-audit.json" with { type: "json" };
import mediaManifestJson from "../../data/import/endomarket-wave1-media-manifest.json" with { type: "json" };
import {
  mapCloudPreviewSnapshot,
  type CloudPreviewCatalogSnapshot,
} from "../../lib/storefront/cloud-preview-mapper.ts";
import {
  ENDOMARKET_STAGE_PREVIEW_BRANCH,
  getStorefrontDataSource,
  isEndoMarketStagePreview,
} from "../../lib/storefront/data-source.ts";
import { validateStorefrontCatalog } from "../../lib/storefront/schemas.ts";

async function source(path: string) {
  return readFile(path, "utf8");
}

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

test("EndoMarket input scope is exact and exclusions never become Product rows", () => {
  const snapshot = snapshotJson;
  assert.equal(snapshot.products.length, 51);
  assert.equal(snapshot.summary.newDraftCandidates, 43);
  assert.equal(snapshot.summary.existingDuplicateBindings, 8);
  assert.equal(snapshot.summary.excludedInstrumentRows, 76);
  assert.equal(snapshot.summary.excludedNonEquipmentConsumables, 3);
  assert.equal(new Set(snapshot.products.map(({ id }) => id)).size, 51);
  assert.equal(new Set(snapshot.products.map(({ slug }) => slug)).size, 51);
  assert.equal(
    snapshot.products.filter(({ stageImport }) => stageImport.entityOrigin === "new_candidate").length,
    43,
  );
  assert.equal(
    snapshot.products.filter(({ stageImport }) => stageImport.entityOrigin === "existing_duplicate").length,
    8,
  );
  const publicNames = snapshot.products.map(({ title, model }) => `${title} ${model}`).join("\n");
  assert.doesNotMatch(publicNames, /дезинфицирующее средство|щипцы|катетер|петл[яи]|биопси/iu);
  assert.equal(auditJson.safety.productionCredentialsUsed, false);
  assert.equal(auditJson.safety.productionWrites, 0);
  assert.equal(auditJson.safety.lifecycleWrites, 0);
  assert.equal(auditJson.safety.migrations, 0);
});

test("eight duplicates bind to existing entities while HD-550 is restored as one Stage-only draft", () => {
  assert.equal(auditJson.duplicateBindings.length, 9);
  assert.equal(auditJson.duplicateBindings.every(({ candidateCreated }) => !candidateCreated), true);
  assert.equal(auditJson.duplicateBindings.every(({ commercialMetadataMerged }) => commercialMetadataMerged), true);
  const duplicateRows = snapshotJson.products.filter(
    ({ stageImport }) => stageImport.entityOrigin === "existing_duplicate",
  );
  assert.equal(duplicateRows.every(({ published }) => published), true);
  assert.equal(duplicateRows.every(({ publicationStatus }) => publicationStatus === "published"), true);
  assert.equal(snapshotJson.products.filter(({ publicationStatus }) => publicationStatus === "draft").length, 43);
  const hd550 = snapshotJson.products.find(({ model }) => model === "HD-550");
  assert.ok(hd550);
  assert.equal(hd550.stageImport.entityOrigin, "new_candidate");
  assert.equal(hd550.published, false);

  const bySourceSlug = new Map(
    auditJson.duplicateBindings.map((binding) => [binding.sourceCandidateSlug, binding]),
  );
  assert.equal(bySourceSlug.get("olympus-exera-iii")?.canonicalModel, "CV-190");
  assert.equal(bySourceSlug.get("olympus-optera")?.canonicalModel, "CV-170");
  assert.equal(bySourceSlug.get("pentax-epk-i7010-optivista")?.productId, "860306a1-e01e-4f10-b980-93490e446d37");
});

test("commercial presentation is data-driven and exact", () => {
  for (const product of snapshotJson.products) {
    assert.deepEqual(product.commercialPresentation, {
      source: "endomarket",
      availabilityStatus: "in_stock",
      availabilityLabel: "В наличии",
      installmentEnabled: true,
      installmentLabel: "Рассрочка 0%",
      installmentTermMonths: 12,
      installmentDescription: "До 12 месяцев без удорожания",
    });
  }
});

test("Stage snapshot uses the existing Cloud Preview mapping and preserves status", () => {
  const mapped = mapCloudPreviewSnapshot(snapshotJson as unknown as CloudPreviewCatalogSnapshot);
  const validated = validateStorefrontCatalog(mapped);
  assert.equal(validated.products.length, 51);
  assert.equal(validated.products.filter(({ status }) => status === "preview_draft").length, 43);
  assert.equal(validated.products.filter(({ status }) => status === "active").length, 8);
  assert.equal(validated.summary.activeProductCount, 8);
  assert.equal(validated.products.every(({ commercialPresentation }) => commercialPresentation?.source === "endomarket"), true);
  assert.equal(
    validated.products
      .filter(({ status }) => status === "preview_draft")
      .reduce((total, { specifications }) => total + specifications.length, 0),
    294,
  );
  assert.equal(validated.products.every(({ seoTitle, seoDescription }) => Boolean(seoTitle && seoDescription)), true);
});

test("EndoMarket Stage source is exact-branch Preview-only and fails closed in Production", () => {
  const previewEnvironment = {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: ENDOMARKET_STAGE_PREVIEW_BRANCH,
    CATALOG_DATA_SOURCE: "cloud_published",
  };
  assert.equal(isEndoMarketStagePreview(previewEnvironment), true);
  assert.equal(getStorefrontDataSource(previewEnvironment), "cloud_preview");
  assert.equal(isEndoMarketStagePreview({
    ...previewEnvironment,
    VERCEL_ENV: "production",
  }), false);
  assert.equal(getStorefrontDataSource({
    ...previewEnvironment,
    VERCEL_ENV: "production",
  }), "cloud_published");
  assert.equal(isEndoMarketStagePreview({ CYBERMEDICA_ENDOMARKET_STAGE: "1" }), true);
});

test("media manifest is local, checksummed and content-deduplicated", async () => {
  assert.equal(mediaManifestJson.assets.length, snapshotJson.summary.mediaAssignments);
  const uniquePaths = new Set(mediaManifestJson.assets.map(({ localPath }) => localPath));
  assert.equal(uniquePaths.size, snapshotJson.summary.uniqueMediaAssets);
  for (const asset of mediaManifestJson.assets) {
    assert.match(asset.localPath, /^\/media\/endomarket-wave1\/[a-f0-9]{24}\.(?:png|webp|gif|jpe?g)$/u);
    assert.match(asset.sourceMediaUrl, /^https:\/\/endomarket\.ru\/files\/products\//u);
    const body = await readFile(`public${asset.localPath}`);
    assert.equal(sha256(body), asset.sha256);
    assert.equal(body.byteLength, asset.bytes);
  }
  assert.equal(snapshotJson.products.filter(({ media }) => media.length === 0).length, 0);
});

test("canonical UI renders EndoMarket badges without hardcoded product slugs", async () => {
  const [card, detail, carousel, badges, why] = await Promise.all([
    source("components/storefront/ProductCard.tsx"),
    source("app/catalog/[slug]/page.tsx"),
    source("components/home/FeaturedProductsCarousel.tsx"),
    source("components/storefront/ProductCommercialBadges.tsx"),
    source("components/home/WhyCyberMedica.tsx"),
  ]);
  assert.match(card, /product\.commercialPresentation/u);
  assert.match(detail, /product\.commercialPresentation/u);
  assert.match(carousel, /commercialPresentation/u);
  assert.match(badges, /В наличии|availabilityLabel/u);
  assert.match(badges, /Рассрочка 0%|installmentLabel/u);
  assert.doesNotMatch(`${card}\n${detail}\n${carousel}\n${badges}`, /medinova-|sonoscape-|olympus-|pentax-/u);
  assert.match(why, /Сервис и сопровождение оборудования/u);
  assert.match(why, /Гарантийное и постгарантийное обслуживание через сеть профильных сервисных партнеров\./u);
});

test("Stage adapter remains read-only and does not add a parallel public API", async () => {
  const [repository, factory, importer] = await Promise.all([
    source("lib/storefront/cloud-preview-catalog-repository.ts"),
    source("lib/storefront/catalog-repository-factory.server.ts"),
    source("scripts/importers/endomarket-stage-catalog.ts"),
  ]);
  assert.match(repository, /endomarket-wave1-stage-catalog\.json/u);
  assert.match(repository, /isEndoMarketStagePreview/u);
  assert.match(factory, /CloudPreviewCatalogRepository/u);
  assert.doesNotMatch(repository, /PATCH|INSERT|UPDATE|DELETE/iu);
  assert.doesNotMatch(
    importer,
    /SUPABASE|service_role|cloud_api|create_product_publication_revision|approve_product|publish_product/iu,
  );
});
