import assert from "node:assert/strict";
import { lookup } from "node:dns/promises";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { webkit } from "playwright-core";
import type { Request } from "playwright-core";

import {
  APPROVED_PUBLIC_MEDIA_HOSTS,
  isApprovedPublicMediaUrl,
} from "../../lib/public-media-policy.ts";
import {
  classifyNextImageIntegration,
  nextImageTransportClass,
} from "./next-image-integration-policy.ts";

const defaultProductPath = process.env.WEBKIT_SMOKE_PRODUCT_PATH
  ?? "/catalog/767632362-330695211247-apparat-ivl-hamilton-t1";
const origin = process.env.WEBKIT_SMOKE_ORIGIN ?? "http://127.0.0.1:3000";
const parsedOrigin = new URL(origin);
const loopbackOrigin = parsedOrigin.protocol === "http:"
  && ["127.0.0.1", "localhost"].includes(parsedOrigin.hostname);
const approvedOrigin =
  (parsedOrigin.protocol === "https:" && (
    parsedOrigin.hostname === "cyber-medica.ru"
    || parsedOrigin.hostname === "www.cyber-medica.ru"
    || parsedOrigin.hostname.endsWith(".vercel.app")
  ))
  || loopbackOrigin;

assert.ok(approvedOrigin, "WEBKIT_SMOKE_ORIGIN must be an approved public or loopback origin.");

const allRoutes = [
  "/",
  "/catalog",
  "/request",
  defaultProductPath,
  "/internal/login",
] as const;
const requestedRoutes = process.env.WEBKIT_SMOKE_ROUTES?.split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const routes = requestedRoutes?.length ? requestedRoutes : [...allRoutes];
for (const route of routes) {
  assert.ok(
    allRoutes.includes(route as (typeof allRoutes)[number]),
    "WEBKIT_SMOKE_ROUTES contains an unsupported route.",
  );
}

const profiles = [
  {
    name: "iPhone Safari portrait/private",
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) "
      + "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "iPhone Chrome landscape/fresh",
    viewport: { width: 844, height: 390 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) "
      + "AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 "
      + "Mobile/15E148 Safari/604.1",
  },
  {
    name: "desktop Safari/WebKit",
    viewport: { width: 1440, height: 900 },
    userAgent: undefined,
  },
] as const;

type RequestClass =
  | "NEXT_IMAGE"
  | "REMOTE_MEDIA"
  | "SUPABASE"
  | "YANDEX"
  | "LOCAL_APP"
  | "OTHER";

const approvedMediaHosts = new Set<string>(APPROVED_PUBLIC_MEDIA_HOSTS);
const deterministicPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const remoteMediaMode = process.env.WEBKIT_SMOKE_REMOTE_MEDIA_MODE ?? "live";
assert.ok(
  remoteMediaMode === "live" || remoteMediaMode === "fixture",
  "WEBKIT_SMOKE_REMOTE_MEDIA_MODE must be live or fixture.",
);
if (remoteMediaMode === "fixture") {
  assert.ok(loopbackOrigin, "Deterministic remote media interception is allowed only for loopback smoke.");
}

function classifyUrl(url: URL): RequestClass {
  if (url.origin === parsedOrigin.origin && url.pathname === "/_next/image") return "NEXT_IMAGE";
  if (url.hostname.endsWith(".supabase.co")) return "SUPABASE";
  if (url.hostname === "yandex.ru" || url.hostname.endsWith(".yandex.ru")) return "YANDEX";
  if (approvedMediaHosts.has(url.hostname)) return "REMOTE_MEDIA";
  if (url.origin === parsedOrigin.origin) return "LOCAL_APP";
  return "OTHER";
}

function pathClass(url: URL): string {
  if (url.pathname === "/_next/image") return "/_next/image";
  if (url.pathname.startsWith("/_next/static/")) return "/_next/static/[asset]";
  if (/\.(?:avif|gif|jpe?g|png|svg|webp)$/iu.test(url.pathname)) return "/[image]";
  const firstSegment = url.pathname.split("/").filter(Boolean)[0];
  return firstSegment ? `/${firstSegment}/[route]` : "/";
}

