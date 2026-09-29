import { normalizeCorporateEmail } from "./core.ts";

export const LOCAL_AUTH_CALLBACK_ORIGIN = "https://cyber-medica.ru";

export interface DisabledLocalAuthShadowEnvironment {
  enabled: false;
}

export interface EnabledLocalAuthShadowEnvironment {
  enabled: true;
  databaseUrl: string;
  hashKey: Uint8Array;
  smtp: Readonly<{
    host: "smtp.yandex.ru";
    port: 465;
    secure: true;
    user: string;
    password: string;
    from: string;
  }>;
  callbackOrigin: typeof LOCAL_AUTH_CALLBACK_ORIGIN;
}

export type LocalAuthShadowEnvironment =
  | DisabledLocalAuthShadowEnvironment
  | EnabledLocalAuthShadowEnvironment;

function invalidEnvironment(): never {
  throw new Error("local_auth_environment_invalid");
}

function requiredValue(value: string | undefined, minimumLength = 1) {
  if (!value || value !== value.trim() || value.length < minimumLength) {
    return invalidEnvironment();
  }
  if (
    /^(?:change[-_]?me(?:[-_].*)?|replace[-_]?me(?:[-_].*)?|placeholder(?:[-_].*)?|todo(?:[-_].*)?|example(?:[-_].*)?|your[-_].*|<[^>]+>|\$\{[^}]+\})$/iu.test(value)
  ) {
    return invalidEnvironment();
  }
  return value;
}

function parseLoopbackDatabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalidEnvironment();
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    return invalidEnvironment();
  }
  if (!new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(url.hostname)) {
    return invalidEnvironment();
  }
  if (!url.username || !url.password || url.pathname === "/" || url.search || url.hash) {
    return invalidEnvironment();
  }
  try {
    requiredValue(decodeURIComponent(url.username));
    requiredValue(decodeURIComponent(url.password), 12);
    requiredValue(decodeURIComponent(url.pathname.slice(1)));
  } catch {
    return invalidEnvironment();
  }
  return url.toString();
}

function parseHashKey(value: string) {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) return invalidEnvironment();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength !== 32) return invalidEnvironment();
  return new Uint8Array(decoded);
}

export function isLocalAuthShadowEnabled(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return environment.CYBERMEDICA_LOCAL_AUTH_SHADOW_ENABLED === "1";
}

export function loadLocalAuthShadowEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): LocalAuthShadowEnvironment {
  if (!isLocalAuthShadowEnabled(environment)) return { enabled: false };

  const databaseUrl = parseLoopbackDatabaseUrl(requiredValue(
    environment.INTERNAL_AUTH_DATABASE_URL,
  ));
  const hashKey = parseHashKey(requiredValue(environment.INTERNAL_AUTH_TOKEN_HASH_KEY));
  const host = requiredValue(environment.INTERNAL_AUTH_SMTP_HOST);
  if (host !== "smtp.yandex.ru") return invalidEnvironment();
  if (environment.INTERNAL_AUTH_SMTP_PORT !== "465") return invalidEnvironment();
  if (environment.INTERNAL_AUTH_SMTP_SECURE !== "true") return invalidEnvironment();

  const user = normalizeCorporateEmail(requiredValue(environment.INTERNAL_AUTH_SMTP_USER));
  const from = normalizeCorporateEmail(requiredValue(environment.INTERNAL_AUTH_SMTP_FROM));
  if (!user || !from) return invalidEnvironment();

  return {
    enabled: true,
    databaseUrl,
    hashKey,
    smtp: {
      host,
      port: 465,
      secure: true,
      user,
      password: requiredValue(environment.INTERNAL_AUTH_SMTP_PASSWORD, 12),
      from,
    },
    callbackOrigin: LOCAL_AUTH_CALLBACK_ORIGIN,
  };
}
