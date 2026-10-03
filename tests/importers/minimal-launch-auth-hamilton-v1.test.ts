import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AGILIA_REVIEW,
  AGILIA_REVIEW_PATH,
  GENERIC_REVIEW_QUEUE_PATH,
  HAMILTON_REVIEW,
  MINDRAY_REVIEW_PATH,
} from "../../lib/internal-auth/constants.ts";
import {
  approvedCallbackUrl,
  isApprovedInternalAccess,
  isApprovedInternalAdminAccess,
  isApprovedLoginEmail,
  isConfirmedInternalUser,
  isSafeCallbackRequest,
  redactAuthText,
  resolveInternalAuthOrigin,
  safeInternalDestination,
} from "../../lib/internal-auth/policy.ts";

const productionEnvironment = Object.freeze({
  CYBERMEDICA_INTERNAL_AUTH_ORIGIN: "https://medgraph-medgraph.vercel.app",
  VERCEL_ENV: "production",
});
const syntheticUserId = "71000000-0000-4000-8000-000000000001";
const syntheticEmail = "reviewer@example.test";
const internalLoginEnvironment = Object.freeze({
  CYBERMEDICA_INTERNAL_LOGIN_EMAIL: syntheticEmail,
});

test("launch auth accepts only the approved Production origin and fixed destination", () => {
  assert.equal(resolveInternalAuthOrigin(productionEnvironment), "https://cyber-medica.ru");
  assert.equal(
    approvedCallbackUrl(productionEnvironment),
    "https://cyber-medica.ru/auth/callback",
  );
  assert.equal(safeInternalDestination(), GENERIC_REVIEW_QUEUE_PATH);
  assert.equal(
    approvedCallbackUrl(MINDRAY_REVIEW_PATH, productionEnvironment),
    "https://cyber-medica.ru/auth/callback?next=%2Finternal%2Freview%2Fmindray-sv300",
  );
  assert.equal(
    approvedCallbackUrl(AGILIA_REVIEW_PATH, productionEnvironment),
    "https://cyber-medica.ru/auth/callback?next=%2Finternal%2Freview%2Fagilia-sp-mc",
  );

  assert.throws(() =>
    resolveInternalAuthOrigin({
      CYBERMEDICA_INTERNAL_AUTH_ORIGIN: "https://attacker.example",
      VERCEL_ENV: "production",
    }),
  );
  assert.throws(() =>
    resolveInternalAuthOrigin({
      CYBERMEDICA_INTERNAL_AUTH_ORIGIN: "https://medgraph-medgraph.vercel.app/other",
      VERCEL_ENV: "production",
    }),
  );
});

test("callback accepts one authorization code and rejects token or redirect input", () => {
  assert.equal(
    isSafeCallbackRequest(
      new URL("https://cyber-medica.ru/auth/callback?code=12345678"),
      productionEnvironment,
    ),
    true,
  );
  for (const url of [
    "https://cyber-medica.ru/auth/callback",
    "https://cyber-medica.ru/auth/callback?code=12345678&code=abcdefgh",
    "https://cyber-medica.ru/auth/callback?code=12345678&next=https://attacker.example",
    "https://cyber-medica.ru/auth/callback?access_token=secret",
    "https://cyber-medica.ru/auth/callback?code=12345678#refresh_token=secret",
    "https://attacker.example/auth/callback?code=12345678",
  ]) {
    assert.equal(isSafeCallbackRequest(new URL(url), productionEnvironment), false, url);
  }
  assert.equal(
    isSafeCallbackRequest(
      new URL(`https://cyber-medica.ru/auth/callback?code=12345678&next=${encodeURIComponent(MINDRAY_REVIEW_PATH)}`),
      productionEnvironment,
    ),
    true,
  );
  assert.equal(
    isSafeCallbackRequest(
      new URL(`https://cyber-medica.ru/auth/callback?code=12345678&next=${encodeURIComponent(AGILIA_REVIEW_PATH)}`),
      productionEnvironment,
    ),
    true,
  );
});

