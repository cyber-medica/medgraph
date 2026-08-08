import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const ROOT = resolve(process.cwd());
const dataset = JSON.parse(await readFile(resolve(ROOT, "data/import/endomarket-source-truth-reconciliation-v5.json"), "utf8"));
const stageCatalog = JSON.parse(await readFile(resolve(ROOT, "data/import/endomarket-wave1-stage-catalog.json"), "utf8"));
const sourceCsv = await readFile(resolve(ROOT, "data/import/source/endomarket-source-reconciliation-v5.csv"), "utf8");

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

test("direct EndoMarket source audit is complete for exactly 42 Products", () => {
  assert.equal(dataset.schemaVersion, 1);
  assert.equal(dataset.sourcePolicy.authoritativeContent, "DIRECT_ENDOMARKET_PRODUCT_PAGE");
  assert.equal(dataset.counts.products, 42);
  assert.equal(dataset.products.length, 42);
  assert.equal(new Set(dataset.products.map((product: { productId: string }) => product.productId)).size, 42);
  assert.equal(new Set(dataset.products.map((product: { sourceUid: string }) => product.sourceUid)).size, 42);
  assert.equal(new Set(dataset.products.map((product: { slug: string }) => product.slug)).size, 42);
  assert.equal(dataset.counts.descriptions, 42);
  assert.equal(dataset.counts.uniqueDirectPages, 38);
  assert.equal(dataset.counts.sourceFeatures, 160);
  assert.equal(dataset.counts.sourceSpecifications, 260);
  assert.equal(dataset.counts.cleanSourceMedia, 151);
  assert.equal(dataset.counts.missingDirectMedia, 0);
});

test("v5 reconciliation CSV and source-truth dataset cover the same Product models", () => {
  const csvModels = sourceCsv.replace(/^\uFEFF/u, "").trim().split(/\r?\n/u).slice(1).map((line) => line.split(",", 1)[0]);
  const datasetModels = dataset.products.map((product: { model: string }) => product.model);
  assert.deepEqual(datasetModels, csvModels);
});

