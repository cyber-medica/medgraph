import { createLocalSessionCookie, LOCAL_SESSION_COOKIE_NAME } from "./cookie.ts";
import { isOpaqueToken, normalizeCorporateEmail, type LocalRole } from "./core.ts";
import type { LocalAuthService } from "./service.ts";
import type { Yandex360MagicLinkMailer } from "./yandex-mail.ts";

export const LOCAL_AUTH_SHADOW_COMPLETE_PATH = "/internal/auth/local/complete";
export const LOCAL_AUTH_SHADOW_BODY_LIMIT_BYTES = 2_048;

const SECURITY_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
});

type ShadowService = Pick<
  LocalAuthService,
  "createLoginChallenge" | "consumeChallenge" | "createSession" | "validateSession" | "revokeSession"
>;

type ShadowMailer = Pick<Yandex360MagicLinkMailer, "sendMagicLink">;

export interface LocalAuthShadowRateLimiter {
  take(): boolean;
}

export interface LocalAuthShadowDependencies {
  enabled: boolean;
  service: ShadowService;
  mailer: ShadowMailer;
  rateLimiter: LocalAuthShadowRateLimiter;
  callbackOrigin: string;
}

export interface LocalShadowSessionDto {
  sessionId: string;
  userId: string;
  role: LocalRole;
  expiresAt: Date;
}

export class InMemoryLocalAuthShadowRateLimiter implements LocalAuthShadowRateLimiter {
  private windowStartedAt = 0;
  private attempts = 0;
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(
    limit = 5,
    windowMs = 60_000,
    now: () => number = Date.now,
  ) {
    if (!Number.isSafeInteger(limit) || limit < 1 || windowMs < 1) {
      throw new Error("local_auth_rate_limit_invalid");
    }
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  take() {
    const at = this.now();
    if (this.windowStartedAt === 0 || at - this.windowStartedAt >= this.windowMs) {
      this.windowStartedAt = at;
      this.attempts = 0;
    }
    this.attempts += 1;
    return this.attempts <= this.limit;
  }
}

function responseHeaders(extra?: HeadersInit) {
  const headers = new Headers(SECURITY_HEADERS);
  if (extra) {
    for (const [name, value] of new Headers(extra)) headers.set(name, value);
  }
  return headers;
}

export function localAuthShadowNotFoundResponse() {
  return new Response("Not Found", {
    status: 404,
    headers: responseHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

function genericRequestResponse(status = 202) {
  return new Response(JSON.stringify({ accepted: true }), {
    status,
    headers: responseHeaders({ "Content-Type": "application/json; charset=utf-8" }),
  });
}

async function readLimitedUtf8Body(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > LOCAL_AUTH_SHADOW_BODY_LIMIT_BYTES) {
    return null;
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > LOCAL_AUTH_SHADOW_BODY_LIMIT_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

async function readEmailOnly(request: Request) {
  const raw = await readLimitedUtf8Body(request);
  if (raw === null) return null;
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  try {
    if (contentType === "application/json") {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const record = value as Record<string, unknown>;
      if (Object.keys(record).length !== 1 || !("email" in record)) return null;
      return typeof record.email === "string" ? record.email : null;
    }
    if (contentType === "application/x-www-form-urlencoded") {
      const values = new URLSearchParams(raw);
      const entries = [...values.entries()];
      if (entries.length !== 1 || entries[0]?.[0] !== "email") return null;
      return entries[0][1];
    }
  } catch {
    return null;
  }
  return null;
}

function cleanRedirect(origin: string) {
  return new URL(LOCAL_AUTH_SHADOW_COMPLETE_PATH, origin);
}

function callbackHasOneStrictToken(url: URL) {
  const entries = [...url.searchParams.entries()];
  return entries.length === 1
    && entries[0]?.[0] === "token"
    && isOpaqueToken(entries[0][1]);
}

function readRequestCookie(request: Request, name: string) {
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1));
  return matches.length === 1 && matches[0] ? matches[0] : null;
}

function serializeSessionCookie(input: ReturnType<typeof createLocalSessionCookie>) {
  return [
    `${input.name}=${input.value}`,
    `Path=${input.options.path}`,
    `Max-Age=${input.options.maxAge}`,
    `Expires=${input.options.expires.toUTCString()}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function expiredSessionCookie() {
  return [
    `${LOCAL_SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export async function handleLocalAuthShadowRequest(
  request: Request,
  dependencies: LocalAuthShadowDependencies,
) {
  if (!dependencies.enabled) return localAuthShadowNotFoundResponse();
  if (!dependencies.rateLimiter.take()) return genericRequestResponse(429);

  const email = await readEmailOnly(request);
  const normalizedEmail = normalizeCorporateEmail(email);
  try {
    const challenge = await dependencies.service.createLoginChallenge(email);
    if (challenge && normalizedEmail) {
      await dependencies.mailer.sendMagicLink({
        normalizedEmail,
        rawToken: challenge.rawToken,
        expiresAt: challenge.expiresAt,
      });
    }
  } catch {
    // The public response is deliberately identical for unknown users and internal failures.
  }
  return genericRequestResponse();
}

export async function handleLocalAuthShadowCallback(
  request: Request,
  dependencies: LocalAuthShadowDependencies,
) {
  if (!dependencies.enabled) return localAuthShadowNotFoundResponse();
  const headers = responseHeaders({ Location: cleanRedirect(dependencies.callbackOrigin).toString() });
  const url = new URL(request.url);

  if (callbackHasOneStrictToken(url)) {
    try {
      const user = await dependencies.service.consumeChallenge(url.searchParams.get("token"));
      const issued = user ? await dependencies.service.createSession(user) : null;
      if (issued) {
        headers.set("Set-Cookie", serializeSessionCookie(createLocalSessionCookie({
          rawToken: issued.rawToken,
          expiresAt: issued.session.expiresAt,
          now: issued.session.createdAt,
          production: true,
        })));
      }
    } catch {
      // Fail closed with the same clean redirect and no sensitive error detail.
    }
  }

  return new Response(null, { status: 303, headers });
}

export async function readLocalShadowSession(
  request: Request,
  service: Pick<LocalAuthService, "validateSession">,
): Promise<LocalShadowSessionDto | null> {
  const rawToken = readRequestCookie(request, LOCAL_SESSION_COOKIE_NAME);
  if (!rawToken) return null;
  try {
    const session = await service.validateSession(rawToken);
    if (!session) return null;
    return {
      sessionId: session.id,
      userId: session.user.id,
      role: session.user.role,
      expiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function handleLocalAuthShadowLogout(
  request: Request,
  dependencies: Pick<LocalAuthShadowDependencies, "enabled" | "service" | "callbackOrigin">,
) {
  if (!dependencies.enabled) return localAuthShadowNotFoundResponse();
  const rawToken = readRequestCookie(request, LOCAL_SESSION_COOKIE_NAME);
  if (rawToken) {
    try {
      await dependencies.service.revokeSession(rawToken);
    } catch {
      // Cookie clearing remains fail-closed even when revocation storage is unavailable.
    }
  }
  const headers = responseHeaders({
    Location: cleanRedirect(dependencies.callbackOrigin).toString(),
    "Set-Cookie": expiredSessionCookie(),
  });
  return new Response(null, { status: 303, headers });
}
