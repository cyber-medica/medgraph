import { createHmac, randomBytes, randomUUID } from "node:crypto";

export const LOCAL_AUTH_TOKEN_BYTES = 32;
export const LOCAL_AUTH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
export const LOGIN_CHALLENGE_TTL_MS = 15 * 60 * 1000;
export const LOCAL_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type LocalRole = "admin" | "reviewer";
export type TokenPurpose = "login_challenge" | "session";

export interface LocalAuthUser {
  id: string;
  normalizedEmail: string;
  role: LocalRole;
  displayName: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalLoginChallenge {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface LocalSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface ValidatedLocalSession extends LocalSession {
  user: LocalAuthUser;
}

export type LocalAuthAuditResult = "allowed" | "denied" | "completed";

export interface LocalAuthAuditEvent {
  id: string;
  userId: string | null;
  eventType: string;
  sessionId: string | null;
  target: string | null;
  result: LocalAuthAuditResult;
  createdAt: Date;
}

const TOKEN_DOMAIN: Readonly<Record<TokenPurpose, string>> = Object.freeze({
  login_challenge: "cybermedica.local-auth.login-challenge.v1",
  session: "cybermedica.local-auth.session.v1",
});

export function createLocalAuthId() {
  return randomUUID();
}

export function createOpaqueToken(
  random: (size: number) => Uint8Array = randomBytes,
) {
  const bytes = random(LOCAL_AUTH_TOKEN_BYTES);
  if (bytes.byteLength !== LOCAL_AUTH_TOKEN_BYTES) {
    throw new Error("local_auth_random_source_failed");
  }
  return Buffer.from(bytes).toString("base64url");
}

export function isOpaqueToken(value: unknown): value is string {
  return typeof value === "string" && LOCAL_AUTH_TOKEN_PATTERN.test(value);
}

export function hashOpaqueToken(
  rawToken: string,
  purpose: TokenPurpose,
  hashKey: Uint8Array,
) {
  if (!isOpaqueToken(rawToken)) throw new Error("local_auth_token_malformed");
  if (hashKey.byteLength < LOCAL_AUTH_TOKEN_BYTES) {
    throw new Error("local_auth_hash_key_invalid");
  }
  return createHmac("sha256", hashKey)
    .update(TOKEN_DOMAIN[purpose], "utf8")
    .update("\0", "utf8")
    .update(rawToken, "utf8")
    .digest("hex");
}

export function normalizeCorporateEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().normalize("NFKC").toLowerCase();
  if (normalized.length < 3 || normalized.length > 160) return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@cyber-medica\.ru$/u.test(normalized)) {
    return null;
  }
  return normalized;
}

export function resolveLocalRbacRole(session: ValidatedLocalSession | null) {
  if (!session?.user.active) return null;
  return session.user.role;
}

export function allowsLocalAdmin(session: ValidatedLocalSession | null) {
  return resolveLocalRbacRole(session) === "admin";
}

export function allowsLocalReviewer(session: ValidatedLocalSession | null) {
  const role = resolveLocalRbacRole(session);
  return role === "admin" || role === "reviewer";
}
