import { getLocalAuthShadowRuntime } from "@/lib/local-auth/runtime.server";
import {
  handleLocalAuthShadowRequest,
  localAuthShadowNotFoundResponse,
} from "@/lib/local-auth/shadow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const dependencies = getLocalAuthShadowRuntime();
    return dependencies
      ? await handleLocalAuthShadowRequest(request, dependencies)
      : localAuthShadowNotFoundResponse();
  } catch {
    return localAuthShadowNotFoundResponse();
  }
}
