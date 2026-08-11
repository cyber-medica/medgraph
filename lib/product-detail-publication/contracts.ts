import { z } from "zod";

export const STRUCTURED_PRODUCT_DETAIL_SCHEMA_VERSION = 1 as const;

const FIELD_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const NON_TECHNICAL_LABELS = new Set([
  "артикул",
  "категория",
  "модель",
  "область применения",
  "применение",
  "производитель",
  "регистрационное удостоверение",
  "страна производства",
  "тип товара",
  "цена",
  "application area",
  "category",
  "country",
  "country of origin",
  "manufacturer",
  "model",
  "product type",
  "registration number",
  "sku",
  "price",
]);

function plainTextSchema(maximumLength: number) {
  return z.string()
    .trim()
    .min(1)
    .max(maximumLength)
    .refine(
      (value) => !/<\/?[a-z][^>]*>/iu.test(value),
      "Structured fields must contain plain text.",
    );
}

const fieldKeySchema = z.string().regex(FIELD_KEY_PATTERN);
const uuidSchema = z.string().regex(UUID_PATTERN);

export const structuredFieldSourceSchema = z.object({
  type: plainTextSchema(80),
  ref: plainTextSchema(500),
  url: z.string().url().refine((value) => new URL(value).protocol === "https:", {
    message: "Source URLs must use HTTPS.",
  }).nullable().optional(),
}).strict();

export const structuredKeyFeatureSchema = z.object({
  key: fieldKeySchema,
  text: plainTextSchema(400),
  sortOrder: z.number().int().nonnegative(),
  source: structuredFieldSourceSchema,
}).strict();

export const structuredSpecificationSchema = z.object({
  key: fieldKeySchema,
  label: plainTextSchema(200).refine(
    (value) => !NON_TECHNICAL_LABELS.has(value.toLocaleLowerCase("ru-RU").replace(/\s+/gu, " ")),
    "Metadata and marketing labels are not technical specifications.",
  ),
  value: plainTextSchema(1_000),
  unit: plainTextSchema(80).nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
  group: z.object({
    key: fieldKeySchema,
    title: plainTextSchema(160),
    sortOrder: z.number().int().nonnegative(),
  }).strict().nullable().optional(),
  source: structuredFieldSourceSchema,
}).strict();

function uniqueKeys<T extends { key: string }>(values: T[]) {
  return new Set(values.map(({ key }) => key)).size === values.length;
}

export const structuredProductDetailCandidateSchema = z.object({
  schemaVersion: z.literal(STRUCTURED_PRODUCT_DETAIL_SCHEMA_VERSION),
  product: z.object({
    id: uuidSchema,
    sourceUid: plainTextSchema(200).nullable().optional(),
  }).strict(),
  keyFeatures: z.array(structuredKeyFeatureSchema).max(100),
  specifications: z.array(structuredSpecificationSchema).max(500),
}).strict().superRefine((candidate, context) => {
  if (!uniqueKeys(candidate.keyFeatures)) {
    context.addIssue({
      code: "custom",
      path: ["keyFeatures"],
      message: "Key feature keys must be unique within a candidate.",
    });
  }
  if (!uniqueKeys(candidate.specifications)) {
    context.addIssue({
      code: "custom",
      path: ["specifications"],
      message: "Specification keys must be unique within a candidate.",
    });
  }
});

export const publishStructuredProductDetailInputSchema = z.object({
  candidateRevisionId: uuidSchema,
  schemaVersion: z.literal(STRUCTURED_PRODUCT_DETAIL_SCHEMA_VERSION),
  idempotencyKey: z.string().trim().min(8).max(200),
  actorId: uuidSchema,
}).strict();

export const createStructuredProductDetailRevisionInputSchema = z.object({
  candidateId: uuidSchema,
  actorId: uuidSchema,
}).strict();

export const rollbackStructuredProductDetailInputSchema = z.object({
  publicationBatchId: uuidSchema,
  actorId: uuidSchema,
}).strict();

export const structuredProductDetailPublicationResultSchema = z.object({
  publicationBatchId: uuidSchema,
  candidateId: uuidSchema,
  candidateRevisionId: uuidSchema,
  productId: uuidSchema,
  status: z.enum(["published", "superseded", "rolled_back"]),
  keyFeatureCount: z.number().int().nonnegative(),
  specificationCount: z.number().int().nonnegative(),
  idempotent: z.boolean(),
}).strict();

export const structuredProductDetailRevisionResultSchema = z.object({
  candidateRevisionId: uuidSchema,
  candidateId: uuidSchema,
  productId: uuidSchema,
  revisionNumber: z.number().int().positive(),
  schemaVersion: z.literal(STRUCTURED_PRODUCT_DETAIL_SCHEMA_VERSION),
  payloadChecksum: z.string().regex(/^[a-f0-9]{64}$/u),
  productIdentityChecksum: z.string().regex(/^[a-f0-9]{64}$/u),
  idempotent: z.boolean(),
}).strict();

export type StructuredProductDetailCandidate = z.infer<typeof structuredProductDetailCandidateSchema>;
export type CreateStructuredProductDetailRevisionInput = z.infer<typeof createStructuredProductDetailRevisionInputSchema>;
export type PublishStructuredProductDetailInput = z.infer<typeof publishStructuredProductDetailInputSchema>;
export type RollbackStructuredProductDetailInput = z.infer<typeof rollbackStructuredProductDetailInputSchema>;
export type StructuredProductDetailRevisionResult = z.infer<typeof structuredProductDetailRevisionResultSchema>;
export type StructuredProductDetailPublicationResult = z.infer<typeof structuredProductDetailPublicationResultSchema>;
