import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { getInternalAuthEnvironment } from "./environment.ts";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export const internalAuthCookieOptions: CookieOptions = {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
};

function secureCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    ...internalAuthCookieOptions,
  };
}

export async function createInternalAuthServerClient() {
  const cookieStore = await cookies();
  const environment = getInternalAuthEnvironment();
  return createServerClient(environment.url, environment.publicKey, {
    cookieOptions: internalAuthCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          cookieStore.set(name, value, secureCookieOptions(options));
        }
      },
    },
  });
}

export async function clearInternalAuthCookies() {
  const cookieStore = await cookies();
  const environment = getInternalAuthEnvironment();
  const projectRef = new URL(environment.url).hostname.split(".", 1)[0];
  const authCookieName = `sb-${projectRef}-auth-token`;
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name === authCookieName || cookie.name.startsWith(`${authCookieName}.`)) {
      cookieStore.delete(cookie.name);
    }
  }
}

export function createInternalAuthRouteClient(request: NextRequest) {
  const environment = getInternalAuthEnvironment();
  const pendingCookies: CookieToSet[] = [];
  const pendingHeaders = new Headers();
  const client = createServerClient(environment.url, environment.publicKey, {
    cookieOptions: internalAuthCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        pendingCookies.splice(
          0,
          pendingCookies.length,
          ...values.map(({ name, value, options }) => ({
            name,
            value,
            options: secureCookieOptions(options),
          })),
        );
        for (const [name, value] of Object.entries(headers)) {
          pendingHeaders.set(name, value);
        }
      },
    },
  });
  return { client, pendingCookies, pendingHeaders };
}

export function applyInternalAuthCookies(
  response: Response & { cookies: { set(name: string, value: string, options: CookieOptions): unknown } },
  pendingCookies: CookieToSet[],
  pendingHeaders: Headers,
) {
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  for (const [name, value] of pendingHeaders) response.headers.set(name, value);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