function messageClass(message: string): string {
  if (/timed?\s*out|timeout/iu.test(message)) return "TIMEOUT";
  if (/cancel(?:ed|led)|abort/iu.test(message)) return "CANCELLED";
  if (/name.*not.*resolved|dns|enotfound/iu.test(message)) return "DNS";
  if (/connection.*refused|econnrefused/iu.test(message)) return "CONNECTION_REFUSED";
  if (/content security policy|\bcsp\b/iu.test(message)) return "CSP";
  if (/hydration/iu.test(message)) return "HYDRATION";
  if (/failed to load resource/iu.test(message)) return "RESOURCE_LOAD_FAILED";
  if (/fetch failed|load failed|network/iu.test(message)) return "NETWORK";
  return "ERROR";
}

const localNextImageSource = "/brand/cybermedica-logo.png";
const liveTildaSource =
  "https://static.tildacdn.com/stor6162-6231-4365-b633-626361316364/47915533.png";

type ImageProbe = {
  status: number | null;
  contentType: string | null;
  elapsedMs: number;
  timedOut: boolean;
  errorClass: string | null;
  payloadValid: boolean;
};

type LiveTildaResult =
  | "LIVE_TILDA_PASS"
  | "LIVE_TILDA_EXTERNAL_UNAVAILABLE"
  | "LIVE_TILDA_LOCAL_FAILURE"
  | "UNCLASSIFIED_FAILURE";

type LiveTildaEvidence = {
  optimizer: ImageProbe;
  upstream: ImageProbe;
  dns: "PASS" | "FAIL" | "TIMEOUT";
  serverProcess: "RUNNING" | "EXITED" | "UNKNOWN";
  serverEvidence: string;
};

function positiveBoundedTimeout(name: string, fallback: number, maximum: number): number {
  const value = Number(process.env[name] ?? String(fallback));
  assert.ok(
    Number.isSafeInteger(value) && value > 0 && value <= maximum,
    `${name} must be a positive integer no greater than ${maximum}.`,
  );
  return value;
}

function errorDiagnostic(error: unknown): { timedOut: boolean; errorClass: string } {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = record.cause && typeof record.cause === "object"
    ? record.cause as Record<string, unknown>
    : {};
  const code = typeof record.code === "string"
    ? record.code
    : typeof cause.code === "string"
      ? cause.code
      : "";
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const timedOut = name === "TimeoutError" || /abort|timed?\s*out|timeout/iu.test(message);
  const errorClass = code || (timedOut ? "TIMEOUT" : messageClass(message));
  return { timedOut, errorClass: errorClass.replace(/[^A-Z0-9_-]/giu, "_").slice(0, 80) };
}

function validImagePayload(contentType: string | null, payload: Uint8Array): boolean {
  if (!contentType?.startsWith("image/") || payload.length < 4) return false;
  if (contentType.startsWith("image/png")) {
    return payload.length >= 8
      && Buffer.from(payload.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType.startsWith("image/jpeg")) return payload[0] === 0xff && payload[1] === 0xd8;
  if (contentType.startsWith("image/gif")) {
    return Buffer.from(payload.subarray(0, 4)).toString("ascii") === "GIF8";
  }
  if (contentType.startsWith("image/webp")) {
    return payload.length >= 12
      && Buffer.from(payload.subarray(0, 4)).toString("ascii") === "RIFF"
      && Buffer.from(payload.subarray(8, 12)).toString("ascii") === "WEBP";
  }
  if (contentType.startsWith("image/avif")) {
    return payload.length >= 12 && Buffer.from(payload.subarray(4, 12)).toString("ascii").includes("ftyp");
  }
  return payload.length > 0;
}

async function probeImage(url: URL, timeoutMs: number): Promise<ImageProbe> {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      headers: { accept: "image/webp,image/png,image/*;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type");
    return {
      status: response.status,
      contentType,
      elapsedMs: Math.round(performance.now() - startedAt),
      timedOut: false,
      errorClass: null,
      payloadValid: validImagePayload(contentType, payload),
    };
  } catch (error) {
    const diagnostic = errorDiagnostic(error);
    return {
      status: null,
      contentType: null,
      elapsedMs: Math.round(performance.now() - startedAt),
      timedOut: diagnostic.timedOut,
      errorClass: diagnostic.errorClass,
      payloadValid: false,
    };
  }
}

