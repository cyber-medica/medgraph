import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  allowsLocalAdmin,
  allowsLocalReviewer,
  createOpaqueToken,
  hashOpaqueToken,
  isOpaqueToken,
  LOGIN_CHALLENGE_TTL_MS,
  LOCAL_SESSION_TTL_MS,
  normalizeCorporateEmail,
  type LocalAuthAuditEvent,
  type LocalAuthUser,
  type LocalLoginChallenge,
  type LocalSession,
  type ValidatedLocalSession,
} from "../../lib/local-auth/core.ts";
import { createLocalSessionCookie } from "../../lib/local-auth/cookie.ts";
import type { LocalAuthRepository } from "../../lib/local-auth/repository.ts";
import { LocalAuthService } from "../../lib/local-auth/service.ts";
import {
  MagicLinkDeliveryError,
  type MagicLinkMailTransport,
  Yandex360MagicLinkMailer,
} from "../../lib/local-auth/yandex-mail.ts";

const NOW = new Date("2026-09-29T12:00:00.000Z");
const HASH_KEY = new Uint8Array(32).fill(17);

function user(
  id: string,
  role: "admin" | "reviewer",
  active = true,
): LocalAuthUser {
  return {
    id,
    normalizedEmail: `${role}@cyber-medica.ru`,
    role,
    displayName: null,
    active,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

class MemoryLocalAuthRepository implements LocalAuthRepository {
  readonly users = new Map<string, LocalAuthUser>();
  readonly challenges = new Map<string, LocalLoginChallenge>();
  readonly sessions = new Map<string, LocalSession>();
  readonly audit: LocalAuthAuditEvent[] = [];
  sessionLookups = 0;
  challengeConsumes = 0;

  async findUserByNormalizedEmail(normalizedEmail: string) {
    return [...this.users.values()].find(
      (candidate) => candidate.active && candidate.normalizedEmail === normalizedEmail,
    ) ?? null;
  }

  async createLoginChallenge(challenge: LocalLoginChallenge) {
    this.challenges.set(challenge.tokenHash, challenge);
  }

  async consumeLoginChallenge(tokenHash: string, now: Date) {
    this.challengeConsumes += 1;
    const challenge = this.challenges.get(tokenHash);
    if (!challenge || challenge.usedAt || challenge.expiresAt <= now) return null;
    challenge.usedAt = now;
    const account = this.users.get(challenge.userId);
    return account?.active ? account : null;
  }

  async createSession(session: LocalSession) {
    if (!this.users.get(session.userId)?.active) return false;
    this.sessions.set(session.tokenHash, session);
    return true;
  }

  async findValidSession(tokenHash: string, now: Date) {
    this.sessionLookups += 1;
    const session = this.sessions.get(tokenHash);
    const account = session ? this.users.get(session.userId) : null;
    if (!session || !account?.active || session.revokedAt || session.expiresAt <= now) {
      return null;
    }
    return { ...session, user: account };
  }

  async revokeSession(tokenHash: string, now: Date) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revokedAt) return null;
    session.revokedAt = now;
    return { sessionId: session.id, userId: session.userId };
  }

  async revokeAllSessions(userId: string, now: Date) {
    let revoked = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = now;
        revoked += 1;
      }
    }
    return revoked;
  }

  async recordAudit(event: LocalAuthAuditEvent) {
    this.audit.push(event);
  }
}

