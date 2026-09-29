import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { LOCAL_SESSION_COOKIE_NAME } from "../../lib/local-auth/cookie.ts";
import {
  createOpaqueToken,
  hashOpaqueToken,
  type LocalAuthAuditEvent,
  type LocalAuthUser,
  type LocalLoginChallenge,
  type LocalSession,
} from "../../lib/local-auth/core.ts";
import {
  isLocalAuthShadowEnabled,
  loadLocalAuthShadowEnvironment,
  LOCAL_AUTH_CALLBACK_ORIGIN,
} from "../../lib/local-auth/environment.ts";
import type { LocalAuthRepository } from "../../lib/local-auth/repository.ts";
import { LocalAuthService } from "../../lib/local-auth/service.ts";
import {
  handleLocalAuthShadowCallback,
  handleLocalAuthShadowLogout,
  handleLocalAuthShadowRequest,
  InMemoryLocalAuthShadowRateLimiter,
  LOCAL_AUTH_SHADOW_COMPLETE_PATH,
  readLocalShadowSession,
  type LocalAuthShadowDependencies,
} from "../../lib/local-auth/shadow.ts";

const NOW = new Date("2026-09-29T14:00:00.000Z");
const HASH_KEY = new Uint8Array(32).fill(23);
const HASH_KEY_TEXT = Buffer.from(HASH_KEY).toString("base64url");

function account(active = true): LocalAuthUser {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    normalizedEmail: "admin@cyber-medica.ru",
    role: "admin",
    displayName: null,
    active,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

class MemoryRepository implements LocalAuthRepository {
  readonly users = new Map<string, LocalAuthUser>();
  readonly challenges = new Map<string, LocalLoginChallenge>();
  readonly sessions = new Map<string, LocalSession>();
  readonly audit: LocalAuthAuditEvent[] = [];

  async findUserByNormalizedEmail(email: string) {
    return [...this.users.values()].find((user) => user.active && user.normalizedEmail === email) ?? null;
  }

  async createLoginChallenge(challenge: LocalLoginChallenge) {
    this.challenges.set(challenge.tokenHash, challenge);
  }

  async consumeLoginChallenge(tokenHash: string, now: Date) {
    const challenge = this.challenges.get(tokenHash);
    const user = challenge ? this.users.get(challenge.userId) : null;
    if (!challenge || challenge.usedAt || challenge.expiresAt <= now || !user?.active) return null;
    challenge.usedAt = now;
    return user;
  }

  async createSession(session: LocalSession) {
    if (!this.users.get(session.userId)?.active) return false;
    this.sessions.set(session.tokenHash, session);
    return true;
  }

  async findValidSession(tokenHash: string, now: Date) {
    const session = this.sessions.get(tokenHash);
    const user = session ? this.users.get(session.userId) : null;
    if (!session || !user?.active || session.revokedAt || session.expiresAt <= now) return null;
    return { ...session, user };
  }

  async revokeSession(tokenHash: string, now: Date) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revokedAt) return null;
    session.revokedAt = now;
    return { sessionId: session.id, userId: session.userId };
  }

  async revokeAllSessions(userId: string, now: Date) {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = now;
        count += 1;
      }
    }
    return count;
  }

  async recordAudit(event: LocalAuthAuditEvent) {
    this.audit.push(event);
  }
}

