import { z } from "zod";

import {
  CATEGORY_STATUSES,
  MANUFACTURER_STATUSES,
  PRODUCT_DOCUMENT_KINDS,
  PRODUCT_MEDIA_TYPES,
  PRODUCT_STATUSES,
  PUBLIC_PRODUCT_STATUSES,
  type StorefrontCatalog,
} from "./types.ts";

const identifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required")
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "Identifier must contain only lowercase Latin letters, numbers, and hyphens",
  );

const requiredTextSchema = z.string().trim().min(1, "Required text field is empty");
const timestampSchema = z.iso.datetime({ offset: true });

const publicUrlSchema = z.string().trim().min(1).refine(
  (value) => {
    if (value.startsWith("/")) return !value.startsWith("//");
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  },
  "URL must be an HTTPS URL or a root-relative public path",
);

const externalUrlSchema = z.url().refine(
  (value) => new URL(value).protocol === "https:",
  "External URL must use HTTPS",
);

export const manufacturerSchema = z
  .object({
    id: identifierSchema,
    slug: identifierSchema,
    name: requiredTextSchema,
    country: requiredTextSchema,
    shortDescription: requiredTextSchema,
    description: requiredTextSchema,
    logoUrl: publicUrlSchema.nullable(),
    websiteUrl: externalUrlSchema.nullable(),
    status: z.enum(MANUFACTURER_STATUSES),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const categorySchema = z
  .object({
    id: identifierSchema,
    slug: identifierSchema,
    name: requiredTextSchema,
    shortDescription: requiredTextSchema,
    description: requiredTextSchema,
    parentId: identifierSchema.nullable(),
    imageUrl: publicUrlSchema.nullable(),
    position: z.number().int().nonnegative(),
    status: z.enum(CATEGORY_STATUSES),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const productSpecificationSchema = z
  .object({
    group: requiredTextSchema,
    label: requiredTextSchema,
    value: requiredTextSchema,
    unit: requiredTextSchema.nullable(),
    position: z.number().int().nonnegative(),
    contentKind: z.enum(["legacy_metadata", "technical_specification"]).optional(),
    recordOrigin: z.enum(["legacy", "structured_product_detail"]).optional(),
  })
  .strict();

export const productMediaSchema = z
  .object({
    type: z.enum(PRODUCT_MEDIA_TYPES),
    url: publicUrlSchema,
    alt: requiredTextSchema,
    position: z.number().int().nonnegative(),
  })
  .strict();

export const productDocumentSchema = z
  .object({
    title: requiredTextSchema,
    kind: z.enum(PRODUCT_DOCUMENT_KINDS),
    publicUrl: publicUrlSchema,
    language: requiredTextSchema,
    isOfficial: z.boolean(),
  })
  .strict();

export const productCompatibilitySchema = z
  .object({
    compatibleProductId: identifierSchema.nullable(),
    label: requiredTextSchema,
    note: requiredTextSchema,
  })
  .strict();

export const productRegistrationSchema = z
  .object({
    number: requiredTextSchema.nullable(),
    status: requiredTextSchema,
    sourceUrl: externalUrlSchema.nullable(),
  })
  .strict();

export const productCommercialPresentationSchema = z
  .object({
    source: z.literal("endomarket"),
    availabilityStatus: z.literal("in_stock"),
    availabilityLabel: z.literal("В наличии"),
    installmentEnabled: z.literal(true),
    installmentLabel: z.literal("Рассрочка 0%"),
    installmentTermMonths: z.literal(12),
    installmentDescription: z.literal("До 12 месяцев без удорожания"),
  })
  .strict();

export const productSchema = z
  .object({
    id: identifierSchema,
    slug: identifierSchema,
    manufacturerId: identifierSchema,
    categoryId: identifierSchema,
    name: requiredTextSchema,
    model: requiredTextSchema,
    shortDescription: requiredTextSchema,
    description: requiredTextSchema,
    seoTitle: requiredTextSchema.nullable().optional(),
    seoDescription: requiredTextSchema.nullable().optional(),
    commercialPresentation: productCommercialPresentationSchema.optional(),
    status: z.enum(PRODUCT_STATUSES),
    catalogQualityStatus: z.enum(["READY", "REQUIRES_EDITOR_REVIEW"]).optional(),
    featured: z.boolean(),
    applicationAreas: z.array(requiredTextSchema),
    keyFeatures: z.array(requiredTextSchema),
    specifications: z.array(productSpecificationSchema),
    media: z.array(productMediaSchema),
    documents: z.array(productDocumentSchema),
    registrationRecords: z.array(productRegistrationSchema).optional(),
    compatibility: z.array(productCompatibilitySchema),
    relatedProductIds: z.array(identifierSchema),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const catalogSummarySchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: timestampSchema,
    productCount: z.number().int().nonnegative(),
    activeProductCount: z.number().int().nonnegative(),
    manufacturerCount: z.number().int().nonnegative(),
    categoryCount: z.number().int().nonnegative(),
  })
  .strict();

function addDuplicateIssues(
  values: Array<{ id: string; slug: string }>,
  entityName: string,
  ctx: z.RefinementCtx,
  path: string,
) {
  for (const key of ["id", "slug"] as const) {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value[key])) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate ${entityName} ${key} "${value[key]}"`,
          path: [path, index, key],
        });
      }
      seen.add(value[key]);
    });
  }
}

export const storefrontCatalogSchema = z
  .object({
    products: z.array(productSchema),
    manufacturers: z.array(manufacturerSchema),
    categories: z.array(categorySchema),
    summary: catalogSummarySchema,
  })
  .strict()
  .superRefine((catalog, ctx) => {
    addDuplicateIssues(catalog.products, "product", ctx, "products");
    addDuplicateIssues(catalog.manufacturers, "manufacturer", ctx, "manufacturers");
    addDuplicateIssues(catalog.categories, "category", ctx, "categories");

    const manufacturerIds = new Set(catalog.manufacturers.map(({ id }) => id));
    const categoryIds = new Set(catalog.categories.map(({ id }) => id));
    const productIds = new Set(catalog.products.map(({ id }) => id));

    catalog.categories.forEach((category, index) => {
      if (category.parentId && !categoryIds.has(category.parentId)) {
        ctx.addIssue({
          code: "custom",
          message: `Category "${category.id}" references missing parentId "${category.parentId}"`,
          path: ["categories", index, "parentId"],
        });
      }
      if (category.parentId === category.id) {
        ctx.addIssue({
          code: "custom",
          message: `Category "${category.id}" cannot be its own parent`,
          path: ["categories", index, "parentId"],
        });
      }
    });

    catalog.products.forEach((product, productIndex) => {
      if (!manufacturerIds.has(product.manufacturerId)) {
        ctx.addIssue({
          code: "custom",
          message: `Product "${product.id}" references missing manufacturerId "${product.manufacturerId}"`,
          path: ["products", productIndex, "manufacturerId"],
        });
      }
      if (!categoryIds.has(product.categoryId)) {
        ctx.addIssue({
          code: "custom",
          message: `Product "${product.id}" references missing categoryId "${product.categoryId}"`,
          path: ["products", productIndex, "categoryId"],
        });
      }
      product.relatedProductIds.forEach((relatedProductId, relatedIndex) => {
        if (!productIds.has(relatedProductId)) {
          ctx.addIssue({
            code: "custom",
            message: `Product "${product.id}" references missing relatedProductId "${relatedProductId}"`,
            path: ["products", productIndex, "relatedProductIds", relatedIndex],
          });
        }
        if (relatedProductId === product.id) {
          ctx.addIssue({
            code: "custom",
            message: `Product "${product.id}" cannot reference itself as related`,
            path: ["products", productIndex, "relatedProductIds", relatedIndex],
          });
        }
      });
      product.compatibility.forEach((compatibility, compatibilityIndex) => {
        const compatibleProductId = compatibility.compatibleProductId;
        if (compatibleProductId && !productIds.has(compatibleProductId)) {
          ctx.addIssue({
            code: "custom",
            message: `Product "${product.id}" references missing compatibleProductId "${compatibleProductId}"`,
            path: [
              "products",
              productIndex,
              "compatibility",
              compatibilityIndex,
              "compatibleProductId",
            ],
          });
        }
        if (compatibleProductId === product.id) {
          ctx.addIssue({
            code: "custom",
            message: `Product "${product.id}" cannot be compatible with itself`,
            path: [
              "products",
              productIndex,
              "compatibility",
              compatibilityIndex,
              "compatibleProductId",
            ],
          });
        }
      });
    });

    const expectedSummary = {
      productCount: catalog.products.length,
      activeProductCount: catalog.products.filter(({ status }) =>
        PUBLIC_PRODUCT_STATUSES.has(status),
      ).length,
      manufacturerCount: catalog.manufacturers.length,
      categoryCount: catalog.categories.length,
    };
    for (const [key, expected] of Object.entries(expectedSummary)) {
      const summaryKey = key as keyof typeof expectedSummary;
      if (catalog.summary[summaryKey] !== expected) {
        ctx.addIssue({
          code: "custom",
          message: `Catalog summary ${key} must be ${expected}, received ${catalog.summary[summaryKey]}`,
          path: ["summary", key],
        });
      }
    }
  });

export class StorefrontCatalogValidationError extends Error {
  readonly issues: string[];

  constructor(error: z.ZodError) {
    const issues = error.issues.map((issue) => {
      const location = issue.path.length ? issue.path.join(".") : "catalog";
      return `${location}: ${issue.message}`;
    });
    super(`Invalid storefront catalog:\n- ${issues.join("\n- ")}`);
    this.name = "StorefrontCatalogValidationError";
    this.issues = issues;
  }
}

export function validateStorefrontCatalog(input: unknown): StorefrontCatalog {
  const result = storefrontCatalogSchema.safeParse(input);
  if (!result.success) throw new StorefrontCatalogValidationError(result.error);
  return result.data;
}