function harness(account = user("11111111-1111-4111-8111-111111111111", "admin")) {
  const repository = new MemoryLocalAuthRepository();
  repository.users.set(account.id, account);
  let now = new Date(NOW);
  let id = 0;
  const service = new LocalAuthService(repository, {
    hashKey: HASH_KEY,
    now: () => new Date(now),
    createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  return {
    repository,
    service,
    account,
    setNow(value: Date) {
      now = new Date(value);
    },
  };
}

test("opaque tokens contain at least 256 random bits in strict base64url form", () => {
  const tokens = new Set(Array.from({ length: 64 }, () => createOpaqueToken()));
  assert.equal(tokens.size, 64);
  for (const token of tokens) {
    assert.equal(isOpaqueToken(token), true);
    assert.equal(Buffer.from(token, "base64url").byteLength, 32);
  }
});

test("token hashes are deterministic, keyed, and domain-separated", () => {
  const token = createOpaqueToken(() => new Uint8Array(32).fill(9));
  const challengeHash = hashOpaqueToken(token, "login_challenge", HASH_KEY);
  assert.equal(challengeHash, hashOpaqueToken(token, "login_challenge", HASH_KEY));
  assert.notEqual(challengeHash, hashOpaqueToken(token, "session", HASH_KEY));
  assert.match(challengeHash, /^[0-9a-f]{64}$/u);
  assert.throws(() => hashOpaqueToken("malformed", "session", HASH_KEY));
});

test("corporate identity normalization and approved-user lookup fail closed", async () => {
  const { service, account } = harness();
  assert.equal(normalizeCorporateEmail(" ADMIN@CYBER-MEDICA.RU "), "admin@cyber-medica.ru");
  assert.equal(normalizeCorporateEmail("admin@example.com"), null);
  assert.equal((await service.lookupApprovedUser(" ADMIN@CYBER-MEDICA.RU "))?.id, account.id);
  assert.equal(await service.lookupApprovedUser("admin@example.com"), null);
});

test("magic-link challenge expires within 15 minutes and rejects replay", async () => {
  const { service, account } = harness();
  const challenge = await service.createLoginChallenge(account.normalizedEmail);
  assert.ok(challenge);
  assert.equal(challenge.expiresAt.getTime() - NOW.getTime(), LOGIN_CHALLENGE_TTL_MS);
  assert.equal((await service.consumeChallenge(challenge.rawToken))?.id, account.id);
  assert.equal(await service.consumeChallenge(challenge.rawToken), null);
});

test("expired and malformed challenges are denied", async () => {
  const { service, account, setNow, repository } = harness();
  const challenge = await service.createLoginChallenge(account.normalizedEmail);
  assert.ok(challenge);
  setNow(new Date(challenge.expiresAt.getTime()));
  assert.equal(await service.consumeChallenge(challenge.rawToken), null);
  const consumesBeforeMalformed = repository.challengeConsumes;
  assert.equal(await service.consumeChallenge("not-a-token"), null);
  assert.equal(repository.challengeConsumes, consumesBeforeMalformed);
});

test("session creation stores only a hash and validates an active session", async () => {
  const { service, repository, account } = harness();
  const issued = await service.createSession(account);
  assert.ok(issued);
  assert.equal(issued.session.expiresAt.getTime() - NOW.getTime(), LOCAL_SESSION_TTL_MS);
  assert.equal(repository.sessions.has(issued.rawToken), false);
  assert.equal((await service.validateSession(issued.rawToken))?.user.id, account.id);
});

test("expired, revoked, unknown, malformed, and inactive sessions are denied", async () => {
  const { service, repository, account, setNow } = harness();
  const expired = await service.createSession(account);
  assert.ok(expired);
  setNow(expired.session.expiresAt);
  assert.equal(await service.validateSession(expired.rawToken), null);

  setNow(NOW);
  const revoked = await service.createSession(account);
  assert.ok(revoked);
  assert.equal(await service.revokeSession(revoked.rawToken), true);
  assert.equal(await service.validateSession(revoked.rawToken), null);

  assert.equal(await service.validateSession(createOpaqueToken()), null);
  const lookupsBeforeMalformed = repository.sessionLookups;
  assert.equal(await service.validateSession("bad"), null);
  assert.equal(repository.sessionLookups, lookupsBeforeMalformed);

  const inactive = await service.createSession(account);
  assert.ok(inactive);
  account.active = false;
  assert.equal(await service.validateSession(inactive.rawToken), null);
});

test("global session revocation invalidates every active user session", async () => {
  const { service, account } = harness();
  const first = await service.createSession(account);
  const second = await service.createSession(account);
  assert.ok(first && second);
  assert.equal(await service.revokeAllSessionsForUser(account.id), 2);
  assert.equal(await service.validateSession(first.rawToken), null);
  assert.equal(await service.validateSession(second.rawToken), null);
});

test("local RBAC permits only admin for an admin-required decision", () => {
  const base: Omit<ValidatedLocalSession, "user"> = {
    id: "session",
    userId: "user",
    tokenHash: "a".repeat(64),
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + LOCAL_SESSION_TTL_MS),
    revokedAt: null,
  };
  const admin = { ...base, user: user("admin", "admin") };
  const reviewer = { ...base, user: user("reviewer", "reviewer") };
  const inactive = { ...base, user: user("inactive", "admin", false) };
  assert.equal(allowsLocalAdmin(admin), true);
  assert.equal(allowsLocalAdmin(reviewer), false);
  assert.equal(allowsLocalAdmin(inactive), false);
  assert.equal(allowsLocalAdmin(null), false);
  assert.equal(allowsLocalReviewer(admin), true);
  assert.equal(allowsLocalReviewer(reviewer), true);
});

test("audit events and schema contain no email, name, token, IP, or User-Agent", async () => {
  const { service, repository } = harness();
  await service.createLoginChallenge("unknown@cyber-medica.ru");
  assert.equal(repository.audit.length, 1);
  assert.deepEqual(Object.keys(repository.audit[0] ?? {}).sort(), [
    "createdAt",
    "eventType",
    "id",
    "result",
    "sessionId",
    "target",
    "userId",
  ]);
  const sql = await readFile("infra/postgresql/apply-local-auth-foundation.sql", "utf8");
  const auditDefinition = sql.match(/CREATE TABLE IF NOT EXISTS public\.internal_auth_audit \(([\s\S]*?)\n\);/u)?.[1] ?? "";
  assert.doesNotMatch(auditDefinition, /email|display_name|token|ip_address|user_agent/iu);
});

test("Yandex adapter uses injected transport and exposes only generic failures", async () => {
  const sent: Parameters<MagicLinkMailTransport["sendMail"]>[0][] = [];
  const transport: MagicLinkMailTransport = {
    async sendMail(message) {
      sent.push(message);
    },
  };
  const mailer = new Yandex360MagicLinkMailer({
    from: "internal-auth@cyber-medica.ru",
    callbackOrigin: "https://cyber-medica.ru",
  }, transport);
  const rawToken = createOpaqueToken();
  await mailer.sendMagicLink({
    normalizedEmail: "admin@cyber-medica.ru",
    rawToken,
    expiresAt: new Date(NOW.getTime() + LOGIN_CHALLENGE_TTL_MS),
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.disableFileAccess, true);
  assert.equal(sent[0]?.disableUrlAccess, true);

  const failing = new Yandex360MagicLinkMailer({
    from: "internal-auth@cyber-medica.ru",
    callbackOrigin: "https://cyber-medica.ru",
  }, {
    async sendMail() {
      throw new Error(`provider leaked admin@cyber-medica.ru ${rawToken}`);
    },
  });
  await assert.rejects(
    failing.sendMagicLink({
      normalizedEmail: "admin@cyber-medica.ru",
      rawToken,
      expiresAt: new Date(NOW.getTime() + LOGIN_CHALLENGE_TTL_MS),
    }),
    (error: unknown) => error instanceof MagicLinkDeliveryError
      && !error.message.includes("admin@cyber-medica.ru")
      && !error.message.includes(rawToken),
  );
  const source = await readFile("lib/local-auth/yandex-mail.ts", "utf8");
  assert.doesNotMatch(source, /console\.|logger\.|debug\(/u);
});

test("future local cookie is opaque, bounded, HttpOnly, Lax, and Secure in Production", () => {
  const rawToken = createOpaqueToken();
  const cookie = createLocalSessionCookie({
    rawToken,
    now: NOW,
    expiresAt: new Date(NOW.getTime() + LOCAL_SESSION_TTL_MS * 2),
    production: true,
  });
  assert.equal(cookie.value, rawToken);
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.secure, true);
  assert.equal(cookie.options.sameSite, "lax");
  assert.equal(cookie.options.path, "/");
  assert.equal(cookie.options.maxAge, LOCAL_SESSION_TTL_MS / 1000);
  assert.equal(cookie.options.expires.getTime(), NOW.getTime() + LOCAL_SESSION_TTL_MS);
  assert.equal(rawToken.includes("."), false);
  assert.doesNotMatch(JSON.stringify(cookie.options), /supabase|jwt|token/iu);
});
