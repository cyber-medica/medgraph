import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

import { chromium, webkit, type BrowserType, type Page } from "playwright-core";

import stageCatalog from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };

const origin = new URL(process.env.ENDOMARKET_STAGE_ORIGIN ?? "http://127.0.0.1:3100");
const approvedOrigin =
  (origin.protocol === "https:" && origin.hostname.endsWith(".vercel.app"))
  || (origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname));

assert.ok(approvedOrigin, "ENDOMARKET_STAGE_ORIGIN must be a loopback or Vercel Preview origin.");
assert.equal(stageCatalog.summary.normalizedEquipmentRows, 51);
assert.equal(stageCatalog.summary.newDraftCandidates, 42);
assert.equal(stageCatalog.summary.existingDuplicateBindings, 9);
assert.equal(stageCatalog.summary.sourceSpecifications, 128);

const detailProducts = [
  "sonoscape-eg-430",
  "sonoscape-eg-500",
  "sonoscape-ec-430t",
  "sonoscape-ec-500t",
  "sonoscape-eb-500",
  "sonoscape-eb-5h20",
  "medinova-br-1231",
  "medinova-br-1242",
  "medinova-ur-1328",
  "medinova-cy-1355",
  "medinova-endo-clean-1000",
  "medinova-endo-clean-2000",
  "medinova-ec-5bd",
  "medinova-ec-10bd",
  "erbe-vio-3",
  "bowa-arc-303",
  "bowa-arc-350",
  "ilivtouch-ilivtouch",
  "767632362-330695211247-apparat-ivl-hamilton-t1",
  "767632362-401374530532-apparat-ivl-mindray-sv300",
] as const;

const hiddenUnpublishedBindings = [
  "videoendoskopicheskaya-sistema-sonoscape-hd-550",
  "pentax-epk-i7010-optivista",
] as const;

const stageDraftSlugs = new Set(
  stageCatalog.products
    .filter(({ stageImport }) => stageImport.entityOrigin === "new_candidate")
    .map(({ slug }) => slug),
);
for (const slug of detailProducts.slice(0, 18)) {
  assert.ok(stageDraftSlugs.has(slug), `${slug}: missing Stage draft Product.`);
}

const evidenceDir = "docs/reports/evidence/endomarket-corrective-v4-2026-08-08";
const captureScreenshots = process.env.ENDOMARKET_STAGE_SCREENSHOTS === "1";
if (captureScreenshots) await mkdir(evidenceDir, { recursive: true });

const desktopDetailEvidence = new Map<string, string>([
  ["sonoscape-eg-430", "product-detail-eg-430"],
  ["sonoscape-ec-430t", "product-detail-ec-430t"],
  ["medinova-br-1231", "product-detail-br-1231"],
  ["medinova-endo-clean-1000", "product-detail-endo-clean-1000"],
  ["medinova-ec-5bd", "product-detail-ec-5bd"],
  ["bowa-arc-350", "product-detail-bowa-arc-350"],
  ["767632362-330695211247-apparat-ivl-hamilton-t1", "product-detail-hamilton-t1"],
]);

const runtimeErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${error.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const previewToolbarCsp = origin.hostname.endsWith(".vercel.app")
      && message.text().includes("https://vercel.live/_next-live/feedback/feedback.js");
    if (!previewToolbarCsp) errors.push(`console:error: ${message.text()}`);
  });
  return errors;
};

