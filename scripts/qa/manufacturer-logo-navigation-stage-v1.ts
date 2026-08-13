import { mkdir, writeFile } from "node:fs/promises";

import { chromium, webkit, type BrowserType } from "playwright-core";

import logoReport from "../../docs/reports/all-manufacturer-logos-stage-v1.json" with { type: "json" };
import navigationReport from "../../docs/reports/navigation-breadcrumb-audit-v1.json" with { type: "json" };

const baseUrl = process.env.STAGE_BASE_URL ?? "http://127.0.0.1:3000";
const evidenceDir = process.env.STAGE_EVIDENCE_DIR
  ?? "/tmp/manufacturer-logo-navigation-stage-v1-screenshots";
const captureScreenshots = process.env.STAGE_CAPTURE_SCREENSHOTS === "1";

const representativeProductRoutes = [
  "/catalog/767632362-330695211247-apparat-ivl-hamilton-t1",
  "/catalog/medinova-br-1231",
  "/catalog/videoendoskopicheskaya-sistema-sonoscape-hd-550",
  "/catalog/bowa-arc-350",
  "/catalog/767632362-401374530532-apparat-ivl-mindray-sv300",
];
const seoRoutes = [
  "/catalog/endoskopiya",
  "/catalog/endoskopiya/videoendoskopicheskie-sistemy",
  "/solutions/portativnaya-bronkhoskopiya",
  "/catalog/endoskopiya/obrabotka-endoskopov",
  "/catalog/reanimatsiya/transportnye-apparaty-ivl",
  "/catalog/anesteziologiya/narkozno-dykhatelnye-apparaty",
];
const routes = [
  "/",
  "/catalog",
  "/manufacturers",
  "/solutions",
  "/products/fs510",
  ...logoReport.manufacturers.map(({ slug }) => `/manufacturers/${slug}`),
  ...representativeProductRoutes,
  ...seoRoutes,
];

if (captureScreenshots) await mkdir(evidenceDir, { recursive: true });

async function runProfile(
  browserType: BrowserType,
  label: string,
  viewport: { width: number; height: number },
) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  const failedAssets: string[] = [];
  const externalLogoRequests: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (/\/manufacturers\/[^/]+\/logo\./u.test(url)) {
      if (response.status() >= 400) failedAssets.push(`${response.status()} ${url}`);
      if (!url.startsWith(baseUrl)) externalLogoRequests.push(url);
    }
  });

  const results = [];
  for (const route of routes) {
    const response = await page.goto(new URL(route, baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    if (!response || response.status() !== 200) {
      throw new Error(`${label}: ${route} returned ${response?.status() ?? "no response"}`);
    }
    const bodyText = await page.locator("body").innerText();
    if (/Назад к каталогу|← Все производители|Кибермедика · Каталог/iu.test(bodyText)) {
      throw new Error(`${label}: ${route} exposes a legacy navigation pattern`);
    }
    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (layout.scrollWidth > layout.clientWidth + 1) {
      throw new Error(`${label}: horizontal overflow on ${route}`);
    }

    const breadcrumbCount = await page.locator('[data-testid="canonical-breadcrumbs"]').count();
    if (route === "/") {
      if (breadcrumbCount !== 0) throw new Error(`${label}: homepage has breadcrumbs`);
    } else if (breadcrumbCount !== 1) {
      throw new Error(`${label}: expected one breadcrumb on ${route}, got ${breadcrumbCount}`);
    }
    if (route !== "/") {
      const currentCount = await page.locator('[data-testid="canonical-breadcrumbs"] [aria-current="page"]').count();
      if (currentCount !== 1) throw new Error(`${label}: missing unique aria-current on ${route}`);
    }
    if (route === "/manufacturers") {
      const graphicCount = await page.locator('[data-logo-kind="graphic"]').count();
      const fallbackCount = await page.locator('[data-logo-kind="fallback"]').count();
      if (graphicCount !== 25 || fallbackCount !== 0) {
        throw new Error(`${label}: expected 25/0 graphic/fallback marks, got ${graphicCount}/${fallbackCount}`);
      }
    }
    results.push({ route, status: response.status(), breadcrumbCount, ...layout });
  }

  if (failedAssets.length > 0) throw new Error(`${label}: broken assets: ${failedAssets.join(", ")}`);
  if (externalLogoRequests.length > 0) {
    throw new Error(`${label}: external logo requests: ${externalLogoRequests.join(", ")}`);
  }
  if (captureScreenshots) {
    await page.goto(new URL("/manufacturers", baseUrl).toString(), { waitUntil: "networkidle" });
    await page.screenshot({ path: `${evidenceDir}/manufacturers-${label}.png`, fullPage: true });
    await page.goto(new URL(representativeProductRoutes[0]!, baseUrl).toString(), { waitUntil: "networkidle" });
    await page.screenshot({ path: `${evidenceDir}/hamilton-${label}.png`, fullPage: true });
  }
  await browser.close();
  return { label, routeCount: results.length, results, failedAssets, externalLogoRequests };
}

const profiles = [
  await runProfile(chromium, "chromium-desktop", { width: 1440, height: 900 }),
  await runProfile(chromium, "chromium-mobile-390", { width: 390, height: 844 }),
  await runProfile(webkit, "webkit-iphone-390", { width: 390, height: 844 }),
];
const result = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  expectedRoutes: routes.length,
  reportRoutes: navigationReport.routes.length,
  profiles,
};
await writeFile("/tmp/manufacturer-logo-navigation-stage-v1-qa.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", ...result }, null, 2));
