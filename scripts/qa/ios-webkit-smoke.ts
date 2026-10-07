import assert from "node:assert/strict";

import { webkit } from "playwright-core";
import type { Request } from "playwright-core";

import {
  APPROVED_PUBLIC_MEDIA_HOSTS,
  isApprovedPublicMediaUrl,
} from "../../lib/public-media-policy.ts";

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
    ?? "https://static.tildacdn.com/stor6162-6231-4365-b633-626361316364/47915533.png";
  assert.ok(isApprovedPublicMediaUrl(source), "Next image integration source must be approved public media.");
  const optimizerUrl = new URL("/_next/image", parsedOrigin);
  optimizerUrl.searchParams.set("url", source);
  optimizerUrl.searchParams.set("w", "64");
  optimizerUrl.searchParams.set("q", "75");
  const timeout = Number(process.env.WEBKIT_SMOKE_NEXT_IMAGE_TIMEOUT_MS ?? "8000");
  assert.ok(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 15_000, "Invalid optimizer timeout.");

  let response: Response;
  try {
    response = await fetch(optimizerUrl, { signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    const detail = error instanceof Error ? messageClass(error.message) : "ERROR";
    throw new Error(`NEXT_IMAGE LOCAL_APP request failed detail=${detail}`);
  }
  if (response.status === 200) {
    assert.match(
      response.headers.get("content-type") ?? "",
      /^image\//u,
      "NEXT_IMAGE optimizer must return image content.",
    );
    console.log("NEXT_IMAGE integration passed for approved REMOTE_MEDIA source.");
    return;
  }

  const body = (await response.text()).slice(0, 500);
  const upstreamFailure = response.status >= 500
    && /upstream|fetch|network|timeout|response failed/iu.test(body);
  const failureClass = upstreamFailure ? "REMOTE_MEDIA_UPSTREAM" : "LOCAL_APP_OR_CONFIG";
  throw new Error(`NEXT_IMAGE integration failed class=${failureClass} status=${response.status}`);
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