async function readServerEvidence(path: string | undefined, offset: number): Promise<string> {
  if (!path) return "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const log = await readFile(path);
      const evidence = log.subarray(offset).toString("utf8");
      if (evidence || attempt === 3) return evidence;
    } catch {
      if (attempt === 3) return "";
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return "";
}

function serverLogSummary(evidence: string): string {
  const classes = [
    "EACCES",
    "ENOENT",
    "MODULE_NOT_FOUND",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNRESET",
    "ECONNREFUSED",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
  ].filter((entry) => evidence.includes(entry));
  if (/fetch failed/iu.test(evidence)) classes.push("FETCH_FAILED");
  if (/image.*(?:error|fail)|optimizer.*(?:error|fail)/iu.test(evidence)) classes.push("IMAGE_ERROR");
  return classes.length ? [...new Set(classes)].join(",") : evidence ? "OTHER" : "EMPTY";
}

function serverProcessState(): LiveTildaEvidence["serverProcess"] {
  const value = process.env.WEBKIT_SMOKE_SERVER_PID;
  if (!value || !/^\d+$/u.test(value)) return "UNKNOWN";
  try {
    process.kill(Number(value), 0);
    return "RUNNING";
  } catch {
    return "EXITED";
  }
}

async function imageCacheState(root: string | undefined): Promise<string> {
  if (!root) return "NOT_CONFIGURED";
  const files: string[] = [];
  async function walk(directory: string, prefix = ""): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(directory, entry.name), relative);
      else if (entry.isFile()) files.push(relative);
    }
  }
  await walk(root);
  const metadata = files.filter((file) => file.endsWith("/metadata.json")).length;
  const payloads = files.filter((file) => file.endsWith("/payload.bin")).length;
  return `metadata:${metadata},payload:${payloads},files:${files.length}`;
}

function classifyLiveTilda(evidence: LiveTildaEvidence): LiveTildaResult {
  const localServerFailure = evidence.serverProcess === "EXITED"
    || /\b(?:EACCES|ENOENT|MODULE_NOT_FOUND)\b/u.test(evidence.serverEvidence);
  if (localServerFailure) return "LIVE_TILDA_LOCAL_FAILURE";

  if (
    evidence.optimizer.status === 200
    && /^image\//u.test(evidence.optimizer.contentType ?? "")
    && evidence.optimizer.payloadValid
  ) return "LIVE_TILDA_PASS";

  if (
    evidence.optimizer.status === 200
    || (evidence.optimizer.status !== null && evidence.optimizer.status < 500)
    || (evidence.optimizer.errorClass !== null && !evidence.optimizer.timedOut)
  ) return "LIVE_TILDA_LOCAL_FAILURE";

  const upstreamNonSuccess = evidence.upstream.status !== null
    && (evidence.upstream.status < 200 || evidence.upstream.status >= 400);
  const explicitExternalEvidence = evidence.dns !== "PASS"
    || evidence.upstream.timedOut
    || evidence.upstream.errorClass !== null
    || upstreamNonSuccess
    || (
      evidence.optimizer.status !== null
      && evidence.optimizer.status >= 500
      && nextImageTransportClass(evidence.serverEvidence) !== null
    );
  if (explicitExternalEvidence) return "LIVE_TILDA_EXTERNAL_UNAVAILABLE";

  if (evidence.optimizer.status !== null && evidence.optimizer.status >= 500) {
    return "LIVE_TILDA_LOCAL_FAILURE";
  }
  return "UNCLASSIFIED_FAILURE";
}

