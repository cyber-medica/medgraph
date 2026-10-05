export interface InternalSessionClaims {
  sub?: unknown;
  email?: unknown;
  session_id?: unknown;
  exp?: unknown;
}

export interface TrustedInternalSessionClaims extends InternalSessionClaims {
  sub: string;
  email: string;
  session_id: string;
  exp: number;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function decodeInternalSessionClaims(jwt: string): InternalSessionClaims | null {
  const segments = jwt.split(".");
  if (segments.length !== 3 || segments[1].length === 0) return null;
  try {
    const value = JSON.parse(decodeBase64Url(segments[1])) as unknown;
    return value && typeof value === "object" ? value as InternalSessionClaims : null;
  } catch {
    return null;
  }
}

export function isApprovedCorporateSessionClaims(
  claims: InternalSessionClaims | null | undefined,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): claims is TrustedInternalSessionClaims {
  return typeof claims?.sub === "string"
    && uuidPattern.test(claims.sub)
    && typeof claims.email === "string"
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(claims.email.trim())
    && typeof claims.session_id === "string"
    && uuidPattern.test(claims.session_id)
    && typeof claims.exp === "number"
    && Number.isSafeInteger(claims.exp)
    && claims.exp > nowEpochSeconds;
}
