import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import nextConfig, {
  contentSecurityPolicy,
  securityHeaders,
} from "../../next.config.ts";
import { internalRouteMetadata } from "../../lib/internal-access.ts";
import {
  classifySmokeError,
  normalizePreviewBaseUrl,
  runPreviewSmoke,
} from "../../scripts/qa/preview-smoke.ts";

test("security headers are applied globally with only approved public media origins", async () => {
  assert.equal(nextConfig.poweredByHeader, false);
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers!();
  const global = rules.find((rule) => rule.source === "/(.*)");
  assert.ok(global);
  const headers = Object.fromEntries(
    global.headers.map((header) => [header.key.toLowerCase(), header.value]),
  );
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["cross-origin-opener-policy"], "same-origin");
  assert.match(headers["permissions-policy"], /camera=\(\)/);
  assert.equal(headers["content-security-policy"], contentSecurityPolicy);
  assert.match(contentSecurityPolicy, /default-src 'self'/);
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
  assert.deepEqual(
    [...new Set(contentSecurityPolicy.match(/https?:\/\/[^\s;]+/gu) ?? [])],
    [
      "https://mc.yandex.ru",
      "https://mc.yandex.com",
      "https://yastatic.net",
      "https://cyber-medica.ru",
      "https://static.tildacdn.com",
    ],
  );
  assert.doesNotMatch(contentSecurityPolicy, /supabase|webhook/i);
  assert.ok(securityHeaders.length >= 6);
});

test("www permanently redirects to the canonical apex domain", async () => {
  assert.equal(typeof nextConfig.redirects, "function");
  const redirects = await nextConfig.redirects!();

  assert.deepEqual(redirects, [
    {
      source: "/:path*",
      has: [{ type: "host", value: "www.cyber-medica.ru" }],
      destination: "https://cyber-medica.ru/:path*",
      permanent: true,
    },
  ]);
});

test("request API receives an explicit no-store header rule", async () => {
  const rules = await nextConfig.headers!();
  const api = rules.find((rule) => rule.source === "/api/request");
  assert.ok(api);
  assert.match(
    api.headers.find((header) => header.key === "Cache-Control")?.value ?? "",
    /no-store/,
  );
});

