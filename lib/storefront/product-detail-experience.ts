import { formatCountryForPublic } from "./country-presentation.ts";
import { publicOptionalText } from "./product-presentation.ts";
import type {
  Category,
  Manufacturer,
  Product,
  ProductSpecification,
} from "./types.ts";

export interface ProductDetailBadge {
  label: string;
  value: string;
  href?: string;
}

export interface ProductDetailExperience {
  summary: string | null;
  description: string | null;
  advantages: readonly string[];
  generalSpecifications: readonly ProductSpecification[];
  technicalSpecifications: readonly ProductSpecification[];
  manufacturer: Manufacturer | null;
  category: Category | null;
  badges: readonly ProductDetailBadge[];
  applicationAreas: readonly string[];
}

const TECHNICAL_METADATA_LABELS = new Set([
  "артикул",
  "категория",
  "модель",
  "производитель",
  "регистрационное удостоверение",
  "страна производства",
  "тип товара",
]);

const NON_TECHNICAL_MARKETING_LABELS = new Set([
  "доступная цена",
  "качество",
  "надежность",
  "преимущества",
  "применение",
  "универсальность",
  "эффективность",
  "цена",
]);

const NON_PUBLIC_REFERENCE_VALUES = new Set([
  "данные уточняются",
  "категория уточняется",
  "не указано",
  "не указана",
  "не указан",
  "неизвестно",
  "производитель не указан",
]);

const NON_PUBLIC_ADVANTAGES = new Set([
  "профессиональное медицинское применение",
  "надежное решение для медицинских учреждений",
  "используется в клинической практике",
]);

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function publicReferenceText(value: string | null | undefined) {
  const publicValue = publicOptionalText(value);
  if (!publicValue) return null;
  const normalized = plainText(publicValue).toLocaleLowerCase("ru-RU");
  return NON_PUBLIC_REFERENCE_VALUES.has(normalized)
    ? null
    : plainText(publicValue);
}

function truncateAtWord(value: string, maximumLength: number) {
  if (value.length <= maximumLength) return value;
  const candidate = value.slice(0, maximumLength + 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary >= maximumLength * 0.75 ? boundary : maximumLength).trim()}…`;
}

function leadingSentences(value: string, maximumSentences: number) {
  const sentences = value.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
  if (sentences.length < 2) return null;

  const selected = sentences.slice(0, maximumSentences);
  const selectedText = selected.join(" ");
  const nextSentence = sentences[maximumSentences];
  if (
    selectedText.length >= 400 ||
    !nextSentence ||
    selectedText.length + nextSentence.length + 2 > 700
  ) {
    return selectedText;
  }

  const lastSentence = selected.at(-1);
  if (!lastSentence) return selectedText;
  selected[selected.length - 1] = `${lastSentence.replace(/[.!?]+$/u, "")}; ${nextSentence}`;
  return selected.join(" ");
}

function compactSummary(product: Product) {
  const source = publicOptionalText(product.shortDescription);
  if (!source) return null;

  const summary = leadingSentences(plainText(source), 4);
  if (!summary) return null;
  if (summary.length < 80) return null;

  const fullDescription = publicOptionalText(product.description);
  if (fullDescription && summary === plainText(fullDescription)) return null;

  return truncateAtWord(summary, 700);
}

function explicitAdvantages(product: Product) {
  const isEndoMarketSourceTruth = product.commercialPresentation?.source === "endomarket";
  const values = product.keyFeatures
    .map((feature) => plainText(feature).replace(/[.;]+$/gu, ""))
    .filter((feature) =>
      feature.length >= 6 &&
      (isEndoMarketSourceTruth || feature.length <= 160) &&
      !NON_PUBLIC_ADVANTAGES.has(feature.toLocaleLowerCase("ru-RU")),
    );
  const uniqueValues = [...new Set(values)];
  return isEndoMarketSourceTruth ? uniqueValues : uniqueValues.slice(0, 6);
}

function normalizeComparable(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function uniqueModel(product: Product) {
  const model = publicReferenceText(product.model);
  if (!model) return null;
  const normalizedModel = normalizeComparable(model);
  const normalizedName = normalizeComparable(product.name);
  if (!normalizedModel || normalizedName.includes(normalizedModel)) return null;
  return model;
}

function normalizeLabel(label: string) {
  return label.trim().toLocaleLowerCase("ru-RU").replace(/\s+/gu, " ");
}

function hasPublicSpecificationContent(specification: ProductSpecification) {
  return Boolean(
    publicOptionalText(specification.label) &&
    publicOptionalText(specification.value),
  );
}

function hasApprovedProjectionOrigin(specification: ProductSpecification) {
  return specification.recordOrigin === "legacy" ||
    specification.recordOrigin === "structured_product_detail";
}

export function isGeneralProductSpecification(
  specification: ProductSpecification,
) {
  return hasPublicSpecificationContent(specification) &&
    specification.contentKind === "legacy_metadata" &&
    hasApprovedProjectionOrigin(specification);
}

export function isTechnicalProductSpecification(
  specification: ProductSpecification,
) {
  if (specification.contentKind || specification.recordOrigin) {
    return hasPublicSpecificationContent(specification) &&
      specification.contentKind === "technical_specification" &&
      hasApprovedProjectionOrigin(specification);
  }

  const label = normalizeLabel(specification.label);
  return hasPublicSpecificationContent(specification) &&
    !TECHNICAL_METADATA_LABELS.has(label) &&
    !NON_TECHNICAL_MARKETING_LABELS.has(label);
}

export function buildProductDetailExperience({
  product,
  manufacturer,
  category,
}: {
  product: Product;
  manufacturer?: Manufacturer;
  category?: Category;
}): ProductDetailExperience {
  const publicManufacturerName = publicReferenceText(manufacturer?.name);
  const publicCountry = formatCountryForPublic(manufacturer?.country);
  const publicCategoryName = publicReferenceText(category?.name);
  const applicationAreas = product.applicationAreas
    .map(publicReferenceText)
    .filter((area): area is string => area !== null);
  const model = uniqueModel(product);
  const badges: ProductDetailBadge[] = [];

  if (manufacturer && publicManufacturerName) {
    badges.push({
      label: "Производитель",
      value: publicManufacturerName,
      href: `/manufacturers/${manufacturer.slug}`,
    });
  }
  if (publicCountry) badges.push({ label: "Страна", value: publicCountry });
  if (publicCategoryName) {
    badges.push({ label: "Категория", value: publicCategoryName });
  }
  if (model) badges.push({ label: "Модель", value: model });

  return {
    summary: compactSummary(product),
    description: publicOptionalText(product.description)
      ?? publicOptionalText(product.shortDescription),
    advantages: explicitAdvantages(product),
    generalSpecifications: product.specifications
      .filter(isGeneralProductSpecification)
      .sort((left, right) => left.position - right.position),
    technicalSpecifications: product.specifications
      .filter(isTechnicalProductSpecification)
      .sort((left, right) => left.position - right.position),
    manufacturer: manufacturer ?? null,
    category: category ?? null,
    badges,
    applicationAreas,
  };
}
