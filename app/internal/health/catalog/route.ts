import { NextResponse } from "next/server";

import {
  readPublishedCatalogHealth,
} from "@/lib/storefront/published-catalog-resilience";
import {
  loadCloudPublishedCatalogFresh,
} from "@/lib/storefront/cloud-published-catalog-repository";
import {
  runPublishedCatalogReleaseGate,
} from "@/lib/storefront/published-catalog-release-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // A release probe must actively exercise uncached authoritative transport.
  // Public serving may keep using a validated LKG, but that state fails this
  // stricter operational-current gate.
  let operationallyCurrent = false;
  try {
    await runPublishedCatalogReleaseGate({
      runAuthoritativeCheck: async () => {
        await loadCloudPublishedCatalogFresh();
        return { authoritativeCheckCompleted: true };
      },
      readHealth: readPublishedCatalogHealth,
    });
    operationallyCurrent = true;
  } catch {
    // The sanitized health body below carries only bounded state, never the
    // upstream error or credentials.
  }
  const health = readPublishedCatalogHealth();
  const status = health.liveTransport === "healthy"
    ? "healthy"
    : health.snapshotProductCount > 0
      ? "degraded"
      : "unavailable";
  return NextResponse.json({
    status,
    liveTransport: health.liveTransport,
    projectionVersion: health.projectionVersion,
    projectionChecksumPrefix: health.projectionChecksumPrefix,
    lastKnownGoodAgeSeconds: health.lastKnownGoodAgeSeconds,
    snapshotProductCount: health.snapshotProductCount,
    fallbackActive: health.fallbackActive,
    snapshotStale: health.snapshotStale,
    lastSuccessfulRefresh: health.lastSuccessfulRefresh,
    operationallyCurrent,
  }, {
    status: status === "unavailable" ? 503 : 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
