import assert from "node:assert/strict";

export const CANONICAL_HOST = "cyber-medica.ru";
export const CANONICAL_ORIGIN_FAMILY = "medgraph";
export const CANDIDATE_FRONT_DOOR = "ru-vps-production-candidate";
export const PRODUCTION_FRONT_DOOR = "ru-vps-production";
export const APPROVED_LEGACY_MEDIA_HOST = "static.tildacdn.com";
export const CANONICAL_CATALOG_CONTENT_PATHS = new Set([
  "/catalog/anesteziologiya/narkozno-dykhatelnye-apparaty",
  "/catalog/endoskopiya",
  "/catalog/endoskopiya/obrabotka-endoskopov",
  "/catalog/endoskopiya/videoendoskopicheskie-sistemy",
  "/catalog/reanimatsiya/transportnye-apparaty-ivl",
]);

export type CanonicalRouteFingerprint = {
  deployment: string;
  origin: string;
  release: string;
};

export type CanonicalDeliveryMarker =
  | typeof CANDIDATE_FRONT_DOOR
  | typeof PRODUCTION_FRONT_DOOR;

const RFQ_METHOD_NOT_ALLOWED_BODY = {
  ok: false,
  error: "Method not allowed",
};

export function readExpectedCanonicalDeliveryMarker(
  environment: Readonly<Record<string, string | undefined>>,
): CanonicalDeliveryMarker {
  const marker = environment.CYBERMEDICA_EXPECTED_DELIVERY_MARKER?.trim();
  assert.ok(marker, "CYBERMEDICA_EXPECTED_DELIVERY_MARKER is required");
  assert.ok(
    marker === CANDIDATE_FRONT_DOOR || marker === PRODUCTION_FRONT_DOOR,
    `unsupported canonical delivery marker: ${marker}`,
  );
  return marker;
}

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

export function assertCanonicalProductionDelivery(
  headers: Headers,
  route: string,
  expectedMarker: string | undefined,
  expectedRelease?: string,
) {
  assert.ok(expectedMarker, "expected canonical delivery marker is required");
  assert.ok(
    expectedMarker === CANDIDATE_FRONT_DOOR || expectedMarker === PRODUCTION_FRONT_DOOR,
    `unsupported canonical delivery marker: ${expectedMarker}`,
  );
  assert.equal(
    headers.get("x-cybermedica-front-door"),
    expectedMarker,
    `${route} is missing the canonical production front-door marker`,
  );
  assert.match(
    headers.get("server") ?? "",
    /^nginx(?:\/|$)/iu,
    `${route} is missing the Nginx front-door fingerprint`,
  );
  if (expectedMarker === CANDIDATE_FRONT_DOOR) {
    assert.ok(
      headers.get("x-vercel-id"),
      `${route} is missing the candidate Vercel upstream request fingerprint`,
    );
  }
  const fingerprint = readCanonicalRouteFingerprint(headers);
  if (expectedRelease !== undefined) {
    assert.match(expectedRelease, /^[0-9a-f]{40}$/u, "expected release SHA is invalid");
    assert.equal(fingerprint.release, expectedRelease, "canonical release SHA is not ready");
  }
  return fingerprint;
}

export function assertCanonicalRfqServiceDelivery(headers: Headers) {
  assert.equal(
    headers.get("x-cybermedica-front-door"),
    PRODUCTION_FRONT_DOOR,
    "/api/request is missing the Production RFQ front-door marker",
  );
  assert.equal(
    headers.get("x-cybermedica-origin"),
    CANONICAL_ORIGIN_FAMILY,
    "/api/request is missing the canonical RFQ origin family",
  );
  assert.match(
    headers.get("server") ?? "",
    /^nginx(?:\/|$)/iu,
    "/api/request is missing the Nginx RFQ delivery fingerprint",
  );
}

export function assertCanonicalRfqMethodNotAllowed(response: Response, bodyText: string) {
  assert.equal(response.status, 405, `GET /api/request returned ${response.status}`);
  assertCanonicalRfqServiceDelivery(response.headers);
  assert.equal(
    response.headers.get("allow")?.trim().toUpperCase(),
    "POST",
    "GET /api/request must advertise POST as the only allowed method",
  );

  const contentType = response.headers.get("content-type") ?? "";
  const [mediaType, ...parameters] = contentType
    .split(";")
    .map((part) => part.trim().toLowerCase());
  assert.equal(mediaType, "application/json", "GET /api/request must return JSON");
  const charset = parameters
    .map((parameter) => parameter.split("=", 2).map((part) => part.trim()))
    .find(([key]) => key === "charset")?.[1]
    ?.replace(/^"|"$/gu, "");
  assert.equal(charset, "utf-8", "GET /api/request JSON must declare UTF-8");

  const cacheDirectives = (response.headers.get("cache-control") ?? "")
    .split(",")
    .map((directive) => directive.trim().toLowerCase().split("=", 1)[0]);
  assert.ok(cacheDirectives.includes("no-store"), "GET /api/request must be no-store");
  assert.equal(
    response.headers.get("x-content-type-options")?.trim().toLowerCase(),
    "nosniff",
    "GET /api/request must disable MIME sniffing",
  );

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    assert.fail("GET /api/request must return a JSON error body");
  }
  assert.deepEqual(body, RFQ_METHOD_NOT_ALLOWED_BODY, "GET /api/request returned an unexpected error body");
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

export function extractStylesheetUrls(html: string, documentUrl: URL) {
  return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/gu)]
    .map((match) => new URL(match[1], documentUrl));
}

export function assertStylesheetResponse(
  response: Response,
  body: string,
  expectedDeploymentHost: string,
) {
  const url = new URL(response.url);
  assert.equal(url.hostname, expectedDeploymentHost, "stylesheet escaped its deployment-pinned host");
  assert.equal(response.status, 200, `stylesheet returned ${response.status}`);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/css(?:;|$)/iu,
    "stylesheet MIME is not text/css",
  );
  assert.match(
    response.headers.get("cache-control") ?? "",
    /immutable/iu,
    "stylesheet is not immutable",
  );
  assert.ok(body.trim().length > 1_000, "stylesheet body is unexpectedly small");
  assert.doesNotMatch(body, /<!doctype html|<html/iu, "stylesheet returned an HTML shell");
}
