import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_CODES, INTERNAL_LOGIN_PATH } from "@/lib/internal-auth/constants";
import { resolveInternalAuthOrigin } from "@/lib/internal-auth/policy";
import { readActiveTrustedReviewer } from "@/lib/internal-auth/session";
import {
  applyInternalAuthCookies,
  createInternalAuthRouteClient,
} from "@/lib/internal-auth/supabase.server";
import { SEO_P0_PATHS } from "@/lib/seo/paths";
import { readPublicManufacturerSlugExistence } from "@/lib/storefront/manufacturer-slug-existence.server";
import { readVisibleProductSlugExistence } from "@/lib/storefront/product-slug-existence.server";

const catalogLandingPaths = new Set<string>(SEO_P0_PATHS);

export function catalogProductSlugFromPathname(pathname: string) {
  if (catalogLandingPaths.has(pathname)) return null;
  return pathname.match(/^\/catalog\/([^/]+)$/u)?.[1] ?? null;
}

export function manufacturerSlugFromPathname(pathname: string) {
  return pathname.match(/^\/manufacturers\/([^/]+)$/u)?.[1] ?? null;
}

export async function proxy(request: NextRequest) {
  const manufacturerSlug = manufacturerSlugFromPathname(request.nextUrl.pathname);
  if (manufacturerSlug) {
    const existence = await readPublicManufacturerSlugExistence(manufacturerSlug);
    if (existence === "missing") {
      return NextResponse.next({
        status: 404,
        headers: { "X-Robots-Tag": "noindex, nofollow" },
      });
    }
    return NextResponse.next();
  }

  const productSlug = catalogProductSlugFromPathname(request.nextUrl.pathname);
  if (productSlug) {
    const existence = await readVisibleProductSlugExistence(productSlug);
    if (existence === "missing") {
      return NextResponse.next({
        status: 404,
        headers: { "X-Robots-Tag": "noindex, nofollow" },
      });
    }
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/catalog/")) {
    return NextResponse.next();
  }

  const { client, pendingCookies, pendingHeaders } =
    createInternalAuthRouteClient(request);
  const active = await readActiveTrustedReviewer(client);
  if (!active) {
    await client.auth.signOut({ scope: "local" });
    const login = new URL(INTERNAL_LOGIN_PATH, resolveInternalAuthOrigin());
    login.searchParams.set("error", AUTH_ERROR_CODES.sessionRequired);
    return applyInternalAuthCookies(
      NextResponse.redirect(login, 303),
      pendingCookies,
      pendingHeaders,
    );
  }

  return applyInternalAuthCookies(
    NextResponse.next({ request }),
    pendingCookies,
    pendingHeaders,
  );
}

export const config = {
  matcher: [
    "/catalog/:slug",
    "/manufacturers/:slug",
    "/internal/review/:path*",
    "/internal/operations/:path*",
  ],
};
