import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import audit from "../../data/import/catalog-master-corrective-v7-audit.json" with { type: "json" };
import published from "../../data/import/endomarket-stage-published-catalog.json" with { type: "json" };
import sourceTruth from "../../data/import/endomarket-source-truth-reconciliation-v5.json" with { type: "json" };
import stage from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };
import { mapCloudPreviewSnapshot, type CloudPreviewCatalogSnapshot } from "../../lib/storefront/cloud-preview-mapper.ts";
import { composeEndoMarketStageCatalog } from "../../lib/storefront/endomarket-stage-catalog.ts";
import type { StorefrontCatalog } from "../../lib/storefront/types.ts";

const INVALID_DESCRIPTION = /^\s*$|^\$\d+$|\b(?:undefined|null)\b|Карточка интегрирована в каталог CyberMedica|с коммерческими условиями|внутренн(?:ий|яя) импорт|debug/iu;
const FORBIDDEN_APPLICATION = new Set([
  "Анестезиология и реаниматология",
  "Эндоскопические отделения",
  "Диагностические центры",
  "Диагностические кабинеты",
  "Диагностические и лечебные подразделения",
  "Медицинские организации",
]);

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const mappedStage = mapCloudPreviewSnapshot(stage as unknown as CloudPreviewCatalogSnapshot);
const composed = composeEndoMarketStageCatalog(published as StorefrontCatalog, mappedStage);

test("v7 inputs are tracked byte-for-byte and the Stage-only safety boundary is explicit", async () => {
  const [businessContract, businessSpec, generator, capture] = await Promise.all([
    readFile("data/import/source/cybermedica-master-corrective-v7.json", "utf8"),
    readFile("data/import/source/cybermedica-master-corrective-v7-business-spec.md", "utf8"),
    readFile("scripts/importers/apply-catalog-master-corrective-v7.ts", "utf8"),
    readFile("scripts/importers/capture-endomarket-stage-published-catalog.ts", "utf8"),
  ]);
  assert.equal(sha256(businessContract), audit.inputs.businessContract.sha256);
  assert.equal(sha256(businessSpec), audit.inputs.businessSpec.sha256);
  assert.doesNotMatch(generator, /service_role|cloud_api|insert\s+into|update\s+cloud|publish_product/iu);
  assert.match(capture, /UNRESOLVED_FLIGHT_REFERENCE/u);
  assert.match(capture, /repairedFromAuthoritativeShortDescription/u);
  assert.equal(audit.safety.productionWrites, 0);
  assert.equal(audit.safety.lifecycleWrites, 0);
  assert.equal(audit.safety.productionDeploymentChanged, false);
});

test("global 114-Product audit resolves identity once and leaves no invalid public description", () => {
  assert.deepEqual(audit.identityResolution, {
    previousVisibleCount: 113,
    legitimatelyRestoredSeparateProducts: 1,
    duplicatesRemoved: 0,
    finalVisibleCount: 114,
    formula: "113 + 1 (HD-550 Stage candidate) - 0 duplicates = 114",
    hd350: "existing published Product; exact Stage content overlay",
    hd500: "existing published Product; exact Stage content overlay",
    hd550: "absent from 71-product published projection; one separate Stage-only draft candidate",
  });
  assert.equal(audit.products.length, 114);
  assert.equal(new Set(audit.products.map(({ productId }) => productId)).size, 114);
  assert.equal(new Set(audit.products.map(({ slug }) => slug)).size, 114);
  assert.equal(audit.counts.legacyProductsAudited, 71);
  assert.equal(audit.counts.importedProductsAudited, 42);
  assert.equal(audit.counts.restoredStageCandidates, 1);
  assert.equal(audit.counts.invalidLegacyDescriptionsFound, 3);
  assert.equal(audit.counts.invalidLegacyDescriptionsFixed, 3);
  assert.equal(audit.counts.remainingInvalidDescriptions, 0);
  assert.deepEqual(audit.legacyDescriptionCorrections.map(({ originalToken }) => originalToken), ["$21", "$22", "$23"]);
  assert.equal(composed.products.length, 114);
  assert.equal(composed.products.some(({ description }) => INVALID_DESCRIPTION.test(description)), false);
});

