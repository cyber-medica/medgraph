import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const INPUT = process.argv[2] ?? "/tmp/product-characteristics-wave-1-patch-preview-2026-08-03.json";
const OUTPUT = process.argv[3] ?? "lib/operations/product-characteristics-wave-1-patch-manifest.json";
const EXPECTED_INPUT_SHA256 = "1a46847aaa4859ede519070af5b890190f9d6ba4eaed77de04e14f57248d9978";
const EXPECTED_SCOPE = Object.freeze([
  "e66a1165-030b-4aa4-a400-959f1ac70fe3",
  "00e3f62b-797b-40ff-bf9f-9d1750828ca4",
  "f61a0496-0434-41ab-8ca3-0f79c19ab0aa",
  "224ee705-5dea-429f-ab10-1ef9153e94fc",
  "b7f07e3e-5cdd-4988-b2a4-423bed321f46",
  "76840838-c759-40eb-a1ef-e329e9091714",
  "c6ba9c45-f6e8-4b2f-9f32-38335ee52bfe",
  "48f7d071-c8e4-4bc9-96c4-fc12672ca183",
  "4e1a370b-4e53-4ee6-b590-823d1ad0e087",
  "ae1e448d-f266-4d5d-9d42-e2c22a2d54c8",
  "7866179e-e753-411b-8e9e-409b109b66d2",
  "e34f16f0-723c-4710-aab3-fb03d9fd9b84",
  "dc511122-9b03-4a91-83c6-eb08e27a7b74",
  "760b9466-dcb6-4fd5-a821-eb4bf8203e77",
  "79b6082c-b63e-4c8e-9769-36383747b57b",
]);

type PreparedCharacteristic = {
  key: string;
  label: string;
  value: string;
  unit?: string | null;
  group: string;
  order: number;
  contentKind?: string;
  recordOrigin?: string;
  sourceUrl?: string;
  evidenceLocation?: string;
  confidence?: string;
  configurationDependency?: string | null;
  optional?: boolean;
  notes?: string | null;
};

type PreparedPatch = {
  productId: string;
  sourceUid: string;
  slug: string;
  productName: string;
  model: string;
  currentPublishedRevision: { id: string; number: number };
  currentPublishedBatch: string;
  expectedNextRevisionNumber: number;
  authoritativeEvidence: Array<{ url: string; authority: string }>;
  characteristics: { before: PreparedCharacteristic[]; after: PreparedCharacteristic[] };
  descriptions: {
    before: { shortDescription: string; fullDescriptionHtml: string };
    after: { shortDescription: string; fullDescriptionHtml: string };
  };
  seo: {
    before: { title: string; description: string };
    after: { title: string; description: string };
  };
};

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

const inputBuffer = readFileSync(INPUT);
if (sha256(inputBuffer) !== EXPECTED_INPUT_SHA256) {
  throw new Error("Characteristics Wave 1 preparation artifact SHA-256 drift.");
}

const input = JSON.parse(inputBuffer.toString("utf8")) as {
  patches?: PreparedPatch[];
};
if (!Array.isArray(input.patches) || input.patches.length !== 15) {
  throw new Error("Characteristics Wave 1 preparation scope is not exactly 15.");
}

const entries = input.patches.map((patch, patchIndex) => {
  if (patch.productId !== EXPECTED_SCOPE[patchIndex]) {
    throw new Error(`Characteristics Wave 1 Product binding drift at ${patchIndex}.`);
  }
  const after = patch.characteristics?.after;
  const before = patch.characteristics?.before;
  if (!Array.isArray(after) || after.length !== 10 || !Array.isArray(before) || before.length !== 3) {
    throw new Error(`Characteristics Wave 1 characteristic count drift for ${patch.productId}.`);
  }
  const officialEvidence = patch.authoritativeEvidence.find(
    (item) => item.authority.startsWith("manufacturer"),
  );
  if (!officialEvidence?.url || !String(officialEvidence.url).startsWith("https://")) {
    throw new Error(`Official evidence is missing for ${patch.productId}.`);
  }
  const groupOrders = new Map<string, number>();
  const characteristics = after.map((item) => {
    if (!groupOrders.has(item.group)) groupOrders.set(item.group, groupOrders.size * 10);
    return {
      key: item.key,
      label: item.label,
      value: item.value,
      unit: item.unit ?? null,
      group: item.group,
      groupSortOrder: groupOrders.get(item.group),
      itemSortOrder: (Number(item.order) + 1) * 10,
      contentKind: item.contentKind ?? "technical_specification",
      recordOrigin: item.recordOrigin ?? "authoritative_wave_1_preparation",
      sourceUrl: item.sourceUrl ?? officialEvidence.url,
      evidenceLocation: item.evidenceLocation
        ?? "Existing canonical base field verified in the Wave 1 Product identity and category evidence package",
      confidence: item.confidence ?? "High",
      configurationDependency: item.configurationDependency ?? null,
      optional: item.optional ?? false,
      notes: item.notes ?? null,
    };
  });

  const productPatch: Record<string, string> = {};
  if (patch.seo?.before?.title !== patch.seo?.after?.title) {
    productPatch.seoTitle = patch.seo.after.title;
  }
  if (patch.seo?.before?.description !== patch.seo?.after?.description) {
    productPatch.seoDescription = patch.seo.after.description;
  }
  const descriptionPatch: Record<string, string> = {};
  if (patch.descriptions?.before?.shortDescription !== patch.descriptions?.after?.shortDescription) {
    descriptionPatch.shortDescription = patch.descriptions.after.shortDescription;
  }
  if (patch.descriptions?.before?.fullDescriptionHtml !== patch.descriptions?.after?.fullDescriptionHtml) {
    descriptionPatch.fullDescription = patch.descriptions.after.fullDescriptionHtml;
  }

  return {
    productId: patch.productId,
    sourceUid: patch.sourceUid,
    slug: patch.slug,
    productName: patch.productName,
    model: patch.model,
    currentPublishedRevision: patch.currentPublishedRevision,
    currentPublishedBatch: patch.currentPublishedBatch,
    expectedCurrentCharacteristics: 3,
    expectedDraftCharacteristics: 10,
    expectedNextRevisionNumber: patch.expectedNextRevisionNumber,
    productPatch,
    descriptionPatch,
    characteristics,
    requestId: `characteristics-wave-1-${patch.sourceUid}-patch-v1`,
  };
});

const digestInput = {
  version: "product-characteristics-wave-1-patch-v1",
  operationKey: "product-characteristics-wave-1-patch-v1",
  productCount: 15,
  sourceArtifactSha256: EXPECTED_INPUT_SHA256,
  entries,
};
const manifest = {
  ...digestInput,
  manifestSha256: sha256(JSON.stringify(digestInput)),
};
writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
process.stdout.write(`${manifest.manifestSha256}\n`);