async function checkLocalNextImageIntegration(): Promise<void> {
  const optimizerUrl = new URL("/_next/image", parsedOrigin);
  optimizerUrl.searchParams.set("url", localNextImageSource);
  optimizerUrl.searchParams.set("w", "64");
  optimizerUrl.searchParams.set("q", "75");
  const timeout = positiveBoundedTimeout("WEBKIT_SMOKE_LOCAL_NEXT_IMAGE_TIMEOUT_MS", 4_000, 8_000);
  const probe = await probeImage(optimizerUrl, timeout);

  assert.equal(probe.status, 200, `Local NEXT_IMAGE returned ${probe.status ?? probe.errorClass}.`);
  assert.match(probe.contentType ?? "", /^image\//u, "Local NEXT_IMAGE returned a non-image Content-Type.");
  assert.ok(probe.payloadValid, "Local NEXT_IMAGE returned a malformed image payload.");
  console.log(`DETERMINISTIC_NEXT_IMAGE_SOURCE=${localNextImageSource}`);
  console.log("LOCAL_NEXT_IMAGE_HTTP=200");
  console.log(`LOCAL_NEXT_IMAGE_CONTENT_TYPE=${probe.contentType}`);
  console.log(`LOCAL_NEXT_IMAGE_ELAPSED_MS=${probe.elapsedMs}`);
  console.log("DETERMINISTIC_NEXT_IMAGE=PASS");
}

async function checkLiveTildaIntegration(): Promise<void> {
  const sourceUrl = new URL(liveTildaSource);
  assert.ok(isApprovedPublicMediaUrl(sourceUrl.toString()), "Live Tilda source must remain approved.");
  const optimizerUrl = new URL("/_next/image", parsedOrigin);
  optimizerUrl.searchParams.set("url", sourceUrl.toString());
  optimizerUrl.searchParams.set("w", "64");
  optimizerUrl.searchParams.set("q", "75");
  const optimizerTimeout = positiveBoundedTimeout("WEBKIT_SMOKE_LIVE_NEXT_IMAGE_TIMEOUT_MS", 8_000, 15_000);
  const upstreamTimeout = positiveBoundedTimeout("WEBKIT_SMOKE_LIVE_UPSTREAM_TIMEOUT_MS", 5_000, 10_000);
  const serverLogPath = process.env.WEBKIT_SMOKE_SERVER_LOG;
  let serverLogOffset = 0;
  if (serverLogPath) {
    try {
      serverLogOffset = (await stat(serverLogPath)).size;
    } catch {
      serverLogOffset = 0;
    }
  }

  let dns: LiveTildaEvidence["dns"] = "PASS";
  let dnsRecords = 0;
  try {
    const records = await Promise.race([
      lookup(sourceUrl.hostname, { all: true }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error("DNS_TIMEOUT")), 3_000);
      }),
    ]);
    dnsRecords = records.length;
    if (dnsRecords === 0) dns = "FAIL";
  } catch (error) {
    dns = error instanceof Error && error.message === "DNS_TIMEOUT" ? "TIMEOUT" : "FAIL";
  }

  const optimizer = await probeImage(optimizerUrl, optimizerTimeout);
  const serverEvidence = await readServerEvidence(serverLogPath, serverLogOffset);
  const upstream = await probeImage(sourceUrl, upstreamTimeout);
  const processState = serverProcessState();
  const cacheState = await imageCacheState(process.env.WEBKIT_SMOKE_IMAGE_CACHE_ROOT);
  const result = classifyLiveTilda({ optimizer, upstream, dns, serverProcess: processState, serverEvidence });

  console.log(`LIVE_TILDA_DNS=${dns} records=${dnsRecords}`);
  console.log(`LIVE_TILDA_UPSTREAM_STATUS=${upstream.status ?? "UNAVAILABLE"}`);
  console.log(`LIVE_TILDA_UPSTREAM_ELAPSED_MS=${upstream.elapsedMs}`);
  console.log(`LIVE_TILDA_UPSTREAM_TIMEOUT=${upstream.timedOut ? "YES" : "NO"}`);
  console.log(`LIVE_TILDA_LOCAL_STATUS=${optimizer.status ?? "UNAVAILABLE"}`);
  console.log(`LIVE_TILDA_LOCAL_ELAPSED_MS=${optimizer.elapsedMs}`);
  console.log(`LIVE_TILDA_LOCAL_TIMEOUT=${optimizer.timedOut ? "YES" : "NO"}`);
  console.log(`LIVE_TILDA_SERVER_PROCESS=${processState}`);
  console.log(`LIVE_TILDA_SERVER_LOG_TAIL=${serverLogSummary(serverEvidence)}`);
  console.log(`LIVE_TILDA_SERVER_ERROR=${serverLogSummary(serverEvidence)}`);
  console.log(`LIVE_TILDA_CACHE_STATE=${cacheState}`);
  console.log(`LIVE_TILDA_RESULT=${result}`);

  if (result === "LIVE_TILDA_PASS") {
    console.log("LIVE_TILDA_CLASSIFICATION=PASS");
    return;
  }
  if (result === "LIVE_TILDA_EXTERNAL_UNAVAILABLE") {
    console.warn("LIVE_TILDA_CLASSIFICATION=PROVEN_EXTERNAL_UNAVAILABLE");
    return;
  }
  const classification = result === "LIVE_TILDA_LOCAL_FAILURE"
    ? "BLOCKING_LOCAL_FAILURE"
    : "BLOCKING_UNCLASSIFIED";
  throw new Error(`LIVE_TILDA_CLASSIFICATION=${classification}`);
}

