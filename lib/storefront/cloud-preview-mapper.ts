import {
  CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID,
  CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID,
  PRODUCT_DOCUMENT_KINDS,
  PUBLIC_PRODUCT_STATUSES,
  type CatalogSummary,
  type Category,
  type Manufacturer,
  type Product,
  type ProductDocument,
  type ProductDocumentKind,
  type ProductMedia,
  type ProductRegistration,
  type ProductSpecification,
} from "./types.ts";

export interface CloudReferenceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  countryCode?: string | null;
  website?: string | null;
  position?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CloudPreviewProductRow {
  id: string;
  slug: string;
  title: string;
  model: string | null;
  shortDescription: string | null;
  description: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  manufacturerId: string | null;
  categoryId: string | null;
  publicationStatus: string;
  published: boolean;
  reviewState: string;
  updatedAt: string;
  createdAt: string;
  applicationAreas: Array<{ id: string; name: string }>;
  /** Transitional legacy rows are deliberately ignored by Product Detail. */
  characteristics?: Array<{ name: string; value: string; unit: string | null }>;
  keyFeatures?: Array<{ text: string; sortOrder: number }>;
  characteristicGroups?: Array<{
    key: string;
    title: string;
    sortOrder: number;
    items: Array<{
      label: string;
      value: string;
      unit: string | null;
      sortOrder: number;
    }>;
  }>;
  media: Array<{ url: string; role: string; format: string | null; alt?: string | null }>;
  documents: Array<{
    title: string;
    kind: string;
    publicUrl: string;
    language: string;
    isOfficial: boolean;
  }>;
  registrations: Array<{
    registrationNumber: string | null;
    status: string;
    sourceUrl: string | null;
  }>;
  commercialPresentation?: Product["commercialPresentation"];
}

export interface CloudPreviewCatalogSnapshot {
  generatedAt: string;
  products: CloudPreviewProductRow[];
  manufacturers: CloudReferenceRow[];
  categories: CloudReferenceRow[];
  applicationAreas: CloudReferenceRow[];
}

function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeMediaUrl(value: string | null | undefined): string | null {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  return safeHttpsUrl(value);
}

export function storefrontPlainText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<\/p>|<\/li>|<\/h[1-6]>/giu, " ")
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeDocumentKind(value: string): ProductDocumentKind {
  return (PRODUCT_DOCUMENT_KINDS as readonly string[]).includes(value)
    ? (value as ProductDocumentKind)
    : "other";
}

function mediaType(format: string | null, url: string): ProductMedia["type"] {
  return /video|mp4|webm|mov/iu.test(`${format ?? ""} ${url}`) ? "video" : "image";
}

