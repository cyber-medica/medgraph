import { getLocalAuthShadowRuntime } from "@/lib/local-auth/runtime.server";
import {
  handleLocalAuthShadowLogout,
  localAuthShadowNotFoundResponse,
} from "@/lib/local-auth/shadow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const dependencies = getLocalAuthShadowRuntime();
    return dependencies
      ? await handleLocalAuthShadowLogout(request, dependencies)
      : localAuthShadowNotFoundResponse();
  } catch {
    return localAuthShadowNotFoundResponse();
  }
}