async function assertPage(page: Page, path: string, label: string) {
  const response = await page.goto(new URL(path, origin).toString(), {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  assert.equal(response?.status(), 200, `${label}: ${path} must return HTTP 200.`);
  assert.ok((await page.locator("body").innerText()).trim().length > 100, `${label}: ${path} is blank.`);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    true,
    `${label}: ${path} must not overflow horizontally.`,
  );
  assert.equal(await page.locator('[aria-label="Загрузка страницы"]').count(), 0, `${label}: streaming fallback remained mounted.`);
}

async function runProfile({
  browserType,
  label,
  viewport,
  detailCount,
  screenshotName,
}: {
  browserType: BrowserType;
  label: string;
  viewport: { width: number; height: number };
  detailCount: number;
  screenshotName?: string;
}) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    ...(browserType === webkit
      ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1" }
      : {}),
  });
  const page = await context.newPage();
  const errors = runtimeErrors(page);

  try {
    await assertPage(page, "/", label);
    await page.getByRole("heading", { name: "Сервис и сопровождение оборудования" }).waitFor();
    const popular = page.getByRole("region", { name: "Популярное медицинское оборудование" });
    await popular.waitFor();
    assert.equal(
      await popular.getByRole("link", { name: /^Подробнее о /u }).count(),
      8,
      `${label}: homepage must render exactly eight approved clean cards.`,
    );
    await page.getByText(
      "Оборудование для эндоскопии, диагностики и оснащения клиник — в наличии и с рассрочкой 0%.",
      { exact: true },
    ).waitFor();
    if (captureScreenshots && screenshotName) {
      await page.screenshot({ path: `${evidenceDir}/homepage-${screenshotName}.png`, fullPage: true });
      if (label === "chromium-desktop-1440") {
        await popular.screenshot({ path: `${evidenceDir}/popular-equipment-desktop.png` });
      }
    }

    await assertPage(page, "/catalog", label);
    await page.getByRole("heading", { name: "Каталог медицинских изделий" }).waitFor();
    assert.equal(await page.locator("article.group").count(), 113, `${label}: visible catalog must contain 113 Product cards.`);
    await page.getByText(/Найдено:\s*113\s*из 113/u).waitFor();
    assert.ok((await page.getByText("В наличии", { exact: true }).count()) >= 49, `${label}: visible EndoMarket presentations missing.`);
    assert.ok((await page.getByText("Рассрочка 0%", { exact: true }).count()) >= 49, `${label}: EndoMarket installment badges missing.`);
    assert.equal(await page.locator("article dl").count(), 0, `${label}: ProductCard leaked technical characteristics.`);
    const catalogText = await page.locator("body").innerText();
    assert.doesNotMatch(catalogText, /Made on Tilda|medvist\.ru|publication_status|review_state/iu);
    assert.doesNotMatch(catalogText, /щипцы|клапан для эндоскопа|моющее средство/iu);
    if (captureScreenshots && screenshotName) {
      await page.screenshot({ path: `${evidenceDir}/catalog-${screenshotName}.png`, fullPage: true });
    }

    await assertPage(page, "/catalog?q=EC-430T", label);
    assert.equal(await page.getByText(/EC-430T/u).count() > 0, true, `${label}: catalog search failed for EC-430T.`);
    if (captureScreenshots && label === "chromium-desktop-1440") {
      await page.screenshot({ path: `${evidenceDir}/catalog-search-ec-430t.png`, fullPage: true });
    }
    await assertPage(page, "/manufacturers/medinova", label);
    assert.equal(await page.getByText(/Medinova/u).count() > 0, true, `${label}: manufacturer route failed.`);
    if (captureScreenshots && label === "chromium-desktop-1440") {
      await page.screenshot({ path: `${evidenceDir}/manufacturer-medinova.png`, fullPage: true });
    }
    await assertPage(page, "/request", label);

    if (label === "chromium-desktop-1440") {
      for (const slug of hiddenUnpublishedBindings) {
        const response = await page.goto(new URL(`/catalog/${slug}`, origin).toString(), {
          waitUntil: "networkidle",
          timeout: 45_000,
        });
        assert.ok([200, 404].includes(response?.status() ?? 0), `${slug}: hidden route returned an unexpected transport status.`);
        assert.match(await response!.text(), /Страница не найдена/u, `${slug}: hidden binding did not resolve to notFound.`);
        assert.equal(await page.locator('a[href^="/request?"]').count(), 0, `${slug}: hidden binding exposed an RFQ action.`);
      }
    }

    for (const [detailIndex, slug] of detailProducts.slice(0, detailCount).entries()) {
      await assertPage(page, `/catalog/${slug}`, label);
      const text = await page.locator("body").innerText();
      if (detailIndex < 18) {
        assert.match(text, /В наличии/u, `${slug}: availability badge missing.`);
        assert.match(text, /Рассрочка 0%/u, `${slug}: installment badge missing.`);
        assert.match(text, /До 12 месяцев без удорожания/u, `${slug}: installment detail missing.`);
      }
      assert.equal(await page.locator('a[href^="/request?"]').count() > 0, true, `${slug}: RFQ action missing.`);
      assert.doesNotMatch(
        text,
        /Страна не указана|Профессиональное медицинское применение|Надежное решение для медицинских учреждений|Используется в клинической практике/iu,
      );
      assert.equal(
        await page.getByRole("heading", { name: "Производитель", exact: true }).count(),
        1,
        `${slug}: manufacturer block missing.`,
      );
      const manufacturerTop = await page.getByRole("heading", { name: "Производитель", exact: true }).evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
      const applications = page.getByRole("heading", { name: "Области применения", exact: true });
      if (await applications.count()) {
        const applicationsTop = await applications.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
        assert.ok(manufacturerTop > applicationsTop, `${slug}: manufacturer must be the last content block.`);
      }
      const detailEvidenceName = desktopDetailEvidence.get(slug);
      if (captureScreenshots && label === "chromium-desktop-1440" && detailEvidenceName) {
        await page.screenshot({ path: `${evidenceDir}/${detailEvidenceName}.png`, fullPage: true });
      }
    }

    if (captureScreenshots && screenshotName && detailCount > 0) {
      await page.goto(new URL(`/catalog/${detailProducts[Math.min(detailCount - 1, 9)]}`, origin).toString(), { waitUntil: "networkidle" });
      await page.screenshot({ path: `${evidenceDir}/product-detail-${screenshotName}.png`, fullPage: true });
    }
    assert.deepEqual(errors, [], `${label}: browser runtime errors detected.`);
  } finally {
    await context.close();
    await browser.close();
  }
}

