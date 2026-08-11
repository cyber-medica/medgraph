import assert from "node:assert/strict";

export const CANONICAL_HOST = "cyber-medica.ru";
export const CANONICAL_ORIGIN_FAMILY = "medgraph";
export const APPROVED_LEGACY_MEDIA_HOST = "static.tildacdn.com";
export const CANONICAL_CATALOG_CONTENT_PATHS = new Set([
  "/catalog/endoskopiya",
  "/catalog/endoskopiya/obrabotka-endoskopov",
  "/catalog/endoskopiya/videoendoskopicheskie-sistemy",
]);

export type CanonicalRouteFingerprint = {
  deployment: string;
  origin: string;
  release: string;
};

export function safeRoutingHeaderValue(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  if (!normalized || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) return fallback;
  return normalized;
}

export function stripApprovedLegacyMediaReferences(body: string) {
  return body.replace(
    /https:\/\/static\.tildacdn\.com\/[^\s"'<>\\]+/giu,
    "[approved-published-media]",
  );
}

export function assertNoLegacyPageShell(body: string, route: string) {
  const routingSurface = stripApprovedLegacyMediaReferences(body);
  assert.doesNotMatch(
    routingSurface,
    /made\s+on\s+tilda|tilda-blocks-page|tilda\.cc|medvist\.ru|ООО\s+[«"]?КиберМедика[»"]?,?\s*2019/iu,
    `${route} contains a legacy Tilda/medvist page-shell marker`,
  );
}

export function readCanonicalRouteFingerprint(headers: Headers): CanonicalRouteFingerprint {
  const fingerprint = {
    deployment: headers.get("x-cybermedica-deployment") ?? "",
    origin: headers.get("x-cybermedica-origin") ?? "",
    release: headers.get("x-cybermedica-release") ?? "",
  };
  assert.equal(fingerprint.origin, CANONICAL_ORIGIN_FAMILY, "unexpected canonical origin family");
  assert.ok(fingerprint.deployment.length > 0, "canonical deployment fingerprint is missing");
  assert.ok(fingerprint.release.length > 0, "canonical release fingerprint is missing");
  return fingerprint;
}

export function assertSameCanonicalFingerprint(
  expected: CanonicalRouteFingerprint,
  actual: CanonicalRouteFingerprint,
  route: string,
) {
  assert.deepEqual(actual, expected, `${route} is not served by the canonical deployment family`);
}

export function extractCatalogProductPaths(html: string) {
  return new Set(
    [...html.matchAll(/href="(\/catalog\/[^"#?]+)"/gu)]
      .map((match) => match[1])
      .filter((path) => !CANONICAL_CATALOG_CONTENT_PATHS.has(path)),
  );
}

export function extractSitemapProductPaths(xml: string) {
  return new Set(
    [...xml.matchAll(/<loc>https:\/\/cyber-medica\.ru(\/catalog\/[^<]+)<\/loc>/gu)]
      .map((match) => match[1])
      .filter((path) => !CANONICAL_CATALOG_CONTENT_PATHS.has(path)),
  );
}