test("confirmed users require live RBAC access and login email stays runtime-only", () => {
  const approved = {
    id: syntheticUserId,
    email: syntheticEmail,
    email_confirmed_at: "2026-07-29T00:00:00.000Z",
  };
  assert.equal(isConfirmedInternalUser(approved), true);
  assert.equal(
    isApprovedLoginEmail(`  ${syntheticEmail.toUpperCase()} `, internalLoginEnvironment),
    true,
  );
  assert.equal(isApprovedLoginEmail("other@example.test", internalLoginEnvironment), false);
  assert.equal(isApprovedLoginEmail(syntheticEmail, {}), false);
  assert.equal(isConfirmedInternalUser({ ...approved, id: "not-a-uuid" }), false);
  assert.equal(isConfirmedInternalUser({ ...approved, email: "not-an-email" }), false);
  assert.equal(isConfirmedInternalUser({ ...approved, email_confirmed_at: null }), false);

  const adminAccess = {
    userId: approved.id,
    role: "admin",
    displayName: "CyberMedica",
    allowed: true,
  } as const;
  assert.equal(isApprovedInternalAccess(approved, adminAccess), true);
  assert.equal(isApprovedInternalAdminAccess(approved, adminAccess), true);
  const reviewerAccess = {
    userId: approved.id,
    role: "reviewer",
    displayName: "CyberMedica",
    allowed: true,
  } as const;
  assert.equal(isApprovedInternalAccess(approved, reviewerAccess), true);
  assert.equal(isApprovedInternalAdminAccess(approved, reviewerAccess), false);
  assert.equal(isApprovedInternalAccess(approved, {
    userId: approved.id,
    role: "editor",
    allowed: false,
  }), false);
  assert.equal(isApprovedInternalAccess(approved, null), false);
  assert.equal(isApprovedInternalAccess(approved, {
    userId: crypto.randomUUID(),
    role: "admin",
    allowed: true,
  }), false);
});

test("auth diagnostics redact URL credentials and authorization material", () => {
  const redacted = redactAuthText(
    "GET /auth/callback?code=secret-code&access_token=secret-token Authorization Bearer secret Cookie: auth=secret",
  );
  assert.doesNotMatch(redacted, /secret-code|secret-token|Bearer secret|auth=secret/u);
  assert.match(redacted, /\[REDACTED\]/u);
});

test("server routes implement PKCE exchange, exact guard, clean redirect and hardened cookies", async () => {
  const [login, callback, proxy, cookies, config, constants] = await Promise.all([
    readFile("app/internal/login/actions.ts", "utf8"),
    readFile("app/auth/callback/route.ts", "utf8"),
    readFile("proxy.ts", "utf8"),
    readFile("lib/internal-auth/supabase.server.ts", "utf8"),
    readFile("next.config.ts", "utf8"),
    readFile("lib/internal-auth/constants.ts", "utf8"),
  ]);

  assert.match(login, /signInWithOtp/u);
  assert.match(login, /shouldCreateUser:\s*false/u);
  assert.match(constants, /emailRateLimited:\s*"EMAIL_RATE_LIMITED"/u);
  assert.match(constants, /emailNotAllowed:\s*"EMAIL_NOT_ALLOWED"/u);
  assert.match(constants, /authConfigurationError:\s*"AUTH_CONFIGURATION_ERROR"/u);
  assert.match(constants, /authProviderError:\s*"AUTH_PROVIDER_ERROR"/u);
  assert.doesNotMatch(login, /redirect\([^)]*AUTH_LOGIN_UNAVAILABLE[^)]*\)[\s\S]*catch/u);
  assert.match(login, /emailRedirectTo:[\s\S]*approvedCallbackUrl\(\)/u);
  assert.match(callback, /exchangeCodeForSession\(code\)/u);
  assert.match(callback, /readActiveTrustedReviewer\(client\)/u);
  assert.match(callback, /signOut\(\{ scope: "local" \}\)/u);
  assert.match(callback, /cleanRedirect\(callbackDestination\(requestUrl\)\)/u);
  assert.doesNotMatch(callback, /access_token|refresh_token|token_hash/iu);
  assert.match(proxy, /matcher:[\s\S]*\/internal\/review\/:path\*/u);
  assert.match(proxy, /readActiveTrustedReviewer\(client\)/u);
  assert.match(proxy, /\/internal\/operations\/:path\*/u);
  assert.match(cookies, /path:\s*"\/"/u);
  assert.match(cookies, /sameSite:\s*"lax"/u);
  assert.match(cookies, /httpOnly:\s*true/u);
  assert.match(cookies, /secure:\s*process\.env\.NODE_ENV === "production"/u);
  assert.match(config, /private, no-store/u);
  assert.match(config, /no-referrer/u);
  assert.match(config, /noindex, nofollow/u);
  assert.doesNotMatch(`${login}\n${callback}\n${proxy}`, /localStorage|sessionStorage/u);
});

