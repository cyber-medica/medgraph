import {
  isOpaqueToken,
  LOCAL_SESSION_TTL_MS,
} from "./core.ts";

export const LOCAL_SESSION_COOKIE_NAME = "cybermedica_internal_session";

export interface LocalSessionCookie {
  name: typeof LOCAL_SESSION_COOKIE_NAME;
  value: string;
  options: Readonly<{
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
    expires: Date;
  }>;
}

export function createLocalSessionCookie(input: Readonly<{
  rawToken: string;
  expiresAt: Date;
  now: Date;
  production: boolean;
}>): LocalSessionCookie {
  if (!isOpaqueToken(input.rawToken)) throw new Error("local_auth_token_malformed");
  const boundedExpiry = new Date(Math.min(
    input.expiresAt.getTime(),
    input.now.getTime() + LOCAL_SESSION_TTL_MS,
  ));
  const maxAge = Math.floor((boundedExpiry.getTime() - input.now.getTime()) / 1000);
  if (maxAge <= 0) throw new Error("local_auth_session_expired");
  return {
    name: LOCAL_SESSION_COOKIE_NAME,
    value: input.rawToken,
    options: {
      httpOnly: true,
      secure: input.production,
      sameSite: "lax",
      path: "/",
      maxAge,
      expires: boundedExpiry,
    },
  };
}
