import { NextRequest, NextResponse } from "next/server";

import { resolveInternalAuthOrigin } from "@/lib/internal-auth/policy";
import { readActiveTrustedReviewer } from "@/lib/internal-auth/session";
import {
  applyInternalAuthCookies,
  createInternalAuthRouteClient,
} from "@/lib/internal-auth/supabase.server";
import {
  CATALOG_WAVE_1_MANIFEST_SHA256,
  validateCatalogWave1OperationRequest,
} from "@/lib/operations/catalog-wave-1-manifest";
import {
  CatalogWave1RunnerError,
  executeProductionCatalogWave1,
} from "@/lib/operations/catalog-wave-1-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeJson(
  body: Readonly<Record<string, unknown>>,
  status: number,
  auth: ReturnType<typeof createInternalAuthRouteClient>,
) {
  const response = NextResponse.json(body, { status });
  return applyInternalAuthCookies(response, auth.pendingCookies, auth.pendingHeaders);
}

function productionEnvironmentPresent() {
  return Boolean(
    process.env.CYBERMEDICA_SUPABASE_URL?.trim()
    && process.env.CYBERMEDICA_SUPABASE_PROJECT_REF?.trim()
    && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { status: "blocked", code: "production_only" },
      {
        status: 403,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Referrer-Policy": "no-referrer",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }
  const auth = createInternalAuthRouteClient(request);

  let canonicalOrigin: string;
  try {
    canonicalOrigin = resolveInternalAuthOrigin();
  } catch {
    return safeJson({ status: "blocked", code: "auth_configuration" }, 503, auth);
  }
  if (
    request.nextUrl.origin !== canonicalOrigin
    || request.headers.get("origin") !== canonicalOrigin
    || request.headers.get("sec-fetch-site") !== "same-origin"
  ) {
    return safeJson({ status: "blocked", code: "same_origin_required" }, 403, auth);
  }

  const active = await readActiveTrustedReviewer(auth.client);
  if (!active) {
    return safeJson({ status: "blocked", code: "authentication_required" }, 401, auth);
  }
  if (!productionEnvironmentPresent()) {
    return safeJson({ status: "blocked", code: "service_configuration_missing" }, 503, auth);
  }
  if (active.access.role !== "admin") {
    return safeJson({ status: "blocked", code: "admin_required" }, 403, auth);
  }

  const rawBody = await request.text();
  if (rawBody.length > 512) {
    return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  let body: unknown;
  if (contentType === "application/json") {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
    }
  } else if (contentType === "application/x-www-form-urlencoded") {
    const form = new URLSearchParams(rawBody);
    body = Object.fromEntries(form.entries());
  } else {
    return safeJson({ status: "blocked", code: "same_origin_required" }, 403, auth);
  }
  if (!validateCatalogWave1OperationRequest(body)) {
    return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
  }
  try {
    const result = await executeProductionCatalogWave1();
    return safeJson({
      status: result.status,
      operationKey: result.operationKey,
      manifestSha256: CATALOG_WAVE_1_MANIFEST_SHA256,
      approvals: result.approvals,
      publications: result.publications,
      totals: result.totals,
      remainingReviewedUnpublished: result.remainingReviewedUnpublished,
    }, 200, auth);
  } catch (error) {
    const code = error instanceof CatalogWave1RunnerError
      ? error.code
      : "operation_failed";
    return safeJson({ status: "blocked", code }, 409, auth);
  }
}
