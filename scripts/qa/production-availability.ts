import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { EXPECTED_PRODUCTION_FRONT_DOOR } from "../../lib/canonical-routing-gate.ts";

export { EXPECTED_PRODUCTION_FRONT_DOOR } from "../../lib/canonical-routing-gate.ts";

export const PRODUCTION_AVAILABILITY_ROUTES = [
  "/",
  "/catalog",
  "/manufacturers",
  "/request",
  "/thanks",
] as const;

export const DEFAULT_PRODUCTION_AVAILABILITY_ATTEMPTS = 3;
export const DEFAULT_PRODUCTION_AVAILABILITY_TIMEOUT_MS = 15_000;
export const DEFAULT_PRODUCTION_AVAILABILITY_BACKOFF_MS = 500;
const DEFAULT_PRODUCTION_ORIGIN = "https://cyber-medica.ru";

export type ProductionAvailabilityResult = Readonly<{
  attempt: number;
  path: (typeof PRODUCTION_AVAILABILITY_ROUTES)[number];
  passed: boolean;
  status: number | null;
  ttfbMs: number | null;
  totalMs: number;
  bytes: number;
  server: string | null;
  frontDoor: string | null;
  cache: string | null;
  deployment: string | null;
  release: string | null;
  vercelId: string | null;
  errorClass: "timeout" | "network_error" | null;
}>;

export type ProductionAvailabilitySummary = Readonly<{
  origin: string;
  attemptsPerRoute: number;
  passed: boolean;
  results: readonly ProductionAvailabilityResult[];
}>;

type ProductionAvailabilityOptions = Readonly<{
  origin?: string;
  attempts?: number;
  timeoutMs?: number;
  backoffMs?: number;
  fetchImpl?: typeof fetch;
  delay?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  log?: (value: string) => void;
}>;

function normalizeOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Production availability origin must use HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Production availability origin must contain only an HTTPS origin.");
  }
  return url.origin;
}

function classifyError(error: unknown): "timeout" | "network_error" {
  if (
    (error instanceof DOMException
      && (error.name === "AbortError" || error.name === "TimeoutError"))
    || (error instanceof Error && /abort|timeout/iu.test(`${error.name} ${error.message}`))
  ) return "timeout";
  return "network_error";
}

async function defaultDelay(milliseconds: number) {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function probe(
  origin: string,
  path: (typeof PRODUCTION_AVAILABILITY_ROUTES)[number],
  attempt: number,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  now: () => number,
): Promise<ProductionAvailabilityResult> {
  const startedAt = now();
  const url = new URL(path, origin);
  url.searchParams.set("availability_check", `${startedAt}-${attempt}`);

  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Cache-Control": "no-cache",
        "User-Agent": "CyberMedica-Production-Availability/1.0",
      },
    });
    const ttfbMs = now() - startedAt;
    const body = await response.arrayBuffer();
    const server = response.headers.get("server");
    const frontDoor = response.headers.get("x-cybermedica-front-door");
    const vercelId = response.headers.get("x-vercel-id");
    const release = response.headers.get("x-cybermedica-release");
    const deployment = response.headers.get("x-cybermedica-deployment");
    return {
      attempt,
      path,
      passed: response.status === 200
        && body.byteLength > 0
        && frontDoor === EXPECTED_PRODUCTION_FRONT_DOOR
        && Boolean(vercelId)
        && Boolean(release)
        && Boolean(deployment),
      status: response.status,
      ttfbMs,
      totalMs: now() - startedAt,
      bytes: body.byteLength,
      server,
      frontDoor,
      cache: response.headers.get("x-vercel-cache"),
      deployment,
      release,
      vercelId,
      errorClass: null,
    };
  } catch (error) {
    return {
      attempt,
      path,
      passed: false,
      status: null,
      ttfbMs: null,
      totalMs: now() - startedAt,
      bytes: 0,
      server: null,
      frontDoor: null,
      cache: null,
      deployment: null,
      release: null,
      vercelId: null,
      errorClass: classifyError(error),
    };
  }
}

export async function runProductionAvailability(
  options: ProductionAvailabilityOptions = {},
): Promise<ProductionAvailabilitySummary> {
  const origin = normalizeOrigin(
    options.origin
      ?? process.env.PRODUCTION_AVAILABILITY_ORIGIN
      ?? DEFAULT_PRODUCTION_ORIGIN,
  );
  const attempts = options.attempts ?? DEFAULT_PRODUCTION_AVAILABILITY_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PRODUCTION_AVAILABILITY_TIMEOUT_MS;
  const backoffMs = options.backoffMs ?? DEFAULT_PRODUCTION_AVAILABILITY_BACKOFF_MS;
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) {
    throw new Error("Production availability attempts must be an integer between 1 and 5.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error("Production availability timeout must be an integer between 100 and 30000 ms.");
  }
  if (!Number.isInteger(backoffMs) || backoffMs < 0 || backoffMs > 5_000) {
    throw new Error("Production availability backoff must be an integer between 0 and 5000 ms.");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const delay = options.delay ?? defaultDelay;
  const now = options.now ?? Date.now;
  const log = options.log ?? console.info;
  const results: ProductionAvailabilityResult[] = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const round = await Promise.all(
      PRODUCTION_AVAILABILITY_ROUTES.map((path) =>
        probe(origin, path, attempt, timeoutMs, fetchImpl, now)),
    );
    for (const result of round) {
      results.push(result);
      log(JSON.stringify({ event: "production_availability_probe", origin, ...result }));
    }
    if (attempt < attempts && backoffMs > 0) await delay(backoffMs);
  }

  const passed = results.every((result) => result.passed);
  const summary = { origin, attemptsPerRoute: attempts, passed, results } as const;
  log(JSON.stringify({
    event: "production_availability_summary",
    origin,
    attemptsPerRoute: attempts,
    passed,
    successfulProbes: results.filter((result) => result.passed).length,
    totalProbes: results.length,
  }));
  return summary;
}

async function main() {
  const summary = await runProductionAvailability();
  if (!summary.passed) {
    console.error("Production availability is unstable; at least one full GET probe failed.");
    process.exitCode = 1;
    return;
  }
  console.info("PRODUCTION_AVAILABILITY_READY=true");
}

const isEntryPoint = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isEntryPoint) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Production availability failed.");
    process.exitCode = 1;
  });
}