function mapManufacturer(row: CloudReferenceRow): Manufacturer {
  const description = row.description?.trim() || "Описание производителя уточняется.";
  return {
    id: row.slug,
    slug: row.slug,
    name: row.name,
    country: row.countryCode?.trim() || "Страна не указана",
    shortDescription: storefrontPlainText(description),
    description,
    logoUrl: null,
    websiteUrl: safeHttpsUrl(row.website),
    status: "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCategory(row: CloudReferenceRow, index: number): Category {
  const description = row.description?.trim() || "Описание категории уточняется.";
  return {
    id: row.slug,
    slug: row.slug,
    name: row.name,
    shortDescription: storefrontPlainText(description),
    description,
    parentId: null,
    imageUrl: null,
    position: row.position ?? index,
    status: "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function structuredPlainText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized && !/<\/?[a-z][^>]*>/iu.test(normalized) ? normalized : null;
}

function mapKeyFeatures(rows: CloudPreviewProductRow["keyFeatures"]): string[] {
  return [...(rows ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap(({ text }) => {
      const value = structuredPlainText(text);
      return value ? [value] : [];
    });
}

function mapSpecifications(
  groups: CloudPreviewProductRow["characteristicGroups"],
): ProductSpecification[] {
  return [...(groups ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.key.localeCompare(right.key))
    .flatMap((group) => {
      const groupTitle = structuredPlainText(group.title);
      if (!groupTitle) return [];
      return [...group.items]
        .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
        .flatMap((item) => {
          const label = structuredPlainText(item.label);
          const value = structuredPlainText(item.value);
          if (!label || !value) return [];
          return [{
            group: groupTitle,
            label,
            value,
            unit: structuredPlainText(item.unit),
            position: 0,
          }];
        });
    })
    .map((specification, position) => ({ ...specification, position }));
}

function mapMedia(row: CloudPreviewProductRow): ProductMedia[] {
  return row.media.flatMap((media, position) => {
    const url = safeMediaUrl(media.url);
    if (!url) return [];
    return [{
      type: mediaType(media.format, url),
      url,
      alt: structuredPlainText(media.alt) ?? `${row.title}, изображение ${position + 1}`,
      position,
    } satisfies ProductMedia];
  });
}

function mapDocuments(rows: CloudPreviewProductRow["documents"]): ProductDocument[] {
  return rows.flatMap((document) => {
    const publicUrl = safeHttpsUrl(document.publicUrl);
    if (!publicUrl || !document.title.trim()) return [];
    return [{
      title: document.title.trim(),
      kind: normalizeDocumentKind(document.kind),
      publicUrl,
      language: document.language.trim() || "Язык не указан",
      isOfficial: document.isOfficial,
    }];
  });
}

function mapRegistrations(rows: CloudPreviewProductRow["registrations"]): ProductRegistration[] {
  return rows.map((registration) => ({
    number: registration.registrationNumber?.trim() || null,
    status: registration.status.trim() || "no_data",
    sourceUrl: safeHttpsUrl(registration.sourceUrl),
  }));
}

export function mapCloudPreviewSnapshot(snapshot: CloudPreviewCatalogSnapshot) {
  const manufacturers = snapshot.manufacturers.map(mapManufacturer);
  const categories = snapshot.categories.map(mapCategory);
  const manufacturerSlugs = new Map(snapshot.manufacturers.map((row) => [row.id, row.slug]));
  const categorySlugs = new Map(snapshot.categories.map((row) => [row.id, row.slug]));
  const products: Product[] = snapshot.products.map((row) => {
    const manufacturerId = row.manufacturerId
      ? manufacturerSlugs.get(row.manufacturerId) ?? CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID
      : CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID;
    const categoryId = row.categoryId
      ? categorySlugs.get(row.categoryId) ?? CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID
      : CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID;
    const model = row.model?.trim() || "Не указан";
    const catalogQualityStatus = manufacturerId !== CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID &&
        categoryId !== CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID && model !== "Не указан"
      ? "READY" as const
      : "REQUIRES_EDITOR_REVIEW" as const;
    return {
      id: row.id,
      slug: row.slug,
      manufacturerId,
      categoryId,
      name: row.title.trim(),
      model,
      shortDescription: storefrontPlainText(row.shortDescription || row.description) || "Описание добавляется.",
      description: row.description?.trim() || row.shortDescription?.trim() || "Описание добавляется.",
      seoTitle: row.seoTitle?.trim() || null,
      seoDescription: row.seoDescription?.trim() || null,
      ...(row.commercialPresentation
        ? { commercialPresentation: row.commercialPresentation }
        : {}),
      status: row.published ? "active" : "preview_draft",
      catalogQualityStatus,
      featured: false,
      applicationAreas: row.applicationAreas.map(({ name }) => name).filter(Boolean),
      keyFeatures: mapKeyFeatures(row.keyFeatures),
      specifications: mapSpecifications(row.characteristicGroups),
      media: mapMedia(row),
      documents: mapDocuments(row.documents),
      registrationRecords: mapRegistrations(row.registrations),
      compatibility: [],
      relatedProductIds: [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
  const summary: CatalogSummary = {
    schemaVersion: 1,
    generatedAt: snapshot.generatedAt,
    productCount: products.length,
    activeProductCount: products.filter(({ status }) => PUBLIC_PRODUCT_STATUSES.has(status)).length,
    manufacturerCount: manufacturers.length,
    categoryCount: categories.length,
  };
  return { products, manufacturers, categories, summary };
}
