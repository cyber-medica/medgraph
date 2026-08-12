import { NextResponse } from "next/server";

import {
  isPublishedCatalogSnapshotStale,
  readPublishedCatalogHealth,
} from "@/lib/storefront/published-catalog-resilience";
import { loadCloudPublishedCatalogFresh } from "@/lib/storefront/cloud-published-catalog-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // A health invocation can run in a fresh server isolate. Exercise the same
  // resilient loader as public routes before reporting its sanitized state.
  await loadCloudPublishedCatalogFresh().catch(() => undefined);
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
    snapshotStale: isPublishedCatalogSnapshotStale(),
    lastSuccessfulRefresh: health.lastSuccessfulRefresh,
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
