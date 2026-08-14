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
  assetWidth?: number;
  assetHeight?: number;
  assetSurface?: "light" | "dark";
  opticalScale?: number;
  metadataEligible?: boolean;
}

export const MANUFACTURER_LOGO_POLICY: readonly ManufacturerLogoPolicyEntry[] = [
  { slug: "ambu", usageStatus: "PERMISSION_REQUIRED", sourceUrl: "https://www.ambu.com/corporate-info/media/image-bank/logo", assetUrl: null, assetSha256: null },
  { slug: "aohua", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.aohua.com/en/", assetUrl: null, assetSha256: null },
  { slug: "b-braun", usageStatus: "READY_WITH_GUIDELINES", sourceUrl: "https://www.bbraun.com/en/about-us/company/brand.html", assetUrl: "/manufacturers/b-braun/logo.svg", assetSha256: "daea6df088b4c38074d26867a17c5062b6b9702356d223e2116cdc333effdb9d", assetWidth: 172, assetHeight: 42 },
  { slug: "bionet", usageStatus: "READY_WITH_GUIDELINES", sourceUrl: "https://www.ebionet.com/medical/", assetUrl: "/manufacturers/bionet/logo.svg", assetSha256: "b42edc16fbbd143fa514afb57a5ec0cd69cd94ccb8df30ed5f760dca915156b5", assetWidth: 3832, assetHeight: 1019 },
  { slug: "biotech-m", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://biotech-medical.ru/", assetUrl: null, assetSha256: null },
  { slug: "bowa", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.bowa-medical.com/", assetUrl: "/manufacturers/bowa/logo.webp", assetSha256: "493b69be90ca21118720543ed50995f297710c25f9bd16f69112be311547d1cb", assetWidth: 600, assetHeight: 146, opticalScale: 0.9 },
  { slug: "canon-medical-systems", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://global.medical.canon/", assetUrl: "/manufacturers/canon-medical-systems/logo.svg", assetSha256: "f9e6a47014e5206fff5e78040b2b5f1de9f32c64341e8b69260f557659578c12", assetWidth: 2553, assetHeight: 125, opticalScale: 0.94 },
  { slug: "comen", usageStatus: "READY_WITH_GUIDELINES", sourceUrl: "https://en.comen.com/", assetUrl: "/manufacturers/comen/logo.png", assetSha256: "2e45b04e9a91d35770ab9c545f930fff989a4394b09b1c035bee4fe1479056e0", assetWidth: 565, assetHeight: 91 },
  { slug: "dixion", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://dixion.ru/", assetUrl: "/manufacturers/dixion/logo.jpg", assetSha256: "07bcaf1f1c263ae1c36d5d88e30347d3de8a5d8ae84d25bda789aa4eb1457d82", assetWidth: 170, assetHeight: 39, opticalScale: 0.88 },
  { slug: "drager", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.draeger.com/", assetUrl: null, assetSha256: null },
  { slug: "electron", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://electronxray.com/", assetUrl: "/manufacturers/electron/logo.svg", assetSha256: "032a6b38997847fce7183980a6d6cd54f91ee93ae76acbcfced5e4a6626b61ad", assetWidth: 233, assetHeight: 50, assetSurface: "dark", opticalScale: 0.92 },
  { slug: "erbe", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://en.erbegroup.com/en-en/company/press-information/", assetUrl: "/manufacturers/erbe/logo.png", assetSha256: "e251cf08eb0f7380acfee85c40202c3901b08145207ac404154c35f6ac19330a", assetWidth: 2501, assetHeight: 410, opticalScale: 0.9 },
  { slug: "fresenius-kabi", usageStatus: "READY_WITH_TERMS", sourceUrl: "https://www.fresenius-kabi.com/de/downloads/downloadbereich-logo-fresenius-kabi-deutschland", assetUrl: "/manufacturers/fresenius-kabi/logo.png", assetSha256: "a6c339f1784f9df5f69fbc3d04fc0930eb425ea5aa854eb0062873b51600a883", assetWidth: 1200, assetHeight: 323, metadataEligible: true },
  { slug: "ge-healthcare", usageStatus: "READY_WITH_GUIDELINES", sourceUrl: "https://brand.gehealthcare.com/", assetUrl: "/manufacturers/ge-healthcare/logo.png", assetSha256: "24ba4080fa302c61bbe47a57edbbe2632152d6286c7e6d33c797fc099672d82a", assetWidth: 332, assetHeight: 72, assetSurface: "dark" },
  { slug: "hamilton-medical", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.hamilton-medical.com/", assetUrl: "/manufacturers/hamilton-medical/logo.svg", assetSha256: "711f165d390cc515daceb7cd8942fb3d8aa69f0fb59fa1993b3ca59c59c6ea32", assetWidth: 640, assetHeight: 123, opticalScale: 0.92 },
  { slug: "huger", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.huger.cn/", assetUrl: null, assetSha256: null },
  { slug: "huntleigh", usageStatus: "READY_WITH_GUIDELINES", sourceUrl: "https://www.huntleigh-diagnostics.com/", assetUrl: "/manufacturers/huntleigh/logo.png", assetSha256: "0e6a721f3baebbc146b386c68804496363e2a7bf26e68d4f8a2110d2b4e79bc9", assetWidth: 392, assetHeight: 91 },
  { slug: "ilivtouch", usageStatus: "ASSET_UNRESOLVED", sourceUrl: "https://ilivtouch.ru/", assetUrl: null, assetSha256: null },
  { slug: "longfian", usageStatus: "ASSET_UNRESOLVED", sourceUrl: "https://www.longfian.com/", assetUrl: null, assetSha256: null },
  { slug: "medinova", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://medinova.ru/", assetUrl: "/manufacturers/medinova/logo.svg", assetSha256: "08464e96c62e0f1ab8713239b50b98875528b3ab6fe0035c0c8b8272a53ad476", assetWidth: 1722, assetHeight: 477, opticalScale: 0.9 },
  { slug: "met", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://met-company.ru/", assetUrl: "/manufacturers/met/logo.svg", assetSha256: "3425a5512be4f069114844916666c2ecf8f75c145a770df3425ab60188e96411", assetWidth: 159, assetHeight: 81, opticalScale: 0.8 },
  { slug: "mindray", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.mindray.com/en/media-center/press/mindray-new-logo-launch-announcement", assetUrl: "/manufacturers/mindray/logo.svg", assetSha256: "f07cb65dbc5a5dfe578adc01262701255d1b8edbddeb101b048abd3d33db5201", assetWidth: 601, assetHeight: 143, opticalScale: 0.92 },
  { slug: "monitor", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.monitor-ltd.ru/", assetUrl: "/manufacturers/monitor/logo.png", assetSha256: "cecde0affa42e4b94825ff5dfca432e3b158b57dbf075eba9bc8ba7ad649f13e", assetWidth: 233, assetHeight: 41, opticalScale: 0.9 },
  { slug: "olympus", usageStatus: "READY_WITH_GUIDELINES", sourceUrl: "https://www.olympusamerica.com/news-media/column-media/olympus-logos", assetUrl: "/manufacturers/olympus/logo.png", assetSha256: "24e0348689afdcaa18224f424145625ae3dddb4398f5a2f47f6aec9876d0a330", assetWidth: 1470, assetHeight: 282, metadataEligible: true },
  { slug: "pentax-medical", usageStatus: "READY_WITH_GUIDELINES", sourceUrl: "https://www.pentaxmedical.com/en", assetUrl: "/manufacturers/pentax-medical/logo.svg", assetSha256: "30947445e14687837fe8391eaf9c762e780add6cb950ccdd97c5a86d55281307", assetWidth: 226, assetHeight: 84 },
  { slug: "philips", usageStatus: "PERMISSION_REQUIRED", sourceUrl: "https://www.philips.com/a-w/about/news/media-library/2024-Philips-Wordmark.html", assetUrl: null, assetSha256: null },
  { slug: "sonoscape", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://www.sonoscape.com/en/", assetUrl: "/manufacturers/sonoscape/logo.svg", assetSha256: "679de216709cbb5ab96ec9fc9fb09240a08f6716b8f0388f1bc10f67151bb705", assetWidth: 130, assetHeight: 24, opticalScale: 0.9 },
  { slug: "trismed", usageStatus: "RIGHTS_REVIEW", sourceUrl: "http://www.trismed.com/2014/eng/", assetUrl: "/manufacturers/trismed/logo.jpg", assetSha256: "656c1bdce841cc68fb29a70bd03054f18ece1f817264900184bc695dce1620a8", assetWidth: 1134, assetHeight: 314, opticalScale: 0.88 },
  { slug: "unicos", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://unicosme.ru/", assetUrl: null, assetSha256: null },
  { slug: "uomz", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://uomz.su/", assetUrl: "/manufacturers/uomz/logo.jpg", assetSha256: "1f188486d394af1bb2ee5a9727bc202a975ac415ca23aad24e5bff95c8f587c2", assetWidth: 453, assetHeight: 217, opticalScale: 0.78 },
  { slug: "zerts", usageStatus: "RIGHTS_REVIEW", sourceUrl: "https://zerts.ru/", assetUrl: "/manufacturers/zerts/logo.svg", assetSha256: "6715a91d805577dbc55f71d55a79da1ad731246c4721fe83c56419f229a703f9", assetWidth: 239, assetHeight: 56, opticalScale: 0.9 },
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
  assetWidth: number;
  assetHeight: number;
  assetSurface: "light" | "dark";
  opticalScale: number;
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
    assetWidth: policy?.assetWidth ?? 200,
    assetHeight: policy?.assetHeight ?? 56,
    assetSurface: policy?.assetSurface ?? "light",
    opticalScale: policy?.opticalScale ?? 0.9,
    usageStatus,
    fallbackReason: assetUrl ? null : fallbackReason(usageStatus),
  };
}

export function getApprovedManufacturerLogoUrl(slug: string) {
  const policy = policyBySlug.get(slug);
  return policy?.metadataEligible === true ? policy.assetUrl : null;
}

export function isApprovedManufacturerLogoUrl(url: string | null | undefined): url is string {
  return Boolean(
    url && MANUFACTURER_LOGO_POLICY.some((entry) => entry.assetUrl === url),
  );
}
