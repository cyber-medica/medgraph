export type StorefrontDataSource = "static" | "cloud_preview" | "cloud_published";

export const ENDOMARKET_STAGE_PREVIEW_BRANCH =
  "codex/endomarket-catalog-integration-stage-v1";
export const FINAL_STAGE_ACCEPTANCE_PREVIEW_BRANCH =
  "codex/final-stage-acceptance-corrective-v2";
export const MANUFACTURER_LOGO_NAVIGATION_PREVIEW_BRANCH =
  "codex/all-manufacturer-logos-breadcrumbs-stage-v1";
export const PRODUCT_STRUCTURED_DATA_GSC_PREVIEW_BRANCH =
  "codex/product-structured-data-gsc-corrective-v1";

const ENDOMARKET_STAGE_PREVIEW_BRANCHES = new Set([
  ENDOMARKET_STAGE_PREVIEW_BRANCH,
  FINAL_STAGE_ACCEPTANCE_PREVIEW_BRANCH,
]);

export function isEndoMarketStagePreview(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (environment.VERCEL_ENV === "production") return false;
  const exactVercelPreview = environment.VERCEL_ENV === "preview"
    && ENDOMARKET_STAGE_PREVIEW_BRANCHES.has(
      environment.VERCEL_GIT_COMMIT_REF ?? "",
    );
  const explicitVercelPreview = environment.VERCEL_ENV === "preview"
    && environment.VERCEL === "1"
    && environment.CYBERMEDICA_ENDOMARKET_STAGE === "1";
  const explicitLocalQa = environment.VERCEL_ENV === undefined
    && environment.VERCEL !== "1"
    && environment.CYBERMEDICA_ENDOMARKET_STAGE === "1";
  return exactVercelPreview || explicitVercelPreview || explicitLocalQa;
}

/**
 * The logo/navigation acceptance Stage must render the same public graph that
 * was captured in the checksum-validated 114-Product LKG snapshot. Keeping
 * this exact-branch gate separate avoids granting a Preview runtime access to
 * Production credentials or changing any shared Preview catalog state.
 */
export function isManufacturerLogoNavigationStagePreview(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const exactGitPreview = environment.VERCEL_ENV === "preview"
    && environment.VERCEL_GIT_COMMIT_REF === MANUFACTURER_LOGO_NAVIGATION_PREVIEW_BRANCH;
  const explicitCliPreview = environment.VERCEL_ENV === "preview"
    && environment.VERCEL === "1"
    && environment.CYBERMEDICA_MANUFACTURER_LOGO_STAGE === "1";
  return exactGitPreview || explicitCliPreview;
}

/**
 * The GSC corrective Preview uses the validated 114-Product LKG projection so
 * its JSON-LD can be audited without Production credentials or draft leakage.
 */
export function isProductStructuredDataGscStagePreview(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (environment.VERCEL_ENV === "production") return false;
  const exactGitPreview = environment.VERCEL_ENV === "preview"
    && environment.VERCEL_GIT_COMMIT_REF === PRODUCT_STRUCTURED_DATA_GSC_PREVIEW_BRANCH;
  const explicitCliPreview = environment.VERCEL_ENV === "preview"
    && environment.VERCEL === "1"
    && environment.CYBERMEDICA_STRUCTURED_DATA_GSC_STAGE === "1";
  return exactGitPreview || explicitCliPreview;
}

export function getStorefrontDataSource(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): StorefrontDataSource {
  if (isManufacturerLogoNavigationStagePreview(environment)) return "cloud_preview";
  if (isProductStructuredDataGscStagePreview(environment)) return "cloud_preview";
  if (isEndoMarketStagePreview(environment)) return "cloud_preview";
  const value = environment.CATALOG_DATA_SOURCE?.trim() || "static";
  if (value !== "static" && value !== "cloud_preview" && value !== "cloud_published") {
    throw new Error(`Unsupported Storefront CATALOG_DATA_SOURCE: ${value}`);
  }
  if (value === "cloud_preview" && environment.VERCEL_ENV === "production") {
    throw new Error("cloud_preview is forbidden in the Vercel Production environment.");
  }
  return value;
}

export function isCloudPreviewCatalog(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return getStorefrontDataSource(environment) === "cloud_preview";
}

export function isCloudPublishedCatalog(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return getStorefrontDataSource(environment) === "cloud_published";
}
