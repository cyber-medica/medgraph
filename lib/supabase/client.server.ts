import "server-only";

import {
  getProjectBoundSupabaseServiceEnvironment,
  getSupabasePublicEnvironment,
  getSupabaseServiceEnvironment,
  type SupabaseApiCredential,
  type SupabaseCredentialMode,
} from "./env.ts";

export type SupabaseServerAccess = "anon" | "service_role";

export class SupabaseConnectionError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "SupabaseConnectionError";
    this.status = status;
  }
}

export interface SupabaseServerClient {
  readonly access: SupabaseServerAccess;
  readonly credentialMode: SupabaseCredentialMode;
  readonly url: string;
  request(pathname: string, init?: RequestInit): Promise<Response>;
}

export interface CreateSupabaseServerClientOptions {
  access?: SupabaseServerAccess;
  environment?: Readonly<Record<string, string | undefined>>;
  fetchImplementation?: typeof fetch;
}

export interface CreateProjectBoundSupabaseServerClientOptions {
  allowLocalDevelopment?: boolean;
  environment?: Readonly<Record<string, string | undefined>>;
  fetchImplementation?: typeof fetch;
}

function resolveCredentials(
  access: SupabaseServerAccess,
  environment: Readonly<Record<string, string | undefined>>,
): { url: string; credential: SupabaseApiCredential } {
  if (access === "service_role") {
    const values = getSupabaseServiceEnvironment(environment);
    return { url: values.url, credential: values.privilegedCredential };
  }
  const values = getSupabasePublicEnvironment(environment);
  return { url: values.url, credential: values.publicCredential };
}

export function createSupabaseServerClient(
  options: CreateSupabaseServerClientOptions = {},
): SupabaseServerClient {
  const access = options.access ?? "anon";
  const credentials = resolveCredentials(access, options.environment ?? process.env);
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return createClient(access, credentials.url, credentials.credential, fetchImplementation);
}

export function createProjectBoundSupabaseServerClient(
  options: CreateProjectBoundSupabaseServerClientOptions = {},
): SupabaseServerClient {
  const credentials = getProjectBoundSupabaseServiceEnvironment(
    options.environment ?? process.env,
    { allowLocalDevelopment: options.allowLocalDevelopment },
  );
  return createClient(
    "service_role",
    credentials.url,
    credentials.privilegedCredential,
    options.fetchImplementation ?? fetch,
  );
}

function createClient(
  access: SupabaseServerAccess,
  url: string,
  credential: SupabaseApiCredential,
  fetchImplementation: typeof fetch,
): SupabaseServerClient {
  return {
    access,
    credentialMode: credential.mode,
    url,
    async request(pathname, init = {}) {
      const requestUrl = new URL(pathname, `${url}/`);
      if (requestUrl.origin !== new URL(url).origin) {
        throw new SupabaseConnectionError(
          "Supabase request target must use the configured origin.",
        );
      }
      const headers = new Headers();
      new Headers(init.headers).forEach((value, name) => {
        if (name !== "authorization" && name !== "apikey") headers.append(name, value);
      });
      if (!headers.has("Accept")) headers.set("Accept", "application/json");
      headers.set("apikey", credential.key);
      if (credential.sendAsBearer) {
        headers.set("Authorization", `Bearer ${credential.key}`);
      }
      const response = await fetchImplementation(requestUrl, {
        ...init,
        cache: "no-store",
        redirect: "error",
        headers,
      });
      if (!response.ok) {
        throw new SupabaseConnectionError(
          `Supabase request failed with HTTP ${response.status}.`,
          response.status,
        );
      }
      return response;
    },
  };
}