function checkNextImageClassificationContract(): void {
  const baseProbe: ImageProbe = {
    status: null,
    contentType: null,
    elapsedMs: 8_000,
    timedOut: true,
    errorClass: "TIMEOUT",
    payloadValid: false,
  };
  const healthyUpstream: ImageProbe = {
    status: 200,
    contentType: "image/png",
    elapsedMs: 50,
    timedOut: false,
    errorClass: null,
    payloadValid: true,
  };
  assert.equal(classifyLiveTilda({
    optimizer: { ...baseProbe, timedOut: false, errorClass: "EACCES" },
    upstream: healthyUpstream,
    dns: "PASS",
    serverProcess: "RUNNING",
    serverEvidence: "EACCES",
  }), "LIVE_TILDA_LOCAL_FAILURE");
  assert.equal(classifyLiveTilda({
    optimizer: baseProbe,
    upstream: { ...baseProbe, elapsedMs: 5_000 },
    dns: "PASS",
    serverProcess: "RUNNING",
    serverEvidence: "",
  }), "LIVE_TILDA_EXTERNAL_UNAVAILABLE");
  assert.equal(classifyLiveTilda({
    optimizer: baseProbe,
    upstream: healthyUpstream,
    dns: "PASS",
    serverProcess: "RUNNING",
    serverEvidence: "",
  }), "UNCLASSIFIED_FAILURE");
  console.log("LOCAL_OPTIMIZER_FAILURE=BLOCKING PASS");
  console.log("PROVEN_EXTERNAL_FAILURE=NONBLOCKING PASS");
  console.log("UNCLASSIFIED_TIMEOUT=BLOCKING PASS");
}

function requestDiagnostic(event: string, request: Request, detail: string): string {
  const url = new URL(request.url());
  const detailClass = /^HTTP_[45]\d\d$/u.test(detail) ? detail : messageClass(detail);
  return `${event} class=${classifyUrl(url)} host=${url.hostname} path=${pathClass(url)}`
    + ` resource=${request.resourceType()} detail=${detailClass}`;
}

function remoteMediaSource(requestUrl: URL): URL | undefined {
  if (requestUrl.origin === parsedOrigin.origin && requestUrl.pathname === "/_next/image") {
    const source = requestUrl.searchParams.get("url");
    if (!source || !isApprovedPublicMediaUrl(source)) return undefined;
    return new URL(source);
  }
  if (isApprovedPublicMediaUrl(requestUrl.toString())) return requestUrl;
  return undefined;
}

function shouldInterceptRemoteMedia(request: Request): URL | undefined {
  if (remoteMediaMode !== "fixture") return undefined;
  const requestUrl = new URL(request.url());
  const source = remoteMediaSource(requestUrl);
  if (!source) return undefined;
  const resourceType = request.resourceType();
  if (requestUrl.pathname === "/_next/image" || resourceType === "image" || resourceType === "media") {
    return source;
  }
  return undefined;
}

