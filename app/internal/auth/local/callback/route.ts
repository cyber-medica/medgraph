import { getLocalAuthShadowRuntime } from "@/lib/local-auth/runtime.server";
import {
  handleLocalAuthShadowCallback,
  localAuthShadowNotFoundResponse,
} from "@/lib/local-auth/shadow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const dependencies = getLocalAuthShadowRuntime();
    return dependencies
      ? await handleLocalAuthShadowCallback(request, dependencies)
      : localAuthShadowNotFoundResponse();
  } catch {
    return localAuthShadowNotFoundResponse();
  }
}
