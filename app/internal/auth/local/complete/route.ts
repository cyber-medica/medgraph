import { loadLocalAuthShadowEnvironmentFromServer } from "@/lib/local-auth/environment.server";
import { localAuthShadowNotFoundResponse } from "@/lib/local-auth/shadow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    if (!loadLocalAuthShadowEnvironmentFromServer().enabled) {
      return localAuthShadowNotFoundResponse();
    }
  } catch {
    return localAuthShadowNotFoundResponse();
  }
  return new Response("Local authentication shadow flow completed.", {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
