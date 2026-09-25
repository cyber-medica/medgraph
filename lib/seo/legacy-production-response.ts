import {
  resolveLegacyProductionRoute,
  type LegacyProductionRouteResolution,
} from "./legacy-production-redirects.ts";

type LegacyProductionRouteResolver = (
  url: URL,
) => LegacyProductionRouteResolution;

/** Converts the inventory decision into the complete HTTP response contract. */
export function buildLegacyProductionResponse(
  url: URL,
  resolve: LegacyProductionRouteResolver = resolveLegacyProductionRoute,
): Response | null {
  const resolution = resolve(url);
  if (!resolution) return null;

  if (resolution.status === 410) {
    return new Response(null, {
      status: 410,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  return new Response(null, {
    status: 301,
    headers: {
      Location: new URL(resolution.destination, url.origin).toString(),
    },
  });
}
