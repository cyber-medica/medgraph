import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("root layout keeps the server-rendered shell visible when catalog transport fails", async () => {
  const layout = await source("app/layout.tsx");

  assert.match(layout, /import "\.\/globals\.css";/u);
  assert.match(layout, /from "@\/lib\/storefront\/data-source"/u);
  assert.match(layout, /products=\{\[\]\}/u);
  assert.match(layout, /manufacturers=\{\[\]\}/u);
  assert.match(layout, /categories=\{\[\]\}/u);
  assert.doesNotMatch(layout, /loadHomepageOverviewSources/u);
  assert.doesNotMatch(layout, /from "@\/lib\/storefront";/u);
  assert.doesNotMatch(layout, /\bconnection\s*\(/u);
  assert.doesNotMatch(layout, /export default async function RootLayout/u);
});

test("route and root errors are fail-visible and expose only sanitized telemetry", async () => {
  const [routeError, globalError] = await Promise.all([
    source("app/error.tsx"),
    source("app/global-error.tsx"),
  ]);

  assert.match(routeError, /unstable_retry/u);
  assert.match(routeError, /digest: error\.digest \?\? "unavailable"/u);
  assert.doesNotMatch(routeError, /console\.error\([^\n]*error\)/u);

  assert.match(globalError, /^"use client";/u);
  assert.match(globalError, /<html lang="ru">/u);
  assert.match(globalError, /<body/u);
  assert.match(globalError, /Не удалось открыть страницу/u);
  assert.match(globalError, /unstable_retry/u);
  assert.match(globalError, /digest: error\.digest \?\? "unavailable"/u);
  assert.doesNotMatch(globalError, /error\.message|error\.stack/u);
});

test("public shell does not access browser-only APIs during SSR", async () => {
  const [layout, loading, globalError] = await Promise.all([
    source("app/layout.tsx"),
    source("app/loading.tsx"),
    source("app/global-error.tsx"),
  ]);
  const serverShell = `${layout}\n${loading}`;

  assert.doesNotMatch(
    serverShell,
    /\b(?:window|document|navigator|localStorage|sessionStorage|matchMedia|visualViewport)\s*[.(]/u,
  );
  assert.match(globalError, /"use client"/u);
});

test("WebKit smoke covers the public shell and prevents a stuck streaming fallback", async () => {
  const [smoke, policy, workflow, packageJson, globalStyles] = await Promise.all([
    source("scripts/qa/ios-webkit-smoke.ts"),
    source("scripts/qa/next-image-integration-policy.ts"),
    source(".github/workflows/catalog-reliability-gate.yml"),
    source("package.json"),
    source("app/globals.css"),
  ]);

  assert.match(smoke, /import \{ webkit \} from "playwright-core"/u);
  assert.match(smoke, /width: 390, height: 844/u);
  assert.match(smoke, /width: 844, height: 390/u);
  assert.match(smoke, /desktop Safari\/WebKit/u);
  assert.match(smoke, /CriOS/u);
  assert.match(smoke, /\/internal\/login/u);
  assert.match(smoke, /aria-label="Загрузка страницы"/u);
  assert.match(smoke, /runtimeFailures/u);
  assert.match(smoke, /WEBKIT_SMOKE_REMOTE_MEDIA_MODE/u);
  assert.match(smoke, /Deterministic remote media interception is allowed only for loopback smoke/u);
  assert.match(smoke, /isApprovedPublicMediaUrl/u);
  assert.match(smoke, /route\.fulfill\(\{ status: 200, contentType: "image\/png"/u);
  assert.match(smoke, /page\.on\("requestfailed"/u);
  assert.match(smoke, /page\.on\("response"/u);
  assert.match(smoke, /page\.on\("pageerror"/u);
  assert.match(smoke, /page\.on\("console"/u);
  assert.match(smoke, /NEXT_IMAGE/u);
  assert.match(smoke, /WEBKIT_SMOKE_SERVER_LOG/u);
  assert.match(smoke, /DEGRADED_EXTERNAL_UPSTREAM/u);
  assert.match(smoke, /REMOTE_MEDIA/u);
  assert.match(smoke, /SUPABASE/u);
  assert.match(smoke, /YANDEX/u);
  assert.match(smoke, /LOCAL_APP/u);
  assert.match(smoke, /OTHER/u);
  assert.doesNotMatch(smoke, /console\.error\([^)]*message\.text/u);
  assert.match(policy, /LOCAL_OPTIMIZER_OR_CONFIG_FAILURE/u);
  assert.match(policy, /REMOTE_MEDIA_UPSTREAM_FAILURE/u);
  assert.match(policy, /\bETIMEDOUT\b/u);
  assert.match(policy, /\bENOTFOUND\b/u);
  assert.match(workflow, /WEBKIT_SMOKE_REMOTE_MEDIA_MODE=fixture/u);
  assert.match(workflow, /WEBKIT_SMOKE_REQUIRE_REMOTE_MEDIA_INTERCEPTION=1/u);
  assert.match(workflow, /WEBKIT_SMOKE_ASSERT_NO_SUPABASE=1/u);
  assert.match(workflow, /WEBKIT_SMOKE_MODE=next-image/u);
  assert.match(workflow, /WEBKIT_SMOKE_NEXT_IMAGE_TIMEOUT_MS=8000/u);
  assert.match(workflow, /WEBKIT_SMOKE_SERVER_LOG/u);
  assert.match(packageJson, /"qa:ios-webkit-smoke"/u);
  assert.doesNotMatch(globalStyles, /fonts\.googleapis\.com/u);
});