test("thanks page is noindex with an explicit canonical and absent from sitemap", async () => {
  const [thanks, sitemap] = await Promise.all([
    readFile("app/thanks/page.tsx", "utf8"),
    readFile("app/sitemap.ts", "utf8"),
  ]);
  assert.match(thanks, /canonical:\s*["']\/thanks["']/);
  assert.match(thanks, /robots:\s*\{/);
  assert.match(thanks, /index:\s*false/);
  assert.match(thanks, /follow:\s*false/);
  assert.doesNotMatch(sitemap, /url\(["']\/thanks["']\)/);
});

test("thanks page keeps a private single-action confirmation contract", async () => {
  const [thanks, requestForm, requestRoute] = await Promise.all([
    readFile("app/thanks/page.tsx", "utf8"),
    readFile("components/request/RequestForm.tsx", "utf8"),
    readFile("app/api/request/route.ts", "utf8"),
  ]);

  assert.match(thanks, /<h1[^>]*>[\s\S]*Заявка отправлена[\s\S]*<\/h1>/u);
  assert.match(thanks, /role="status"/u);
  assert.match(thanks, /aria-live="polite"/u);
  assert.match(thanks, /aria-hidden="true"/u);
  assert.match(thanks, /href="\/catalog"/u);
  assert.match(thanks, /Вернуться в каталог/u);
  assert.doesNotMatch(
    thanks,
    /База знаний|Knowledge Base|knowledge-base|knowledgeBase/iu,
  );
  assert.doesNotMatch(thanks, /href="\/knowledge\//u);
  assert.doesNotMatch(
    thanks,
    /requestId|searchParams|email клиента|телефон|organization|RFQ payload/iu,
  );
  assert.match(thanks, /w-full sm:w-auto/u);
  assert.match(thanks, /!min-h-\[44px\]/u);
  assert.match(thanks, /max-w-xl/u);
  assert.match(thanks, /lg:min-h-\[calc\(100svh-14\.875rem\)\]/u);
  assert.match(requestForm, /router\.push\("\/thanks"\)/u);
  assert.doesNotMatch(requestRoute, /export async function GET/u);
});

test("disabled internal metadata reveals no route title and remains noindex", () => {
  const metadata = internalRouteMetadata(false, "Sensitive Internal Workspace");
  assert.equal(metadata.title, "Страница не найдена");
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.doesNotMatch(JSON.stringify(metadata), /Sensitive Internal Workspace/);
});

test("all internal pages retain production gates and access-boundary copy", async () => {
  const routes = [
    ["app/admin/page.tsx", "CYBERMEDICA_ENABLE_ADMIN"],
    ["app/internal/review-queue/page.tsx", "internalReviewEnabled"],
    ["app/internal/reviewer/page.tsx", "internalReviewEnabled"],
    ["app/internal/import-center/page.tsx", "CYBERMEDICA_ENABLE_IMPORT_CENTER"],
    ["app/internal/wave2/page.tsx", "CYBERMEDICA_ENABLE_WAVE2_DASHBOARD"],
  ] as const;
  for (const [path, flag] of routes) {
    const source = await readFile(path, "utf8");
    assert.match(source, new RegExp(flag));
    assert.match(source, /notFound\(\)/);
    assert.match(source, /internalRouteMetadata/);
    assert.match(source, /Deployment Protection/);
  }
});

test("env example documents every required flag without values", async () => {
  const source = await readFile(".env.example", "utf8");
  const variables = [
    "CYBERMEDICA_ENABLE_ADMIN",
    "CYBERMEDICA_ENABLE_INTERNAL_REVIEW",
    "CYBERMEDICA_ENABLE_IMPORT_CENTER",
    "CYBERMEDICA_ENABLE_WAVE2_DASHBOARD",
    "CYBERMEDICA_LEADS_WEBHOOK_URL",
    "CYBERMEDICA_LEADS_WEBHOOK_TOKEN",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_YANDEX_METRICA_ID",
    "CATALOG_RESEARCH_PROVIDER",
    "CHROME_PATH",
    "PDFTOTEXT_PATH",
    "PYTHON_PATH",
  ];
  for (const variable of variables) {
    assert.match(source, new RegExp(`^${variable}=$`, "m"));
  }
  assert.match(source, /SERVER-ONLY/);
  assert.match(source, /INTERNAL-ONLY/);
  assert.match(source, /IMPORT-ONLY/);
  assert.match(source, /BROWSER-SAFE/);
  assert.match(source, /FORBIDDEN IN BROWSER/);
  assert.doesNotMatch(source, /^[A-Z][A-Z0-9_]+=.+$/m);
});

test("request endpoint keeps bounded fields, payload guard, timeout and PII-safe logging", async () => {
  const source = await readFile("app/api/request/route.ts", "utf8");
  assert.match(source, /\.slice\(0, limits\[field\]\)/);
  assert.match(source, /contentLength > 100_000/);
  assert.match(source, /AbortSignal\.timeout\(10_000\)/);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)/);
});

test("smoke URL validation permits only credential-free HTTP origins", () => {
  assert.equal(
    normalizePreviewBaseUrl("https://preview.example.test/"),
    "https://preview.example.test",
  );
  assert.throws(() => normalizePreviewBaseUrl("ftp://preview.example.test"));
  assert.throws(() => normalizePreviewBaseUrl("https://user:pass@example.test"));
  assert.throws(() => normalizePreviewBaseUrl("https://example.test/path"));
  assert.throws(() => normalizePreviewBaseUrl("https://example.test/?token=x"));
});

test("smoke timeout and network errors are classified deterministically", () => {
  assert.equal(
    classifySmokeError(new DOMException("aborted", "AbortError")),
    "timeout",
  );
  assert.equal(classifySmokeError(new Error("connection refused")), "network_error");
});

test("Deployment Protection is a successful protected-preview classification", async () => {
  const fetchImpl = (async () =>
    new Response("Authentication Required", { status: 401 })) as typeof fetch;
  const result = await runPreviewSmoke("https://preview.example.test", {
    fetchImpl,
  });
  assert.equal(result.status, "protected_preview");
  assert.equal(result.failed, 0);
});

test("preview hardening imports no protected writers or secrets", async () => {
  const paths = [
    "next.config.ts",
    "lib/internal-access.ts",
    "scripts/qa/preview-smoke.ts",
  ];
  const source = (
    await Promise.all(paths.map((path) => readFile(path, "utf8")))
  ).join("\n");
  assert.doesNotMatch(
    source,
    /createClient|service_role|supabaseWrites|publishClaim|VerifiedClaim|ReviewDecision/,
  );
  assert.doesNotMatch(
    source,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{30,}|sk-proj-[A-Za-z0-9_-]{20,}/,
  );
});
