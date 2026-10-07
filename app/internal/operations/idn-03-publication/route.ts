import { type NextRequest, NextResponse } from "next/server";

import { hasSupabasePrivilegedCredentialConfiguration } from "@/lib/supabase/env";

import { resolveInternalAuthOrigin } from "@/lib/internal-auth/policy";
import { readActiveTrustedReviewer } from "@/lib/internal-auth/session";
import {
  applyInternalAuthCookies,
  createInternalAuthRouteClient,
} from "@/lib/internal-auth/supabase.server";
import {
  IDN_03_PUBLICATION_MANIFEST,
  IDN_03_PUBLICATION_MANIFEST_SHA256,
  validateIdn03PublicationOperationRequest,
} from "@/lib/operations/idn-03-publication-manifest";
import {
  executeProductionIdn03Publication,
  Idn03PublicationRunnerError,
} from "@/lib/operations/idn-03-publication-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeJson(
  body: Readonly<Record<string, unknown>>,
  status: number,
  auth: ReturnType<typeof createInternalAuthRouteClient>,
) {
  return applyInternalAuthCookies(NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  }), auth.pendingCookies, auth.pendingHeaders);
}

export async function POST(request: NextRequest) {
  const auth = createInternalAuthRouteClient(request);
  if (process.env.VERCEL_ENV !== "production") {
    return safeJson({ status: "blocked", code: "production_only" }, 403, auth);
  }
  let origin: string;
  try {
    origin = resolveInternalAuthOrigin();
  } catch {
    return safeJson({ status: "blocked", code: "auth_configuration" }, 503, auth);
  }
  if (
    request.nextUrl.origin !== origin
    || request.headers.get("origin") !== origin
    || request.headers.get("sec-fetch-site") !== "same-origin"
  ) return safeJson({ status: "blocked", code: "same_origin_required" }, 403, auth);

  const active = await readActiveTrustedReviewer(auth.client);
  if (!active || active.access.role !== "admin") {
    return safeJson({ status: "blocked", code: "corporate_admin_required" }, 403, auth);
  }
  if (!process.env.CYBERMEDICA_SUPABASE_URL?.trim()
      || !hasSupabasePrivilegedCredentialConfiguration(process.env)) {
    return safeJson({ status: "blocked", code: "service_configuration_missing" }, 503, auth);
  }

  const raw = await request.text();
  if (raw.length > 512 || request.headers.get("content-type") !== "application/json") {
    return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!validateIdn03PublicationOperationRequest(body)) {
    return safeJson({ status: "blocked", code: "invalid_operation_manifest" }, 400, auth);
  }

  try {
    const result = await executeProductionIdn03Publication(active.user.id);
    return safeJson({
      ...result,
      operationKey: IDN_03_PUBLICATION_MANIFEST.operationKey,
      manifestSha256: IDN_03_PUBLICATION_MANIFEST_SHA256,
    }, 200, auth);
  } catch (error) {
    const code = error instanceof Idn03PublicationRunnerError
      ? error.code
      : "operation_failed";
    return safeJson({ status: "blocked", code }, 409, auth);
  }
}