test("legacy Agilia route is read-only and cannot create a new decision", async () => {
  const [action, page] = await Promise.all([
    readFile("app/internal/review/agilia-sp-mc/actions.ts", "utf8"),
    readFile("app/internal/review/agilia-sp-mc/page.tsx", "utf8"),
  ]);

  assert.match(page, /redirect\(GENERIC_REVIEW_QUEUE_PATH\)/u);
  assert.doesNotMatch(page, /AgiliaReviewConfirmation|AGILIA_REVIEW/u);
  assert.doesNotMatch(action, /\.rpc\(/u);
  assert.match(action, /уже опубликован/u);
  assert.equal(AGILIA_REVIEW.productId, "b7f07e3e-5cdd-4988-b2a4-423bed321f46");
  assert.equal(AGILIA_REVIEW.revisionId, "e09f69c9-fbc5-4f6e-a240-05372e959510");
  assert.equal(
    AGILIA_REVIEW.candidatePayloadChecksum,
    "d14d6199641cec398e2d9ab48e86583fcab1575bd904e03d4fa4d7c0d8060747",
  );
});

test("legacy Mindray route is read-only and cannot create a new decision", async () => {
  const [action, page] = await Promise.all([
    readFile("app/internal/review/mindray-sv300/actions.ts", "utf8"),
    readFile("app/internal/review/mindray-sv300/page.tsx", "utf8"),
  ]);

  assert.match(page, /redirect\(GENERIC_REVIEW_QUEUE_PATH\)/u);
  assert.doesNotMatch(page, /MindrayReviewConfirmation|MINDRAY_REVIEW/u);
  assert.doesNotMatch(action, /\.rpc\(/u);
  assert.match(action, /уже опубликован/u);
});

test("legacy Hamilton route is read-only and cannot create a new decision", async () => {
  const [action, page, component, foundation] = await Promise.all([
    readFile("app/internal/review/hamilton-t1/actions.ts", "utf8"),
    readFile("app/internal/review/hamilton-t1/page.tsx", "utf8"),
    readFile("components/internal/HamiltonReviewConfirmation.tsx", "utf8"),
    readFile(
      "supabase/migrations/202607260001_product_publication_foundation_corrective_v1.sql",
      "utf8",
    ),
  ]);

  assert.doesNotMatch(action, /\.rpc\(/u);
  assert.match(action, /уже опубликован/u);
  assert.match(page, /redirect\(GENERIC_REVIEW_QUEUE_PATH\)/u);
  assert.doesNotMatch(page, /HamiltonReviewConfirmation|HAMILTON_REVIEW/u);
  assert.equal((component.match(/<button/gu) ?? []).length, 1);

  assert.match(foundation, /current in-review Product revision/u);
  assert.match(foundation, /reviewer already recorded a different decision for this revision/u);
  assert.match(foundation, /'idempotent', true/u);
  assert.match(foundation, /approved_payload_checksum <> revision\.payload_checksum/u);
  assert.match(foundation, /product_identity_checksum <> revision\.product_identity_checksum/u);
  assert.equal(HAMILTON_REVIEW.productId, "e66a1165-030b-4aa4-a400-959f1ac70fe3");
  assert.equal(HAMILTON_REVIEW.revisionId, "8d48a2b5-0842-4796-803f-4e4daf6f6e17");
  assert.equal(
    HAMILTON_REVIEW.payloadChecksum,
    "f391551c5eede060365d23440f79dce518d41e7197cee01511a63587da97c2bf",
  );
});
