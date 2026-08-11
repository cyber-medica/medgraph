import { NextRequest, NextResponse } from "next/server";

import { APPROVED_REVIEWER } from "@/lib/internal-auth/constants";
import { resolveInternalAuthOrigin } from "@/lib/internal-auth/policy";
import { readActiveTrustedReviewer } from "@/lib/internal-auth/session";
import {
  applyInternalAuthCookies,
  createInternalAuthRouteClient,
} from "@/lib/internal-auth/supabase.server";
import {
  validateProductionLaunchOperationRequest,
} from "@/lib/operations/production-launch-release-manifest";
import {
  executeProductionLaunchReleasePhase,
  ProductionLaunchReleaseRunnerError,
} from "@/lib/operations/production-launch-release-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  if (!validateProductionLaunchOperationRequest(body)) {
    return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
  }

  try {
    const result = await executeProductionLaunchReleasePhase(body.phase, auth.client);
    return safeJson(result, 200, auth);
  } catch (error) {
    const code = error instanceof ProductionLaunchReleaseRunnerError
      ? error.code
      : "operation_failed";
    return safeJson({ status: "blocked", code }, 409, auth);
  }
}
