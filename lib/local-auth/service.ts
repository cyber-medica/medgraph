import {
  createLocalAuthId,
  createOpaqueToken,
  hashOpaqueToken,
  isOpaqueToken,
  LOGIN_CHALLENGE_TTL_MS,
  LOCAL_SESSION_TTL_MS,
  normalizeCorporateEmail,
  type LocalAuthAuditEvent,
  type LocalAuthUser,
} from "./core.ts";
import type { LocalAuthRepository } from "./repository.ts";

export interface LocalAuthServiceOptions {
  hashKey: Uint8Array;
  now?: () => Date;
  createId?: () => string;
  createToken?: () => string;
}

export class LocalAuthService {
  private readonly repository: LocalAuthRepository;
  private readonly hashKey: Uint8Array;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly createToken: () => string;

  constructor(repository: LocalAuthRepository, options: LocalAuthServiceOptions) {
    if (options.hashKey.byteLength < 32) throw new Error("local_auth_hash_key_invalid");
    this.repository = repository;
    this.hashKey = options.hashKey;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? createLocalAuthId;
    this.createToken = options.createToken ?? createOpaqueToken;
  }

  private async audit(input: Omit<LocalAuthAuditEvent, "id" | "createdAt">, at: Date) {
    await this.repository.recordAudit({
      id: this.createId(),
      ...input,
      createdAt: at,
    });
  }

  async lookupApprovedUser(email: unknown) {
    const normalizedEmail = normalizeCorporateEmail(email);
    if (!normalizedEmail) return null;
    return this.repository.findUserByNormalizedEmail(normalizedEmail);
  }

  async createLoginChallenge(email: unknown) {
    const at = this.now();
    const user = await this.lookupApprovedUser(email);
    if (!user) {
      await this.audit({
        userId: null,
        eventType: "login_challenge_requested",
        sessionId: null,
        target: "local_auth",
        result: "denied",
      }, at);
      return null;
    }

    const rawToken = this.createToken();
    const challenge = {
      id: this.createId(),
      userId: user.id,
      tokenHash: hashOpaqueToken(rawToken, "login_challenge", this.hashKey),
      expiresAt: new Date(at.getTime() + LOGIN_CHALLENGE_TTL_MS),
      usedAt: null,
      createdAt: at,
    };
    await this.repository.createLoginChallenge(challenge);
    await this.audit({
      userId: user.id,
      eventType: "login_challenge_created",
      sessionId: null,
      target: "local_auth",
      result: "completed",
    }, at);
    return { rawToken, expiresAt: challenge.expiresAt };
  }

  async consumeChallenge(rawToken: unknown) {
    const at = this.now();
    if (!isOpaqueToken(rawToken)) {
      await this.audit({
        userId: null,
        eventType: "login_challenge_consumed",
        sessionId: null,
        target: "local_auth",
        result: "denied",
      }, at);
      return null;
    }
    const user = await this.repository.consumeLoginChallenge(
      hashOpaqueToken(rawToken, "login_challenge", this.hashKey),
      at,
    );
    await this.audit({
      userId: user?.id ?? null,
      eventType: "login_challenge_consumed",
      sessionId: null,
      target: "local_auth",
      result: user ? "completed" : "denied",
    }, at);
    return user;
  }

  async createSession(user: LocalAuthUser) {
    const at = this.now();
    if (!user.active) {
      await this.audit({
        userId: user.id,
        eventType: "session_created",
        sessionId: null,
        target: "local_auth",
        result: "denied",
      }, at);
      return null;
    }
    const rawToken = this.createToken();
    const session = {
      id: this.createId(),
      userId: user.id,
      tokenHash: hashOpaqueToken(rawToken, "session", this.hashKey),
      createdAt: at,
      expiresAt: new Date(at.getTime() + LOCAL_SESSION_TTL_MS),
      revokedAt: null,
    };
    const created = await this.repository.createSession(session);
    await this.audit({
      userId: user.id,
      eventType: "session_created",
      sessionId: created ? session.id : null,
      target: "local_auth",
      result: created ? "completed" : "denied",
    }, at);
    return created ? { rawToken, session } : null;
  }

  async validateSession(rawToken: unknown) {
    if (!isOpaqueToken(rawToken)) return null;
    return this.repository.findValidSession(
      hashOpaqueToken(rawToken, "session", this.hashKey),
      this.now(),
    );
  }

  async revokeSession(rawToken: unknown) {
    const at = this.now();
    if (!isOpaqueToken(rawToken)) return false;
    const revoked = await this.repository.revokeSession(
      hashOpaqueToken(rawToken, "session", this.hashKey),
      at,
    );
    await this.audit({
      userId: revoked?.userId ?? null,
      eventType: "session_revoked",
      sessionId: revoked?.sessionId ?? null,
      target: "local_auth",
      result: revoked ? "completed" : "denied",
    }, at);
    return Boolean(revoked);
  }

  async revokeAllSessionsForUser(userId: string) {
    const at = this.now();
    const revoked = await this.repository.revokeAllSessions(userId, at);
    await this.audit({
      userId,
      eventType: "all_sessions_revoked",
      sessionId: null,
      target: "local_auth",
      result: "completed",
    }, at);
    return revoked;
  }

  async resolveLocalRbacRole(rawToken: unknown) {
    const session = await this.validateSession(rawToken);
    return session?.user.role ?? null;
  }
}
