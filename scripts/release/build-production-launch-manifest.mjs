import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [stagePath, productionPath, sourceTruthPath, mediaManifestPath, masterAuditPath, outputPath] = process.argv.slice(2);
if (![stagePath, productionPath, sourceTruthPath, mediaManifestPath, masterAuditPath, outputPath].every(Boolean)) {
  throw new Error("Expected Stage, Production, source truth, media, Master v7, and output paths.");
}

const stage = JSON.parse(readFileSync(stagePath, "utf8"));
const production = JSON.parse(readFileSync(productionPath, "utf8"))[0]?.result;
const sourceTruth = JSON.parse(readFileSync(sourceTruthPath, "utf8"));
const mediaManifest = JSON.parse(readFileSync(mediaManifestPath, "utf8"));
const masterAudit = JSON.parse(readFileSync(masterAuditPath, "utf8"));
if (!production) throw new Error("Production reconciliation payload is unavailable.");

const namespace = "6b65e0cb-9382-584d-a0d8-d708f36e5820";
const normalize = (value) => String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const normalizeBrand = (value) => String(value ?? "").replace(/CyberMedica|CYBERMEDICA|Cybermedica/gu, "Кибермедика");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const uuidBytes = (value) => Buffer.from(value.replaceAll("-", ""), "hex");

