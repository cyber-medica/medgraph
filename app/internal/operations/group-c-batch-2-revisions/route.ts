import { NextRequest, NextResponse } from "next/server";

import { resolveInternalAuthOrigin } from "@/lib/internal-auth/policy";
import { readActiveTrustedReviewer } from "@/lib/internal-auth/session";
import {
  applyInternalAuthCookies,
  createInternalAuthRouteClient,
} from "@/lib/internal-auth/supabase.server";
import {
  GROUP_C_BATCH_2_REVISION_MANIFEST_SHA256,
  validateGroupCBatch2RevisionOperationRequest,
} from "@/lib/operations/group-c-batch-2-revision-manifest";
import {
  executeProductionGroupCBatch2RevisionCreation,
  GroupCBatch2RevisionRunnerError,
} from "@/lib/operations/group-c-batch-2-revision-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      { status: 403, headers: { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } },
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
  if (active.access.role !== "admin") {
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
  if (!validateGroupCBatch2RevisionOperationRequest(body)) {
    return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
  }

  try {
    const result = await executeProductionGroupCBatch2RevisionCreation();
    return safeJson({
      status: result.status,
      operationKey: result.operationKey,
      manifestSha256: GROUP_C_BATCH_2_REVISION_MANIFEST_SHA256,
      created: result.created,
      revisions: result.revisions,
      totals: result.totals,
      projectionVersion: result.projectionVersion,
    }, 200, auth);
  } catch (error) {
    const code = error instanceof GroupCBatch2RevisionRunnerError
      ? error.code
      : "operation_failed";
    return safeJson({ status: "blocked", code }, 409, auth);
  }
}