test("all 42 direct-source Products keep raw truth and expose concise source-traced presentation content", () => {
  const rawById = new Map(stage.products.map((product) => [product.id, product]));
  const publicById = new Map(mappedStage.products.map((product) => [product.id, product]));
  const auditById = new Map(audit.products.map((product) => [product.productId, product]));
  for (const source of sourceTruth.products) {
    const raw = rawById.get(source.productId);
    const product = publicById.get(source.productId);
    const evidence = auditById.get(source.productId);
    assert.ok(raw && product && evidence, source.model);
    assert.equal(raw.description, source.sourceDescription, source.model);
    assert.deepEqual(raw.keyFeatures.map(({ text }) => text), source.sourceFeatures, source.model);
    assert.ok(product.keyFeatures.length > 0, `${source.model}: hidden presentation feature section`);
    assert.equal(product.keyFeatures.every((feature) => feature.length <= 110), true, source.model);
    assert.equal(evidence.features.validation, "pass", source.model);
    assert.equal(evidence.specifications.matchStatus, "pass", source.model);
    assert.equal(evidence.media.watermark, false, source.model);
    assert.equal(evidence.media.duplicate, false, source.model);
    assert.equal(evidence.media.fallback, false, source.model);
    assert.equal(product.applicationAreas.some((value) => value.includes("•") || FORBIDDEN_APPLICATION.has(value)), false, source.model);
  }
  assert.equal(audit.acceptance.lostSourceFeatures, 0);
  assert.equal(audit.acceptance.lostSourceSpecifications, 0);
  assert.equal(audit.acceptance.hiddenMeaningfulFeatureSections, 0);
});

test("hard-reference Products preserve exact accepted completeness and variant distinctions", () => {
  const byModel = new Map(mappedStage.products.map((product) => [product.model, product]));
  const iliv = byModel.get("iLivTouch");
  const eb500 = byModel.get("EB-500");
  assert.ok(iliv && eb500);
  assert.deepEqual(iliv.keyFeatures, [
    "Для пациентов разного возраста и комплекции",
    "Точность диагностики до 97%",
    "Неинвазивное и безболезненное исследование",
    "Исследование до 5 минут",
  ]);
  assert.equal(eb500.keyFeatures.length, 6);
  assert.equal(eb500.specifications.length, 7);
  assert.equal(eb500.media.length, 3);

  const expectedBronchoscopeValues: Record<string, string[]> = {
    "BR-1231": ["2,8 мм", "1,2 мм", "210° / 130° / 120° / 120°"],
    "BR-1242": ["4,2 мм", "2,0 мм", "210° / 130° / 120° / 120°"],
    "BR-1249": ["4,8 мм", "2,0 мм", "210° / 130° / 120° / 120°"],
    "BR-1259": ["5,9 мм", "2,8 мм", "180° / 130° / 120° / 120°"],
  };
  for (const [model, values] of Object.entries(expectedBronchoscopeValues)) {
    const product = byModel.get(model);
    assert.ok(product, model);
    const serialized = JSON.stringify({ features: product.keyFeatures, specifications: product.specifications });
    values.forEach((value) => assert.match(serialized, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), model));
    assert.equal(product.keyFeatures.at(-1), "Совместимость с HV-3101", model);
  }
});

test("HD-350 and HD-500 overlay the exact published identities while HD-550 exists once as a Stage draft", () => {
  const byModel = new Map(composed.products.map((product) => [product.model, product]));
  const hd350 = byModel.get("HD-350");
  const hd500 = byModel.get("HD-500");
  const hd550 = byModel.get("HD-550");
  assert.ok(hd350 && hd500 && hd550);
  assert.equal(hd350.status, "active");
  assert.equal(hd500.status, "active");
  assert.equal(hd550.status, "preview_draft");
  assert.match(hd350.description, /HDL-35E|500 ГБ/u);
  assert.match(hd500.description, /HDL-500X|300 Вт/u);
  assert.match(hd550.description, /VLS-55Q|1920×1200/u);
  assert.equal(composed.products.filter(({ model }) => model === "HD-550").length, 1);
});

test("Product Detail UX contract is carousel-only, compact and source-complete", async () => {
  const [gallery, detail, stageSmoke] = await Promise.all([
    readFile("components/catalog/ProductGallery.tsx", "utf8"),
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
    readFile("scripts/qa/endomarket-stage-smoke.ts", "utf8"),
  ]);
  assert.match(gallery, /aria-roledescription="карусель изображений"/u);
  assert.match(gallery, /onTouchStart|onTouchEnd/u);
  assert.match(gallery, /ArrowLeft|ArrowRight/u);
  assert.match(gallery, /\{selectedImageIndex \+ 1\} \/ \{imageMedia\.length\}/u);
  assert.doesNotMatch(gallery, /sizes="72px"|snap-start shrink-0/u);
  assert.match(detail, /flex min-w-0 flex-col justify-start/u);
  assert.match(detail, /const featureSectionTitle = "Ключевые особенности"/u);
  assert.doesNotMatch(detail, /experience\.applicationAreas\.slice/u);
  assert.ok(detail.indexOf('id="description"') < detail.indexOf('id="advantages"'));
  assert.ok(detail.indexOf('id="advantages"') < detail.indexOf('id="specifications"'));
  assert.ok(detail.lastIndexOf('id="manufacturer"') > detail.indexOf('id="applications"'));
  assert.match(stageSmoke, /origin\.hostname === "stage\.cyber-medica\.ru"/u);
  assert.match(stageSmoke, /https:\/\/vercel\.live\/_next-live\/feedback\/feedback\.js/u);
  assert.doesNotMatch(stageSmoke, /if \(message\.type\(\) !== "error"\) return;\s*errors\.push/gu);
});