await runProfile({ browserType: chromium, label: "chromium-desktop-1440", viewport: { width: 1440, height: 900 }, detailCount: 20, screenshotName: "desktop-1440" });
await runProfile({ browserType: chromium, label: "chromium-desktop-1280", viewport: { width: 1280, height: 800 }, detailCount: 3, screenshotName: "desktop-1280" });
await runProfile({ browserType: chromium, label: "chromium-tablet-landscape-1024", viewport: { width: 1024, height: 768 }, detailCount: 1 });
await runProfile({ browserType: chromium, label: "chromium-tablet-820", viewport: { width: 820, height: 1180 }, detailCount: 1 });
await runProfile({ browserType: webkit, label: "webkit-tablet-768", viewport: { width: 768, height: 1024 }, detailCount: 1 });
await runProfile({ browserType: webkit, label: "webkit-desktop-1440", viewport: { width: 1440, height: 900 }, detailCount: 3 });
await runProfile({ browserType: webkit, label: "webkit-iphone-se", viewport: { width: 375, height: 667 }, detailCount: 3, screenshotName: "iphone-se" });
await runProfile({ browserType: webkit, label: "webkit-iphone-13-mini", viewport: { width: 375, height: 812 }, detailCount: 3, screenshotName: "iphone-13-mini" });
await runProfile({ browserType: webkit, label: "webkit-mobile-390", viewport: { width: 390, height: 844 }, detailCount: 5, screenshotName: "mobile-390x844" });
await runProfile({ browserType: webkit, label: "webkit-iphone-14-pro-max", viewport: { width: 430, height: 932 }, detailCount: 3, screenshotName: "iphone-14-pro-max" });
await runProfile({ browserType: webkit, label: "webkit-iphone-landscape", viewport: { width: 844, height: 390 }, detailCount: 1, screenshotName: "iphone-landscape" });

const requestApi = await fetch(new URL("/api/request", origin), {
  redirect: "manual",
  signal: AbortSignal.timeout(12_000),
});
assert.equal(requestApi.status, 405, "GET /api/request must remain HTTP 405.");

console.info("EndoMarket Corrective v4 Stage smoke passed: 11 profiles, 44 Product Detail navigations, 113 visible Products.");
