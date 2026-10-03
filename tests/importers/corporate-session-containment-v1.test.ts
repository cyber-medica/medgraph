import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decodeInternalSessionClaims,
  isApprovedCorporateSessionClaims,
} from "../../lib/internal-auth/claims.ts";
import {
  performCorporateGlobalLogout,
  type CorporateLogoutClient,
} from "../../lib/internal-auth/logout-all.ts";

const syntheticUserId = "71000000-0000-4000-8000-000000000001";
const syntheticEmail = "reviewer@example.test";

function jwtFor(overrides: Record<string, unknown> = {}) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    sub: syntheticUserId,
    email: syntheticEmail,
    session_id: "11111111-1111-4111-8111-111111111111",
    exp: 2_000_000_000,
    ...overrides,
  })}.synthetic-signature`;
}

function logoutClient(options: {
  jwt?: string;
  session?: boolean;
  access?: boolean;
  logoutError?: unknown;
} = {}) {
  const calls: string[] = [];
  const session = options.session === false ? null : {
    access_token: options.jwt ?? jwtFor(),
    user: {
      id: syntheticUserId,
      email: syntheticEmail,
      email_confirmed_at: "2026-08-01T10:26:43.000Z",
    },
  };
  const client: CorporateLogoutClient = {
    auth: {
      async getSession() {
        calls.push("getSession");
        return { data: { session }, error: null };
      },
      async signOut({ scope }) {
        calls.push(`signOut:${scope}`);
        return { error: options.logoutError ?? null };
      },
    },
    schema(name) {
      calls.push(`schema:${name}`);
      return {
        async rpc(rpcName) {
          calls.push(`rpc:${rpcName}`);
          return {
            data: options.access === false ? null : {
              userId: syntheticUserId,
              role: "admin",
              allowed: true,
            },
            error: null,
          };
        },
      };
    },
  };
  return { client, calls };
}

test("corporate session claims require valid unexpired UUID, email and session_id", () => {
  const claims = decodeInternalSessionClaims(jwtFor());
  assert.equal(isApprovedCorporateSessionClaims(claims), true);
  assert.equal(isApprovedCorporateSessionClaims(decodeInternalSessionClaims(jwtFor({
    sub: crypto.randomUUID(),
  }))), true);
  assert.equal(isApprovedCorporateSessionClaims(decodeInternalSessionClaims(jwtFor({
    email: "not-an-email",
  }))), false);
  assert.equal(isApprovedCorporateSessionClaims(decodeInternalSessionClaims(jwtFor({
    session_id: null,
  }))), false);
  assert.equal(isApprovedCorporateSessionClaims(decodeInternalSessionClaims(jwtFor({
    exp: 1,
  }))), false);
  assert.equal(decodeInternalSessionClaims("not-a-jwt"), null);
});

test("logout-all invokes global Auth logout only for a live RBAC-approved session", async () => {
  const { client, calls } = logoutClient();
  assert.deepEqual(await performCorporateGlobalLogout(client), { status: "signed_out_all" });
  assert.deepEqual(calls, [
    "getSession",
    "schema:cloud_api",
    "rpc:current_internal_access_v1",
    "signOut:global",
  ]);
});

test("anonymous, wrong identity and missing profile fail closed without logout", async () => {
  for (const { client, calls } of [
    logoutClient({ session: false }),
    logoutClient({ jwt: jwtFor({ sub: crypto.randomUUID() }) }),
    logoutClient({ access: false }),
  ]) {
    const result = await performCorporateGlobalLogout(client);
    assert.equal(result.status, "blocked");
    assert.equal(calls.some((call) => call.startsWith("signOut:")), false);
  }
});

test("logout failure is explicit and a second missing-session call is safe", async () => {
  const failed = logoutClient({ logoutError: new Error("synthetic") });
  assert.deepEqual(await performCorporateGlobalLogout(failed.client), {
    status: "blocked",
    code: "logout_failed",
  });
  const second = logoutClient({ session: false });
  assert.deepEqual(await performCorporateGlobalLogout(second.client), {
    status: "blocked",
    code: "session_required",
  });
});

test("runtime route clears only project Auth cookies and never logs credentials", async () => {
  const [action, page, session, cookies, proxy, reviewAction, waveAction] = await Promise.all([
    readFile("app/internal/auth/logout-all/actions.ts", "utf8"),
    readFile("app/internal/auth/logout-all/page.tsx", "utf8"),
    readFile("lib/internal-auth/session.ts", "utf8"),
    readFile("lib/internal-auth/supabase.server.ts", "utf8"),
    readFile("proxy.ts", "utf8"),
    readFile("app/internal/review/actions.ts", "utf8"),
    readFile("app/internal/operations/catalog-publication-wave/execute/actions.ts", "utf8"),
  ]);

  assert.match(page, /form action=\{logoutAllCorporateSessions\}/u);
  assert.match(action, /performCorporateGlobalLogout/u);
  assert.match(action, /clearInternalAuthCookies/u);
  assert.match(action, /SIGNED_OUT_ALL/u);
  assert.match(session, /getClaims\(\)/u);
  assert.match(session, /session_id/u);
  assert.match(session, /getUser\(\)/u);
  assert.match(session, /current_internal_access_v1/u);
  assert.match(cookies, /sb-\$\{projectRef\}-auth-token/u);
  assert.match(cookies, /cookieStore\.delete\(cookie\.name\)/u);
  assert.match(proxy, /readActiveTrustedReviewer/u);
  assert.match(proxy, /\/internal\/operations\/:path\*/u);
  assert.match(reviewAction, /requireTrustedReviewer/u);
  assert.match(waveAction, /getTrustedAdmin/u);
  assert.doesNotMatch(
    `${action}\n${session}\n${cookies}\n${proxy}`,
    /console\.(?:log|info|warn|error)|SUPABASE_SERVICE_ROLE_KEY|service_role/u,
  );
});
