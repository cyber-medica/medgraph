import assert from "node:assert/strict";

import { webkit } from "playwright-core";

import {
  CANONICAL_HOST,
  assertNoLegacyPageShell,
  extractSitemapProductPaths,
} from "../../lib/canonical-routing-gate.ts";

const origin = new URL(process.env.CANONICAL_ROUTING_ORIGIN ?? `https://${CANONICAL_HOST}`);
assert.equal(origin.hostname, CANONICAL_HOST);

const sitemapResponse = await fetch(new URL(`/sitemap.xml?mobile_synthetic=${Date.now()}`, origin), {
  cache: "no-store",
  signal: AbortSignal.timeout(20_000),
});
assert.equal(sitemapResponse.status, 200);
const sitemapPaths = extractSitemapProductPaths(await sitemapResponse.text());
assert.ok(sitemapPaths.size > 0);
const stableDetailPath = [...sitemapPaths].sort()[0];

const browser = await webkit.launch({ headless: true });
try {
  const context = await browser.newContext({
    serviceWorkers: "block",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) "
      + "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const runtimeErrors: string[] = [];

  for (const route of ["/", "/catalog", stableDetailPath, "/request"] as const) {
    // A fresh page models a cold/direct iPhone navigation without cancelling
    // Next.js prefetches from the previously tested document. WebKit reports
    // those synthetic cross-navigation cancellations as page errors even
    // though neither the source nor destination route failed.
    const page = await context.newPage();
    page.on("pageerror", (error) => runtimeErrors.push(error.name));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push("console:error");
    });
    const response = await page.goto(new URL(`${route}?mobile_synthetic=${Date.now()}`, origin).toString(), {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });
    assert.equal(response?.status(), 200, `${route} must return HTTP 200`);
    assert.equal(response?.headers().server, "Vercel", `${route} must be served by Vercel`);
    assert.equal(response?.headers()["x-cybermedica-origin"], "medgraph");
    await page.waitForFunction(
      () => (document.body?.innerText ?? "").trim().length > 200,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(500);
    assert.ok((await page.locator("body").innerText()).trim().length > 200, `${route} rendered blank`);
    assertNoLegacyPageShell(await page.content(), route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `${route} has horizontal mobile overflow`);
    await page.close();
  }
  assert.deepEqual(runtimeErrors, [], "iPhone WebKit emitted runtime errors");
  await context.close();
} finally {
  await browser.close();
}

console.info(JSON.stringify({ owner: "cybermedicaooo@gmail.com", productUrls: sitemapPaths.size, status: "pass" }));
