import type { Manufacturer } from "./types.ts";

export const MANUFACTURER_LOGO_USAGE_STATUSES = [
  "PERMISSION_REQUIRED",
  "RIGHTS_REVIEW",
  "READY_WITH_TERMS",
  "READY_WITH_GUIDELINES",
  "ASSET_UNRESOLVED",
] as const;

export type ManufacturerLogoUsageStatus =
  (typeof MANUFACTURER_LOGO_USAGE_STATUSES)[number];

interface ManufacturerLogoPolicyEntry {
  slug: string;
  usageStatus: ManufacturerLogoUsageStatus;
  sourceUrl: string;
  assetUrl: string | null;
  assetSha256: string | null;
}

export const MANUFACTURER_LOGO_POLICY: readonly ManufacturerLogoPolicyEntry[] = [
  { slug: "ambu", usageStatus: "PERMISSION_REQUIRED", sourceUrl: "https://www.ambu.com/corporate-info/media/image-bank/logo", assetUrl: null, assetSha256: null },
  { slug: "aohua", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.aohua.com/en/", assetUrl: null, assetSha256: null },
  { slug: "b-braun", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.bbraun.com/en/about-us/company/brand.html", assetUrl: null, assetSha256: null },
  { slug: "bionet", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.ebionet.com/medical/", assetUrl: null, assetSha256: null },
  { slug: "biotech-m", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://biotech-medical.ru/", assetUrl: null, assetSha256: null },
  { slug: "bowa", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.bowa-medical.com/", assetUrl: null, assetSha256: null },
  { slug: "canon-medical-systems", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://global.medical.canon/", assetUrl: null, assetSha256: null },
  { slug: "comen", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://en.comen.com/", assetUrl: null, assetSha256: null },
  { slug: "dixion", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://dixion.ru/", assetUrl: null, assetSha256: null },
  { slug: "drager", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.draeger.com/", assetUrl: null, assetSha256: null },
  { slug: "electron", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.elektron.ru/", assetUrl: null, assetSha256: null },
  { slug: "erbe", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://en.erbegroup.com/en-en/company/press-information/", assetUrl: null, assetSha256: null },
  { slug: "fresenius-kabi", usageStatus: "READY_WITH_TERMS", sourceUrl: "https://www.fresenius-kabi.com/de/downloads/downloadbereich-logo-fresenius-kabi-deutschland", assetUrl: "/manufacturers/fresenius-kabi/logo.png", assetSha256: "a6c339f1784f9df5f69fbc3d04fc0930eb425ea5aa854eb0062873b51600a883" },
  { slug: "ge-healthcare", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://brand.gehealthcare.com/", assetUrl: null, assetSha256: null },
  { slug: "hamilton-medical", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.hamilton-medical.com/", assetUrl: null, assetSha256: null },
  { slug: "huger", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.huger.cn/", assetUrl: null, assetSha256: null },
  { slug: "huntleigh", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.huntleigh-diagnostics.com/", assetUrl: null, assetSha256: null },
  { slug: "ilivtouch", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://ilivtouch.ru/", assetUrl: null, assetSha256: null },
  { slug: "longfian", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.longfian.com/", assetUrl: null, assetSha256: null },
  { slug: "medinova", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.medinova.ru/", assetUrl: null, assetSha256: null },
  { slug: "met", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://met-company.ru/", assetUrl: null, assetSha256: null },
  { slug: "mindray", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.mindray.com/en/media-center/press/mindray-new-logo-launch-announcement", assetUrl: null, assetSha256: null },
  { slug: "monitor", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.monitor-ltd.ru/", assetUrl: null, assetSha256: null },
  { slug: "olympus", usageStatus: "READY_WITH_GUIDELINES", sourceUrl: "https://www.olympusamerica.com/news-media/column-media/olympus-logos", assetUrl: "/manufacturers/olympus/logo.png", assetSha256: "24e0348689afdcaa18224f424145625ae3dddb4398f5a2f47f6aec9876d0a330" },
  { slug: "pentax-medical", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.pentaxmedical.com/en", assetUrl: null, assetSha256: null },
  { slug: "philips", usageStatus: "PERMISSION_REQUIRED", sourceUrl: "https://www.philips.com/a-w/about/news/media-library/2024-Philips-Wordmark.html", assetUrl: null, assetSha256: null },
  { slug: "sonoscape", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.sonoscape.com/en/", assetUrl: null, assetSha256: null },
  { slug: "trismed", usageStatus: "ASSET_UNRESOLVED", sourceUrl: "https://www.mfds.go.kr/eng/brd/m_41/view.do?seq=70318", assetUrl: null, assetSha256: null },
  { slug: "unicos", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://unicosme.ru/", assetUrl: null, assetSha256: null },
  { slug: "uomz", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://uomz.su/", assetUrl: null, assetSha256: null },
  { slug: "zerts", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://zerts.ru/", assetUrl: null, assetSha256: null },
] as const;

const policyBySlug = new Map(
  MANUFACTURER_LOGO_POLICY.map((entry) => [entry.slug, entry]),
);

export interface ManufacturerLogoPresentation {
  kind: "graphic" | "fallback";
  name: string;
  slug: string;
  alt: string;
  monogram: string;
  assetUrl: string | null;
  usageStatus: ManufacturerLogoUsageStatus | "UNLISTED";
  fallbackReason: string | null;
}

function manufacturerMonogram(name: string) {
  const words = name
    .replace(/[«»“”"']/gu, " ")
    .split(/[^\p{L}\p{N}]+/gu)
    .filter(Boolean);
  const letters = words.length > 1
    ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`
    : (words[0] ?? name).slice(0, 2);
  return letters.toLocaleUpperCase("ru-RU") || "МТ";
}

function fallbackReason(status: ManufacturerLogoPresentation["usageStatus"]) {
  switch (status) {
    case "PERMISSION_REQUIRED":
      return "Требуется документированное разрешение на коммерческое использование.";
    case "RIGHTS_REVIEW":
      return "Коммерческие права на использование graphic asset не подтверждены.";
    case "ASSET_UNRESOLVED":
      return "Официальный graphic asset не подтверждён.";
    case "UNLISTED":
      return "Производитель отсутствует в утверждённом logo manifest.";
    default:
      return null;
  }
}

export function getManufacturerLogoPresentation(
  manufacturer: Pick<Manufacturer, "slug" | "name">,
): ManufacturerLogoPresentation {
  const policy = policyBySlug.get(manufacturer.slug);
  const usageStatus = policy?.usageStatus ?? "UNLISTED";
  const assetUrl = policy?.assetUrl ?? null;
  return {
    kind: assetUrl ? "graphic" : "fallback",
    name: manufacturer.name,
    slug: manufacturer.slug,
    alt: `${manufacturer.name} — логотип`,
    monogram: manufacturerMonogram(manufacturer.name),
    assetUrl,
    usageStatus,
    fallbackReason: assetUrl ? null : fallbackReason(usageStatus),
  };
}

export function getApprovedManufacturerLogoUrl(slug: string) {
  return policyBySlug.get(slug)?.assetUrl ?? null;
}

export function isApprovedManufacturerLogoUrl(url: string | null | undefined): url is string {
  return Boolean(
    url && MANUFACTURER_LOGO_POLICY.some((entry) => entry.assetUrl === url),
  );
}
