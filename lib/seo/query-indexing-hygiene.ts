/**
 * Query parameters used only to isolate or diagnose automated public-route
 * checks. They must remain available to the runtime, but their URL variants
 * must not become standalone search documents.
 */
export const SYNTHETIC_DEBUG_QUERY_PARAMETERS = [
  "lh",
  "mobile_synthetic",
  "webkit_diagnostic",
  "r9_smoke",
] as const;

export const COMMERCIAL_ATTRIBUTION_QUERY_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "yclid",
] as const;

export const QUERY_INDEXING_HYGIENE_HEADER =
  "X-CyberMedica-Query-Hygiene";
export const QUERY_INDEXING_HYGIENE_HEADER_VALUE =
  "synthetic-debug-noindex";
export const SYNTHETIC_DEBUG_ROBOTS_DIRECTIVE = "noindex, follow";

export function hasSyntheticDebugQueryParameter(
  searchParams: Pick<URLSearchParams, "has">,
) {
  return SYNTHETIC_DEBUG_QUERY_PARAMETERS.some((name) =>
    searchParams.has(name),
  );
}

/**
 * Next.js applies every matching `has` entry conjunctively, so each technical
 * query key needs its own rule. The rules set response metadata only: they do
 * not redirect, rewrite, or remove query parameters from the application.
 */
export function buildSyntheticDebugQueryHeaderRules() {
  return SYNTHETIC_DEBUG_QUERY_PARAMETERS.map((key) => ({
    source: "/(.*)",
    has: [{ type: "query" as const, key }],
    headers: [
      { key: "X-Robots-Tag", value: SYNTHETIC_DEBUG_ROBOTS_DIRECTIVE },
      {
        key: QUERY_INDEXING_HYGIENE_HEADER,
        value: QUERY_INDEXING_HYGIENE_HEADER_VALUE,
      },
    ],
  }));
}