async function checkNextImageIntegration(): Promise<void> {
  const source = process.env.WEBKIT_SMOKE_NEXT_IMAGE_SOURCE
    ?? liveTildaSource;
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    throw new Error("NEXT_IMAGE integration failed class=LOCAL_OPTIMIZER_OR_CONFIG_FAILURE reason=UNSUPPORTED_MEDIA_HOST");
  }
  const approvedSourceHost = isApprovedPublicMediaUrl(source);
  if (!approvedSourceHost) {
    throw new Error(
      `NEXT_IMAGE integration failed class=LOCAL_OPTIMIZER_OR_CONFIG_FAILURE`
        + ` reason=UNSUPPORTED_MEDIA_HOST host=${sourceUrl.hostname}`,
    );
  }
  const optimizerUrl = new URL("/_next/image", parsedOrigin);
  optimizerUrl.searchParams.set("url", source);
  optimizerUrl.searchParams.set("w", "64");
  optimizerUrl.searchParams.set("q", "75");
  const timeout = Number(process.env.WEBKIT_SMOKE_NEXT_IMAGE_TIMEOUT_MS ?? "8000");
  assert.ok(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 15_000, "Invalid optimizer timeout.");
  const serverLogPath = process.env.WEBKIT_SMOKE_SERVER_LOG;
  let serverLogOffset = 0;
  if (serverLogPath) {
    try {
      serverLogOffset = (await stat(serverLogPath)).size;
    } catch {
      serverLogOffset = 0;
    }
  }

  let response: Response;
  try {
    response = await fetch(optimizerUrl, { signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    const detail = error instanceof Error ? messageClass(error.message) : "ERROR";
    throw new Error(`NEXT_IMAGE LOCAL_APP request failed detail=${detail}`);
  }
  let serverEvidence = "";
  if (serverLogPath) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const log = await readFile(serverLogPath);
        serverEvidence = log.subarray(serverLogOffset).toString("utf8");
      } catch {
        serverEvidence = "";
      }
      if (nextImageTransportClass(serverEvidence) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  const decision = classifyNextImageIntegration({
    approvedSourceHost,
    routeResponded: true,
    status: response.status,
    contentType: response.headers.get("content-type"),
    serverEvidence,
  });
  const safeEvidence = `host=${sourceUrl.hostname} status=${response.status}`
    + (decision.transportClass ? ` transport=${decision.transportClass}` : "");

  if (decision.outcome === "PASS") {
    console.log(`NEXT_IMAGE_INTEGRATION=PASS ${safeEvidence}`);
    return;
  }
  if (decision.outcome === "DEGRADED_EXTERNAL_UPSTREAM") {
    console.warn(
      `NEXT_IMAGE_INTEGRATION=DEGRADED_EXTERNAL_UPSTREAM ${safeEvidence}`,
    );
    return;
  }
  throw new Error(
    `NEXT_IMAGE integration failed class=${decision.failureClass}`
      + ` reason=${decision.reason} ${safeEvidence}`,
  );
}

if (process.env.WEBKIT_SMOKE_MODE === "next-image-local") {
  await checkLocalNextImageIntegration();
  process.exit(0);
}

if (process.env.WEBKIT_SMOKE_MODE === "next-image-live") {
  await checkLiveTildaIntegration();
  process.exit(0);
}

if (process.env.WEBKIT_SMOKE_MODE === "next-image-classification") {
  checkNextImageClassificationContract();
  process.exit(0);
}

if (process.env.WEBKIT_SMOKE_MODE === "next-image") {
  await checkNextImageIntegration();
  process.exit(0);
}

const browser = await webkit.launch({ headless: true });
const interceptedRemoteHosts = new Set<string>();
let supabaseRequests = 0;

try {
  for (const profile of profiles) {
    // Every context starts with isolated storage, matching private/fresh-session
    // behavior while also exercising consecutive navigation in one session.
    const context = await browser.newContext({
      viewport: profile.viewport,
      ...(profile.userAgent ? { userAgent: profile.userAgent } : {}),
    });
    if (remoteMediaMode === "fixture") {
      await context.route("**/*", async (route) => {
        const source = shouldInterceptRemoteMedia(route.request());
        if (!source) {
          await route.continue();
          return;
        }
        interceptedRemoteHosts.add(source.hostname);
        await route.fulfill({ status: 200, contentType: "image/png", body: deterministicPng });
      });
    }
    for (const route of routes) {
      const page = await context.newPage();
      const runtimeFailures: string[] = [];
      const diagnostics: string[] = [];
      page.on("request", (request) => {
        if (classifyUrl(new URL(request.url())) === "SUPABASE") supabaseRequests += 1;
      });
      page.on("requestfailed", (request) => {
        const diagnostic = requestDiagnostic(
          "requestfailed",
          request,
          request.failure()?.errorText ?? "unknown",
        );
        diagnostics.push(diagnostic);
        runtimeFailures.push(diagnostic);
      });
      page.on("response", (response) => {
        if (response.status() < 400) return;
        const diagnostic = requestDiagnostic(
          "response",
          response.request(),
          `HTTP_${response.status()}`,
        );
        diagnostics.push(diagnostic);
        runtimeFailures.push(diagnostic);
      });
      page.on("pageerror", (error) => {
        const name = error.name.replace(/[^a-z0-9_.-]/giu, "").slice(0, 40) || "Error";
        const diagnostic = `pageerror name=${name} detail=${messageClass(error.message)}`;
        diagnostics.push(diagnostic);
        runtimeFailures.push(diagnostic);
      });
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const isVercelPreviewToolbarCsp = parsedOrigin.hostname.endsWith(".vercel.app")
          && message.text().includes(
            "https://vercel.live/_next-live/feedback/feedback.js",
          );
        if (isVercelPreviewToolbarCsp) return;
        const locationUrl = message.location().url;
        const source = locationUrl ? new URL(locationUrl, parsedOrigin) : new URL(origin);
        const diagnostic = `console:error class=${classifyUrl(source)} host=${source.hostname}`
          + ` path=${pathClass(source)} detail=${messageClass(message.text())}`;
        diagnostics.push(diagnostic);
        runtimeFailures.push(diagnostic);
      });
      const response = await page.goto(new URL(route, parsedOrigin).toString(), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      assert.equal(
        response?.status(),
        200,
        `${profile.name}: ${route} must return HTTP 200.\n${diagnostics.join("\n")}`,
      );
      await page.waitForFunction(
        () => (document.body?.innerText ?? "").trim().length > 200,
        { timeout: 30_000 },
      );
      await page.locator('[aria-label="Загрузка страницы"]').waitFor({
        state: "detached",
        timeout: 30_000,
      });
      assert.ok(
        (await page.locator("body").innerText()).trim().length > 0,
        `${profile.name}: ${route} must render visible text in WebKit.`,
      );
      assert.equal(
        await page.locator('[aria-label="Загрузка страницы"]').count(),
        0,
        `${profile.name}: ${route} must not leave the streaming fallback mounted.`,
      );
      assert.deepEqual(
        runtimeFailures,
        [],
        `${profile.name}: ${route} must not emit runtime errors.\n${diagnostics.join("\n")}`,
      );
      await page.close();
    }
    await context.close();
  }
  if (process.env.WEBKIT_SMOKE_ASSERT_NO_SUPABASE === "1") {
    assert.equal(supabaseRequests, 0, "Fault-injection WebKit smoke must not request Supabase.");
  }
  if (process.env.WEBKIT_SMOKE_REQUIRE_REMOTE_MEDIA_INTERCEPTION === "1") {
    assert.ok(interceptedRemoteHosts.size > 0, "Fault-injection smoke must exercise remote media interception.");
  }
  console.log(
    `WebKit smoke passed for ${profiles.length} profiles and ${routes.length} routes; `
      + `remote media hosts intercepted=${[...interceptedRemoteHosts].sort().join(",") || "none"}; `
      + `Supabase requests=${supabaseRequests}.`,
  );
} finally {
  await browser.close();
}
