import { NextRequest, NextResponse } from "next/server";

import { APPROVED_REVIEWER } from "@/lib/internal-auth/constants";
import { resolveInternalAuthOrigin } from "@/lib/internal-auth/policy";
import { readActiveTrustedReviewer } from "@/lib/internal-auth/session";
import {
  applyInternalAuthCookies,
  createInternalAuthRouteClient,
} from "@/lib/internal-auth/supabase.server";
import {
  PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST_SHA256,
  validateProductCharacteristicsWave1PatchOperationRequest,
} from "@/lib/operations/product-characteristics-wave-1-patch-manifest";
import {
  executeProductionProductCharacteristicsWave1Patches,
  ProductCharacteristicsWave1PatchRunnerError,
} from "@/lib/operations/product-characteristics-wave-1-patch-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function safeJson(
  body: Readonly<Record<string, unknown>>,
  status: number,
  auth: ReturnType<typeof createInternalAuthRouteClient>,
) {
  const response = NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
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
      { status: 403, headers: { "Cache-Control": "private, no-store, max-age=0" } },
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
  if (
    active.user.id !== APPROVED_REVIEWER.userId
    || active.user.email?.trim().toLowerCase() !== APPROVED_REVIEWER.email
    || APPROVED_REVIEWER.role !== "admin"
  ) {
    return safeJson({ status: "blocked", code: "corporate_admin_required" }, 403, auth);
  }
  if (!productionEnvironmentPresent()) {
    return safeJson({ status: "blocked", code: "service_configuration_missing" }, 503, auth);
  }

  const rawBody = await request.text();
  if (rawBody.length > 512 || request.headers.get("content-type") !== "application/json") {
    return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
  }
  if (!validateProductCharacteristicsWave1PatchOperationRequest(body)) {
    return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
  }

  try {
    const result = await executeProductionProductCharacteristicsWave1Patches();
    return safeJson({
      status: result.status,
      operationKey: result.operationKey,
      manifestSha256: PRODUCT_CHARACTERISTICS_WAVE_1_PATCH_MANIFEST_SHA256,
      applied: result.applied,
      alreadyApplied: result.alreadyApplied,
      replay: result.replay,
      patches: result.patches,
      publishedProducts: result.publishedProducts,
      projectionInvariant: result.projectionHashBefore === result.projectionHashAfter,
    }, 200, auth);
  } catch (error) {
    const code = error instanceof ProductCharacteristicsWave1PatchRunnerError
      ? error.code
      : "operation_failed";
    return safeJson({ status: "blocked", code }, 409, auth);
  }
}