function harness(input: Readonly<{ active?: boolean; rateLimit?: number }> = {}) {
  const repository = new MemoryRepository();
  const user = account(input.active ?? true);
  repository.users.set(user.id, user);
  let now = new Date(NOW);
  let id = 0;
  const sent: Array<{ normalizedEmail: string; rawToken: string; expiresAt: Date }> = [];
  const service = new LocalAuthService(repository, {
    hashKey: HASH_KEY,
    now: () => new Date(now),
    createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  const dependencies: LocalAuthShadowDependencies = {
    enabled: true,
    service,
    mailer: {
      async sendMagicLink(message) {
        sent.push(message);
      },
    },
    rateLimiter: new InMemoryLocalAuthShadowRateLimiter(input.rateLimit ?? 5, 60_000, () => now.getTime()),
    callbackOrigin: LOCAL_AUTH_CALLBACK_ORIGIN,
  };
  return {
    repository,
    user,
    service,
    dependencies,
    sent,
    setNow(value: Date) {
      now = new Date(value);
    },
  };
}

function requestBody(email: unknown, extra?: Record<string, unknown>) {
  return new Request("https://cyber-medica.ru/internal/auth/local/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, ...extra }),
  });
}

function callbackRequest(query = "") {
  return new Request(`https://cyber-medica.ru/internal/auth/local/callback${query}`);
}

function cookieRequest(rawToken?: string) {
  return new Request("https://cyber-medica.ru/internal/auth/local/logout", {
    method: "POST",
    headers: rawToken ? { Cookie: `${LOCAL_SESSION_COOKIE_NAME}=${rawToken}` } : undefined,
  });
}

function assertSecurityHeaders(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
}

function validEnvironment() {
  return {
    CYBERMEDICA_LOCAL_AUTH_SHADOW_ENABLED: "1",
    INTERNAL_AUTH_DATABASE_URL: "postgresql://shadow:synthetic-password@127.0.0.1:55432/cybermedica_shadow",
    INTERNAL_AUTH_TOKEN_HASH_KEY: HASH_KEY_TEXT,
    INTERNAL_AUTH_SMTP_HOST: "smtp.yandex.ru",
    INTERNAL_AUTH_SMTP_PORT: "465",
    INTERNAL_AUTH_SMTP_SECURE: "true",
    INTERNAL_AUTH_SMTP_USER: "internal-auth@cyber-medica.ru",
    INTERNAL_AUTH_SMTP_PASSWORD: "synthetic-app-password",
    INTERNAL_AUTH_SMTP_FROM: "internal-auth@cyber-medica.ru",
  };
}

test("shadow flag is fail-closed and only exact 1 enables it", () => {
  for (const value of [undefined, "", "0", "true", " 1", "1 ", "yes"]) {
    assert.equal(isLocalAuthShadowEnabled({ CYBERMEDICA_LOCAL_AUTH_SHADOW_ENABLED: value }), false);
  }
  assert.equal(isLocalAuthShadowEnabled({ CYBERMEDICA_LOCAL_AUTH_SHADOW_ENABLED: "1" }), true);
  assert.deepEqual(loadLocalAuthShadowEnvironment({}), { enabled: false });
});

test("strict environment accepts only loopback PostgreSQL and exact Yandex TLS contract", () => {
  const loaded = loadLocalAuthShadowEnvironment(validEnvironment());
  assert.equal(loaded.enabled, true);
  if (!loaded.enabled) return;
  assert.equal(new URL(loaded.databaseUrl).hostname, "127.0.0.1");
  assert.equal(loaded.hashKey.byteLength, 32);
  assert.deepEqual({ host: loaded.smtp.host, port: loaded.smtp.port, secure: loaded.smtp.secure }, {
    host: "smtp.yandex.ru",
    port: 465,
    secure: true,
  });
  assert.equal(loaded.callbackOrigin, "https://cyber-medica.ru");
});

test("strict environment rejects foreign DB, placeholders, missing secrets, and SMTP drift generically", () => {
  const invalid = [
    { INTERNAL_AUTH_DATABASE_URL: "postgresql://u:p@db.example.com/db" },
    { INTERNAL_AUTH_DATABASE_URL: "postgresql://shadow:change-me-please@127.0.0.1:55432/cybermedica_shadow" },
    { INTERNAL_AUTH_TOKEN_HASH_KEY: "placeholder" },
    { INTERNAL_AUTH_SMTP_HOST: "smtp.example.com" },
    { INTERNAL_AUTH_SMTP_PORT: "587" },
    { INTERNAL_AUTH_SMTP_SECURE: "false" },
    { INTERNAL_AUTH_SMTP_PASSWORD: "changeme" },
  ];
  for (const mutation of invalid) {
    const environment = { ...validEnvironment(), ...mutation };
    assert.throws(
      () => loadLocalAuthShadowEnvironment(environment),
      (error: unknown) => error instanceof Error && error.message === "local_auth_environment_invalid"
        && !error.message.includes(String(Object.values(mutation)[0])),
    );
  }
});

test("disabled shadow request endpoint is unavailable and does not touch dependencies", async () => {
  const { dependencies, repository } = harness();
  const disabled = {
    ...dependencies,
    enabled: false,
  };
  const responses = await Promise.all([
    handleLocalAuthShadowRequest(requestBody("admin@cyber-medica.ru"), disabled),
    handleLocalAuthShadowCallback(callbackRequest(`?token=${createOpaqueToken()}`), disabled),
    handleLocalAuthShadowLogout(cookieRequest(createOpaqueToken()), disabled),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [404, 404, 404]);
  assert.equal(repository.audit.length, 0);
  for (const response of responses) assertSecurityHeaders(response);
});

test("unknown, inactive, and malformed emails receive the same generic response", async () => {
  const unknown = harness();
  const inactive = harness({ active: false });
  const malformed = harness();
  const responses = await Promise.all([
    handleLocalAuthShadowRequest(requestBody("unknown@cyber-medica.ru"), unknown.dependencies),
    handleLocalAuthShadowRequest(requestBody("admin@cyber-medica.ru"), inactive.dependencies),
    handleLocalAuthShadowRequest(requestBody("not-an-email"), malformed.dependencies),
  ]);
  const bodies = await Promise.all(responses.map((response) => response.text()));
  assert.deepEqual(responses.map((response) => response.status), [202, 202, 202]);
  assert.equal(new Set(bodies).size, 1);
  assert.deepEqual([unknown.sent.length, inactive.sent.length, malformed.sent.length], [0, 0, 0]);
});

test("valid approved user creates one challenge and uses only the injected mailer", async () => {
  const context = harness();
  const response = await handleLocalAuthShadowRequest(
    requestBody(" ADMIN@CYBER-MEDICA.RU "),
    context.dependencies,
  );
  assert.equal(response.status, 202);
  assert.equal(context.repository.challenges.size, 1);
  assert.equal(context.sent.length, 1);
  assert.equal(context.sent[0]?.normalizedEmail, "admin@cyber-medica.ru");
  assertSecurityHeaders(response);
});

test("request body accepts email only, enforces size limit, and never invokes mail for extras", async () => {
  const context = harness();
  const extra = await handleLocalAuthShadowRequest(
    requestBody("admin@cyber-medica.ru", { token: "forbidden" }),
    context.dependencies,
  );
  const oversized = await handleLocalAuthShadowRequest(new Request(
    "https://cyber-medica.ru/internal/auth/local/request",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${"a".repeat(3_000)}@cyber-medica.ru` }),
    },
  ), context.dependencies);
  assert.equal(extra.status, 202);
  assert.equal(oversized.status, 202);
  assert.equal(context.sent.length, 0);
});

test("global in-memory rate limit is enforced without identity-dependent responses", async () => {
  const context = harness({ rateLimit: 1 });
  const first = await handleLocalAuthShadowRequest(requestBody("unknown@cyber-medica.ru"), context.dependencies);
  const second = await handleLocalAuthShadowRequest(requestBody("admin@cyber-medica.ru"), context.dependencies);
  assert.equal(first.status, 202);
  assert.equal(second.status, 429);
  assert.equal(await first.text(), await second.text());
});

test("callback denies missing, malformed, duplicate, and extra parameters with one clean redirect", async () => {
  const context = harness();
  const token = createOpaqueToken();
  const responses = await Promise.all([
    handleLocalAuthShadowCallback(callbackRequest(), context.dependencies),
    handleLocalAuthShadowCallback(callbackRequest("?token=bad"), context.dependencies),
    handleLocalAuthShadowCallback(callbackRequest(`?token=${token}&token=${token}`), context.dependencies),
    handleLocalAuthShadowCallback(callbackRequest(`?token=${token}&email=admin%40cyber-medica.ru`), context.dependencies),
  ]);
  for (const response of responses) {
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), `${LOCAL_AUTH_CALLBACK_ORIGIN}${LOCAL_AUTH_SHADOW_COMPLETE_PATH}`);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(await response.text(), "");
    assertSecurityHeaders(response);
  }
});

test("expired and replayed callback challenges are denied", async () => {
  const context = harness();
  const challenge = await context.service.createLoginChallenge(context.user.normalizedEmail);
  assert.ok(challenge);
  context.setNow(challenge.expiresAt);
  const expired = await handleLocalAuthShadowCallback(
    callbackRequest(`?token=${challenge.rawToken}`),
    context.dependencies,
  );
  assert.equal(expired.headers.get("set-cookie"), null);

  context.setNow(NOW);
  const replayChallenge = await context.service.createLoginChallenge(context.user.normalizedEmail);
  assert.ok(replayChallenge);
  const first = await handleLocalAuthShadowCallback(
    callbackRequest(`?token=${replayChallenge.rawToken}`),
    context.dependencies,
  );
  const replay = await handleLocalAuthShadowCallback(
    callbackRequest(`?token=${replayChallenge.rawToken}`),
    context.dependencies,
  );
  assert.match(first.headers.get("set-cookie") ?? "", /HttpOnly; Secure; SameSite=Lax/u);
  assert.equal(replay.headers.get("set-cookie"), null);
});

test("valid callback creates an opaque session cookie and strips the raw token from redirect", async () => {
  const context = harness();
  const challenge = await context.service.createLoginChallenge(context.user.normalizedEmail);
  assert.ok(challenge);
  const response = await handleLocalAuthShadowCallback(
    callbackRequest(`?token=${challenge.rawToken}`),
    context.dependencies,
  );
  const location = response.headers.get("location") ?? "";
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.equal(response.status, 303);
  assert.equal(location, `${LOCAL_AUTH_CALLBACK_ORIGIN}${LOCAL_AUTH_SHADOW_COMPLETE_PATH}`);
  assert.equal(location.includes(challenge.rawToken), false);
  assert.match(setCookie, new RegExp(`^${LOCAL_SESSION_COOKIE_NAME}=[A-Za-z0-9_-]{43};`, "u"));
  assert.equal(context.repository.sessions.size, 1);
});

test("shadow session read returns a minimal DTO and denies malformed, expired, revoked, and inactive sessions", async () => {
  const context = harness();
  const issued = await context.service.createSession(context.user);
  assert.ok(issued);
  const valid = await readLocalShadowSession(cookieRequest(issued.rawToken), context.service);
  assert.deepEqual(valid, {
    sessionId: issued.session.id,
    userId: context.user.id,
    role: "admin",
    expiresAt: issued.session.expiresAt,
  });
  assert.equal("normalizedEmail" in (valid ?? {}), false);
  assert.equal(await readLocalShadowSession(cookieRequest("malformed"), context.service), null);

  context.setNow(issued.session.expiresAt);
  assert.equal(await readLocalShadowSession(cookieRequest(issued.rawToken), context.service), null);
  context.setNow(NOW);
  const revoked = await context.service.createSession(context.user);
  assert.ok(revoked);
  await context.service.revokeSession(revoked.rawToken);
  assert.equal(await readLocalShadowSession(cookieRequest(revoked.rawToken), context.service), null);
  const inactive = await context.service.createSession(context.user);
  assert.ok(inactive);
  context.user.active = false;
  assert.equal(await readLocalShadowSession(cookieRequest(inactive.rawToken), context.service), null);
});

test("shadow logout revokes valid session and always clears missing or malformed cookies safely", async () => {
  const context = harness();
  const issued = await context.service.createSession(context.user);
  assert.ok(issued);
  const valid = await handleLocalAuthShadowLogout(cookieRequest(issued.rawToken), context.dependencies);
  const missing = await handleLocalAuthShadowLogout(cookieRequest(), context.dependencies);
  const malformed = await handleLocalAuthShadowLogout(cookieRequest("bad"), context.dependencies);
  for (const response of [valid, missing, malformed]) {
    assert.equal(response.status, 303);
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/u);
    assertSecurityHeaders(response);
  }
  assert.equal(await context.service.validateSession(issued.rawToken), null);
});

test("P2B sources contain no sensitive logging or foreign identity dependencies", async () => {
  const files = [
    "lib/local-auth/environment.ts",
    "lib/local-auth/environment.server.ts",
    "lib/local-auth/runtime.server.ts",
    "lib/local-auth/shadow.ts",
    "app/internal/auth/local/request/route.ts",
    "app/internal/auth/local/callback/route.ts",
    "app/internal/auth/local/logout/route.ts",
    "app/internal/auth/local/complete/route.ts",
  ];
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /console\.|logger\.|debug\(/u);
  assert.doesNotMatch(source, /@supabase|createInternalAuthServerClient|APPROVED_REVIEWER|CYBERMEDICA_REVIEWER_ID|auth\.uid|current_internal_access_v1/u);
  assert.doesNotMatch(source, /NEXT_PUBLIC_/u);
  const serverEnvironment = await readFile("lib/local-auth/environment.server.ts", "utf8");
  assert.match(serverEnvironment, /^import "server-only";/u);
});

test("existing Supabase live auth and authorization boundaries remain present", async () => {
  const [login, callback, proxy, productionLaunch, reviewer] = await Promise.all([
    readFile("app/internal/login/actions.ts", "utf8"),
    readFile("app/auth/callback/route.ts", "utf8"),
    readFile("proxy.ts", "utf8"),
    readFile("lib/operations/production-launch-release-runner.ts", "utf8"),
    readFile("app/internal/reviewer/actions.ts", "utf8"),
  ]);
  assert.match(login, /createInternalAuthServerClient/u);
  assert.match(login, /supabase\.auth\.signInWithOtp/u);
  assert.match(callback, /createInternalAuthRouteClient/u);
  assert.match(callback, /exchangeCodeForSession/u);
  assert.match(proxy, /readActiveTrustedReviewer/u);
  assert.match(proxy, /createInternalAuthRouteClient/u);
  assert.match(productionLaunch, /import type \{ SupabaseClient \} from "@supabase\/supabase-js"/u);
  assert.match(productionLaunch, /executeReviewPhase[\s\S]*authenticatedClient/u);
  assert.match(reviewer, /internalReviewEnabled/u);
  assert.match(reviewer, /CYBERMEDICA_REVIEWER_ID/u);
});

test("hashes stored for P2B sessions and challenges are never raw tokens", async () => {
  const context = harness();
  const challenge = await context.service.createLoginChallenge(context.user.normalizedEmail);
  const session = await context.service.createSession(context.user);
  assert.ok(challenge && session);
  assert.equal(context.repository.challenges.has(challenge.rawToken), false);
  assert.equal(context.repository.sessions.has(session.rawToken), false);
  assert.equal(context.repository.challenges.has(hashOpaqueToken(challenge.rawToken, "login_challenge", HASH_KEY)), true);
  assert.equal(context.repository.sessions.has(hashOpaqueToken(session.rawToken, "session", HASH_KEY)), true);
});