test("every source record preserves complete direct content and a direct Product URL", () => {
  for (const product of dataset.products) {
    const sourceUrl = new URL(product.directSourceUrl);
    assert.equal(sourceUrl.protocol, "https:", product.model);
    assert.equal(sourceUrl.hostname, "endomarket.ru", product.model);
    assert.match(sourceUrl.pathname, /^\/products\//u, product.model);
    assert.ok(product.sourcePageSha256.match(/^[0-9a-f]{64}$/u), product.model);
    assert.ok(product.sourceDescription.trim(), product.model);
    assert.equal(product.sourceFeatures.length, product.sourceFeaturesCount, product.model);
    assert.equal(product.sourceSpecifications.length, product.sourceSpecificationsCount, product.model);
    assert.equal(product.sourceMedia.length, product.sourceMediaCount, product.model);
    assert.ok(product.sourceMediaCount > 0, product.model);
    assert.equal(new Set(product.sourceFeatures).size, product.sourceFeaturesCount, product.model);
    assert.equal(
      new Set(product.sourceSpecifications.map(({ name, value }: { name: string; value: string }) => `${name}\u0000${value}`)).size,
      product.sourceSpecificationsCount,
      product.model,
    );
    assert.equal(new Set(product.sourceMedia.map(({ sha256: checksum }: { sha256: string }) => checksum)).size, product.sourceMediaCount, product.model);
    assert.equal(product.sourceMedia[0]?.role, "hero", product.model);
    assert.ok(product.preCorrectiveStageComparison.features.match(/^\d+\/\d+$/u), product.model);
    assert.ok(product.preCorrectiveStageComparison.specifications.match(/^\d+\/\d+$/u), product.model);
    assert.ok(product.preCorrectiveStageComparison.media.match(/^\d+\/\d+$/u), product.model);
  }
});

test("all clean source media paths exist and match their checksums", async () => {
  for (const product of dataset.products) {
    for (const media of product.sourceMedia) {
      const bytes = await readFile(resolve(ROOT, `public${media.localPath}`));
      assert.equal(sha256(bytes), media.sha256, `${product.model}: ${media.localPath}`);
      assert.match(media.watermarkReview, /^pass_/u, product.model);
    }
  }
});

test("accepted EB-500 reference remains exact at 6/6, 7/7 and 3/3", () => {
  const product = dataset.products.find(({ model }: { model: string }) => model === "EB-500");
  assert.ok(product);
  assert.equal(product.acceptedReference, "product_owner_accepted_eb500");
  assert.equal(product.sourceFeaturesCount, 6);
  assert.equal(product.sourceSpecificationsCount, 7);
  assert.equal(product.sourceMediaCount, 3);
  assert.equal(product.preCorrectiveStageComparison.features, "4/6");
  assert.equal(product.preCorrectiveStageComparison.specifications, "5/7");
  assert.equal(product.preCorrectiveStageComparison.media, "3/3");
  assert.deepEqual(product.sourceSpecifications.at(-1), {
    name: "Диаметр инструментального канала",
    value: "2 мм",
  });
});

test("previous generic corrective copy is absent from the direct source dataset", () => {
  const serialized = JSON.stringify(dataset.products);
  assert.doesNotMatch(serialized, /Карточка интегрирована в каталог CyberMedica/iu);
  assert.doesNotMatch(serialized, /коммерческими условиями «В наличии»/iu);
  assert.doesNotMatch(serialized, /На странице отображаются только подтвержденные характеристики/iu);
});

test("source audit resolves exactly the Stage draft scope without changing identity", () => {
  const stageById = new Map(stageCatalog.products.map((product: { id: string }) => [product.id, product]));
  for (const source of dataset.products) {
    const stage = stageById.get(source.productId) as { sourceUid: string; slug: string; model: string; stageImport: { entityOrigin: string } } | undefined;
    assert.ok(stage, source.model);
    assert.equal(stage.sourceUid, source.sourceUid, source.model);
    assert.equal(stage.slug, source.slug, source.model);
    assert.equal(stage.model, source.model, source.model);
    assert.equal(stage.stageImport.entityOrigin, "new_candidate", source.model);
  }
});

test("one bulk corrective reconciles current Stage content and media at 42/42", () => {
  assert.equal(dataset.counts.currentDescriptionMatches, 42);
  assert.equal(dataset.counts.currentFeatureExactMatches, 42);
  assert.equal(dataset.counts.currentSpecificationExactMatches, 42);
  assert.equal(dataset.counts.currentMediaExactMatches, 42);
  assert.equal(dataset.counts.productsWithMediaBindingDrift, 0);
  assert.equal(dataset.counts.pendingManifestMediaBindings, 0);

  const stageById = new Map(stageCatalog.products.map((product: { id: string }) => [product.id, product]));
  for (const source of dataset.products) {
    const stage = stageById.get(source.productId) as {
      description: string;
      shortDescription: string;
      keyFeatures: Array<{ text: string }>;
      characteristicGroups: Array<{ items: Array<{ label: string; value: string }> }>;
      media: Array<{ url: string; role: string }>;
    };
    assert.equal(stage.description, source.sourceDescription, source.model);
    assert.equal(stage.shortDescription, source.sourceDescription, source.model);
    assert.deepEqual(stage.keyFeatures.map(({ text }) => text), source.sourceFeatures, source.model);
    assert.deepEqual(
      stage.characteristicGroups.flatMap(({ items }) => items).map(({ label, value }) => ({ name: label, value })),
      source.sourceSpecifications,
      source.model,
    );
    assert.deepEqual(
      stage.media.map(({ url, role }) => ({ localPath: url, role })),
      source.sourceMedia.map(({ localPath, role }: { localPath: string; role: string }) => ({ localPath, role })),
      source.model,
    );
    assert.equal(source.currentStageComparison.descriptionMatch, true, source.model);
    assert.equal(source.currentStageComparison.featuresExactMatch, true, source.model);
    assert.equal(source.currentStageComparison.specificationsExactMatch, true, source.model);
    assert.equal(source.currentStageComparison.mediaExactMatch, true, source.model);
    assert.equal(source.mediaReconciliation.currentBindingComplete, true, source.model);
  }
});
