import "server-only";

import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  getSupabasePublicEnvironment,
} from "@/lib/supabase/env";

export interface InternalAuthEnvironment {
  url: string;
  publicKey: string;
}

export function getInternalAuthEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): InternalAuthEnvironment {
  const publicEnvironment = getSupabasePublicEnvironment(environment);
  const urlValue = publicEnvironment.url;
  const publicKey = publicEnvironment.publicCredential.key;
  const projectRef = environment.CYBERMEDICA_SUPABASE_PROJECT_REF?.trim();
  if (!projectRef) {
    throw new Error("Internal Auth Supabase environment is incomplete.");
  }

  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error("Internal Auth Supabase URL is invalid.");
  }

  if (environment.VERCEL_ENV === "production") {
    if (
      projectRef !== PRODUCTION_SUPABASE_PROJECT_REF
      || url.origin !== `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) {
      throw new Error("Internal Auth Production Supabase binding is invalid.");
    }
    return { url: url.origin, publicKey };
  }

  if (
    environment.NODE_ENV === "test"
    && projectRef === "localdevelopment0001"
    && (url.origin === "http://127.0.0.1:54321" || url.origin === "http://localhost:54321")
  ) {
    return { url: url.origin, publicKey };
  }

  throw new Error("Internal Auth Supabase environment is not approved.");
}
