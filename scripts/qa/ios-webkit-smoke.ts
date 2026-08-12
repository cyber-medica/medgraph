import assert from "node:assert/strict";

import { webkit } from "playwright-core";

const defaultProductPath = process.env.WEBKIT_SMOKE_PRODUCT_PATH
  ?? "/catalog/767632362-330695211247-apparat-ivl-hamilton-t1";
const origin = process.env.WEBKIT_SMOKE_ORIGIN ?? "http://127.0.0.1:3000";
const parsedOrigin = new URL(origin);
const approvedOrigin =
  (parsedOrigin.protocol === "https:" && (
    parsedOrigin.hostname === "cyber-medica.ru"
    || parsedOrigin.hostname === "www.cyber-medica.ru"
    || parsedOrigin.hostname.endsWith(".vercel.app")
  ))
  || (parsedOrigin.protocol === "http:"
    && ["127.0.0.1", "localhost"].includes(parsedOrigin.hostname));

assert.ok(approvedOrigin, "WEBKIT_SMOKE_ORIGIN must be an approved public or loopback origin.");

const routes = [
  "/",
  "/catalog",
  "/request",
  defaultProductPath,
  "/internal/login",
] as const;

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

const browser = await webkit.launch({ headless: true });

try {
  for (const profile of profiles) {
    // Every context starts with isolated storage, matching private/fresh-session
    // behavior while also exercising consecutive navigation in one session.
    const context = await browser.newContext({
      viewport: profile.viewport,
      ...(profile.userAgent ? { userAgent: profile.userAgent } : {}),
    });
    for (const route of routes) {
      const page = await context.newPage();
      const runtimeErrors: string[] = [];
      page.on("pageerror", (error) => runtimeErrors.push(error.name));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const isVercelPreviewToolbarCsp = parsedOrigin.hostname.endsWith(".vercel.app")
          && message.text().includes(
            "https://vercel.live/_next-live/feedback/feedback.js",
          );
        if (!isVercelPreviewToolbarCsp) runtimeErrors.push("console:error");
      });
      const response = await page.goto(new URL(route, parsedOrigin).toString(), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      assert.equal(response?.status(), 200, `${profile.name}: ${route} must return HTTP 200.`);
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
        runtimeErrors,
        [],
        `${profile.name}: ${route} must not emit runtime errors.`,
      );
      await page.close();
    }
    await context.close();
  }
  console.log(`WebKit smoke passed for ${profiles.length} profiles and ${routes.length} routes.`);
} finally {
  await browser.close();
}
