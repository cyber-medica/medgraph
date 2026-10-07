import { getSupabasePublicEnvironment } from "./env.ts";

export interface SupabaseHealthResult {
  ok: true;
  service: "auth";
  access: "anon";
  status: number;
  durationMs: number;
}

export async function checkSupabaseConnection(options: {
  environment?: Readonly<Record<string, string | undefined>>;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
} = {}): Promise<SupabaseHealthResult> {
  const environment = getSupabasePublicEnvironment(options.environment ?? process.env);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const startedAt = performance.now();
  const response = await fetchImplementation(new URL("/auth/v1/health", `${environment.url}/`), {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      apikey: environment.publicCredential.key,
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
  if (!response.ok) {
    throw new Error(`Supabase health check failed with HTTP ${response.status}.`);
  }
  await response.body?.cancel();
  return {
    ok: true,
    service: "auth",
    access: "anon",
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
