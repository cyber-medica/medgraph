import { isApprovedManufacturerLogoUrl } from "./manufacturer-logo-policy.ts";

export function isVerifiedLocalManufacturerLogo(
  url: string | null | undefined,
): url is string {
  return isApprovedManufacturerLogoUrl(url);
}