function uuidV5(name) {
  const bytes = createHash("sha1").update(uuidBytes(namespace)).update(name).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const slugByArea = new Map(Object.entries({
  "Анестезиология": "anesteziologiya",
  "Бронхоскопия": "bronhoskopiya",
  "Гастроэнтерология": "gastroenterologiya",
  "Диагностика": "diagnostika",
  "Колоноскопия": "kolonoskopiya",
  "Медицинский кабинет": "medicinskij-kabinet",
  "Операционная": "operacionnaya",
  "Пульмонология": "pulmonologiya",
  "Реанимация": "reanimaciya",
  "Стационар": "stacionar",
  "Урология": "urologiya",
  "Хирургия": "hirurgiya",
  "ЦСО": "cso",
  "Эндоскопия": "endoskopiya",
  "Эндоурология": "endourologiya",
  "ЭРХПГ": "erhpg",
}));
const categoryAlias = new Map([[normalize("Ультразвуковые системы"), normalize("УЗИ-системы")]]);
const stageManufacturers = new Map(stage.manufacturers.map((item) => [item.id, item]));
const stageCategories = new Map(stage.categories.map((item) => [item.id, item]));
const productionManufacturerByName = new Map(production.manufacturers.map((item) => [normalize(item.name), item]));
const productionCategoryByName = new Map(production.categories.map((item) => [normalize(item.name), item]));
const productionAreaByName = new Map(production.applicationAreas.map((item) => [normalize(item.name), item]));
const sourceTruthByProductId = new Map(sourceTruth.products.map((item) => [item.productId, item]));
const masterAuditByProductId = new Map(masterAudit.products.map((item) => [item.productId, item]));
const mediaByProductAndPath = new Map(mediaManifest.assets.map((item) => [`${item.productSlug}\n${item.localPath}`, item]));

const manufacturerNames = [...new Set(stage.products
  .filter((item) => item.stageImport?.entityOrigin === "new_candidate")
  .map((item) => stageManufacturers.get(item.manufacturerId)?.name))].sort((a, b) => a.localeCompare(b, "ru"));
const manufacturers = manufacturerNames.map((name) => {
  const stageReference = stage.manufacturers.find((item) => item.name === name);
  const existing = productionManufacturerByName.get(normalize(name));
  return existing ? {
    action: "reuse",
    id: existing.id,
    name: existing.name,
  } : {
    action: "create",
    id: uuidV5(`manufacturer:${normalize(name)}`),
    code: `manufacturer-${stageReference.slug}`,
    slug: stageReference.slug,
    name,
    description: stageReference.description,
  };
});
const manufacturerByName = new Map(manufacturers.map((item) => [normalize(item.name), item]));

const categoryNames = [...new Set(stage.products
  .filter((item) => item.stageImport?.entityOrigin === "new_candidate")
  .map((item) => stageCategories.get(item.categoryId)?.name))].sort((a, b) => a.localeCompare(b, "ru"));
const categories = categoryNames.map((name) => {
  const normalizedTarget = categoryAlias.get(normalize(name)) ?? normalize(name);
  const existing = productionCategoryByName.get(normalizedTarget);
  if (existing) return { action: "reuse", id: existing.id, name: existing.name, stageName: name };
  return {
    action: "create",
    id: uuidV5(`category:${normalize(name)}`),
    code: "category-medicinskaya-mebel",
    slug: "medicinskaya-mebel",
    name,
    description: `Медицинское оборудование категории «${name}».`,
    stageName: name,
  };
});
const categoryByStageName = new Map(categories.map((item) => [normalize(item.stageName), item]));

const areaNames = [...new Set(stage.products
  .filter((item) => item.stageImport?.entityOrigin === "new_candidate")
  .flatMap((item) => item.applicationAreas.map((area) => area.name)))].sort((a, b) => a.localeCompare(b, "ru"));
const applicationAreas = areaNames.map((name) => {
  const existing = productionAreaByName.get(normalize(name));
  if (existing) return { action: "reuse", id: existing.id, name: existing.name };
  const slug = slugByArea.get(name);
  if (!slug) throw new Error(`Application-area slug is not mapped: ${name}`);
  return {
    action: "create",
    id: uuidV5(`application-area:${normalize(name)}`),
    code: `application-area-${slug}`,
    slug,
    name,
    description: `Область применения: ${name}.`,
  };
});
const applicationAreaByName = new Map(applicationAreas.map((item) => [normalize(item.name), item]));

const products = stage.products
  .filter((item) => item.stageImport?.entityOrigin === "new_candidate")
  .map((product) => {
    const manufacturerName = stageManufacturers.get(product.manufacturerId)?.name;
    const categoryName = stageCategories.get(product.categoryId)?.name;
    const manufacturer = manufacturerByName.get(normalize(manufacturerName));
    const category = categoryByStageName.get(normalize(categoryName));
    const master = masterAuditByProductId.get(product.id);
    const source = sourceTruthByProductId.get(product.id);
    if (!manufacturer || !category || !master?.productPassed) throw new Error(`Reference or Master v7 evidence missing for ${product.model}`);
    const presentationFeatures = product.presentationKeyFeatures ?? product.keyFeatures;
    if (JSON.stringify(presentationFeatures.map((item) => item.text)) !== JSON.stringify(master.features.items)) {
      throw new Error(`Master v7 feature drift for ${product.model}`);
    }
    const specifications = product.characteristicGroups.flatMap((group) => group.items.map((item) => ({
      key: `specification-${String(item.sortOrder + 1).padStart(3, "0")}`,
      label: item.label,
      value: item.value,
      unit: item.unit,
      sortOrder: item.sortOrder,
      group: { key: group.key, title: group.title, sortOrder: group.sortOrder },
      source: {
        type: "catalog-master-corrective-v7",
        ref: `${product.sourceUid}:specification:${item.sortOrder + 1}`,
        url: product.stageImport.sourceUrl,
      },
    })));
    if (JSON.stringify(specifications.map(({ label: name, value }) => ({ name, value }))) !== JSON.stringify(master.specifications.items)) {
      throw new Error(`Master v7 specification drift for ${product.model}`);
    }
    const media = product.media.map((item, index) => {
      const evidence = mediaByProductAndPath.get(`${product.slug}\n${item.url}`);
      if (!evidence || evidence.sha256.length !== 64) throw new Error(`Media evidence missing for ${product.model}: ${item.url}`);
      return {
        publicUrl: `https://cyber-medica.ru${item.url}`,
        localPath: item.url,
        sourceUrl: evidence.sourceMediaUrl,
        checksumSha256: evidence.sha256,
        role: index === 0 ? "primary" : "gallery",
        format: item.format,
        alt: item.alt,
        sortOrder: index * 10,
      };
    });
    const sourceSnapshot = {
      contract: "accepted-stage-master-corrective-v7",
      productId: product.id,
      sourceUid: product.sourceUid,
      sourceUrl: product.stageImport.sourceUrl,
      sourcePageSha256: source?.sourcePageSha256 ?? master.description.authoritativeSource,
      title: product.title,
      model: product.model,
      manufacturer: manufacturerName,
      category: categoryName,
      shortDescription: product.shortDescription,
      fullDescription: product.description,
      keyFeatures: presentationFeatures.map((item) => item.text),
      specifications: master.specifications.items,
      media: media.map(({ localPath, checksumSha256, role }) => ({ localPath, checksumSha256, role })),
    };
    return {
      id: product.id,
      sourceUid: product.sourceUid,
      slug: product.slug,
      title: product.title,
      model: product.model,
      manufacturerId: manufacturer.id,
      categoryId: category.id,
      applicationAreaIds: product.applicationAreas.map((area) => applicationAreaByName.get(normalize(area.name))?.id),
      shortDescription: product.shortDescription,
      fullDescription: product.description,
      seoTitle: normalizeBrand(product.seoTitle),
      seoDescription: normalizeBrand(product.seoDescription),
      sourceType: source ? "direct_endomarket_product_page" : "accepted_hd550_stage_evidence",
      sourceUrl: product.stageImport.sourceUrl,
      snapshotVersion: "production-launch-source-truth-v7",
      sourceSnapshot,
      media,
      structuredDetail: {
        schemaVersion: 1,
        product: { id: product.id, sourceUid: product.sourceUid },
        keyFeatures: presentationFeatures.map((item, index) => ({
          key: `feature-${String(index + 1).padStart(3, "0")}`,
          text: item.text,
          sortOrder: index,
          source: {
            type: "catalog-master-corrective-v7",
            ref: `${product.sourceUid}:feature:${index + 1}`,
            url: product.stageImport.sourceUrl,
          },
        })),
        specifications,
      },
      warnings: ["missing_documents", "missing_registration"],
    };
  })
  .sort((left, right) => left.productId?.localeCompare?.(right.productId) ?? left.id.localeCompare(right.id));

const unique = (values) => new Set(values).size === values.length;
if (products.length !== 43
  || !unique(products.map((item) => item.id))
  || !unique(products.map((item) => item.sourceUid))
  || !unique(products.map((item) => item.slug))) {
  throw new Error("Production launch manifest scope is not exactly 43 unique candidates.");
}
if (products.some((item) => item.applicationAreaIds.some((id) => !id))) {
  throw new Error("Production launch application-area mapping is incomplete.");
}

const manifest = {
  schemaVersion: "cybermedica-production-launch-release-manifest-v1",
  version: "production-launch-release-v1",
  operationKey: "production-launch-catalog-import-v1",
  generatedAt: "2026-08-11T09:30:00.000Z",
  acceptedStageCommit: "cd674cc629947632833b8fe99751b55d797b3747",
  acceptedMasterCorrective: "catalog-master-corrective-v7",
  candidateCount: 43,
  expectedFinalPublishedCount: 114,
  references: { manufacturers, categories, applicationAreas },
  products,
};
const output = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(outputPath, output, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ output: outputPath, sha256: sha256(output), products: products.length, references: {
  manufacturersCreated: manufacturers.filter((item) => item.action === "create").length,
  categoriesCreated: categories.filter((item) => item.action === "create").length,
  applicationAreasCreated: applicationAreas.filter((item) => item.action === "create").length,
} })}\n`);
