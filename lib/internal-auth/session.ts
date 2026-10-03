import "server-only";

import { redirect } from "next/navigation";

import { AUTH_ERROR_CODES, INTERNAL_LOGIN_PATH } from "./constants.ts";
import { isApprovedCorporateSessionClaims } from "./claims.ts";
import {
  isApprovedInternalAccess,
  isApprovedInternalAdminAccess,
  normalizeEmail,
} from "./policy.ts";
import { createInternalAuthServerClient } from "./supabase.server.ts";

export async function readCurrentInternalAccess(
  supabase: Awaited<ReturnType<typeof createInternalAuthServerClient>>,
) {
  const { data, error } = await supabase
    .schema("cloud_api")
    .rpc("current_internal_access_v1");
  if (error) return null;
  return data;
}

export async function readActiveTrustedReviewer(
  supabase: Awaited<ReturnType<typeof createInternalAuthServerClient>>,
) {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData || !isApprovedCorporateSessionClaims(claimsData.claims)) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (
    error
    || !data.user
    || data.user.id !== claimsData.claims.sub
    || normalizeEmail(data.user.email ?? "") !== normalizeEmail(claimsData.claims.email)
  ) return null;
  const access = await readCurrentInternalAccess(supabase);
  if (!isApprovedInternalAccess(data.user, access)) return null;
  return { user: data.user, sessionId: claimsData.claims.session_id, access };
}

export async function getTrustedReviewer() {
  const supabase = await createInternalAuthServerClient();
  const active = await readActiveTrustedReviewer(supabase);
  return active?.user ?? null;
}

export async function requireTrustedReviewer() {
  const user = await getTrustedReviewer();
  if (!user) {
    redirect(`${INTERNAL_LOGIN_PATH}?error=${AUTH_ERROR_CODES.sessionRequired}`);
  }
  return user;
}

export async function getTrustedAdmin() {
  const supabase = await createInternalAuthServerClient();
  const active = await readActiveTrustedReviewer(supabase);
  return active && isApprovedInternalAdminAccess(active.user, active.access)
    ? active.user
    : null;
}
