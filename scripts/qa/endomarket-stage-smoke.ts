import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

import { chromium, webkit, type BrowserType, type Page } from "playwright-core";

import stageCatalog from "../../data/import/endomarket-wave1-stage-catalog.json" with { type: "json" };
import sourceTruth from "../../data/import/endomarket-source-truth-reconciliation-v5.json" with { type: "json" };
import finalAcceptance from "../../data/import/final-stage-acceptance-v2-audit.json" with { type: "json" };

const origin = new URL(process.env.ENDOMARKET_STAGE_ORIGIN ?? "http://127.0.0.1:3100");
const approvedOrigin =
  (origin.protocol === "https:" && origin.hostname.endsWith(".vercel.app"))
  || (origin.protocol === "https:" && origin.hostname === "stage.cyber-medica.ru")
  || (origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname));

assert.ok(approvedOrigin, "ENDOMARKET_STAGE_ORIGIN must be a loopback or Vercel Preview origin.");
assert.equal(stageCatalog.summary.normalizedEquipmentRows, 51);
assert.equal(stageCatalog.summary.newDraftCandidates, 43);
assert.equal(stageCatalog.summary.existingDuplicateBindings, 8);
assert.equal(stageCatalog.summary.sourceSpecifications, 294);
assert.equal(sourceTruth.counts.products, 42);
assert.equal(sourceTruth.counts.currentDescriptionMatches, 42);
assert.equal(sourceTruth.counts.currentFeatureExactMatches, 42);
assert.equal(sourceTruth.counts.currentSpecificationExactMatches, 42);
assert.equal(sourceTruth.counts.currentMediaExactMatches, 42);

const detailProducts = [
  ...sourceTruth.products.map(({ slug }) => slug),
  "767632362-330695211247-apparat-ivl-hamilton-t1",
  "767632362-241834833046-elektrokardiograf-comen-cm1200b",
  "767632362-401374530532-apparat-ivl-mindray-sv300",
  "767632362-776712772161-videoendoskopicheskaya-sistema-sonoscape",
  "767632362-697047413241-videoendoskopicheskaya-sistema-sonoscape",
  "videoendoskopicheskaya-sistema-sonoscape-hd-550",
];
const sourceTruthBySlug = new Map(sourceTruth.products.map((product) => [product.slug, product]));
const PRESENTATION_FEATURE_COUNTS: Record<string, number> = {
  "HV-3101": 4, AF: 6, "BR-1231": 7, "BR-1242": 7, "BR-1249": 7, "BR-1259": 7,
  "UR-1328": 6, "CY-1355": 6, "CY-1356": 6, "19 HD": 7, "24 Full HD": 7,
  "27 Full HD": 7, "32 4K": 7, "55 4K": 7, "EG-UR5": 5, "EG-UC5T": 7,
  "EG-500": 8, "EG-500L": 8, "EG-430": 8, "EG-430L": 8, "EC-500T": 8,
  "EC-500L/T": 8, "EC-430T": 8, "EC-430L/T": 8, "EB-5H20": 2, "EB-5T28": 2,
  "EB-500": 6, "ED-5GT": 4, "ENDO CLEAN-1000": 8, "ENDO CLEAN-2000": 7,
  "EC-5BD": 5, "EC-10BD": 5, "VIO + APC 2": 4, "VIO 200 S": 3, "VIO 200 D": 4,
  "VIO 3": 4, "ARC 303": 4, "ARC 350": 4, "ARC 400": 3, iLivTouch: 4,
  "KS-350": 4, "1 электропривод": 8,
};
const DIRECT_SPECIFICATION_COUNT_OVERRIDES: Record<string, number> = {
  "BR-1231": 7,
  "BR-1242": 7,
  "BR-1249": 7,
  "BR-1259": 7,
};
const ELECTROSURGERY_DESCRIPTION_CORRECTIVES = new Set([
  "VIO 200 S", "VIO 200 D", "VIO 3", "ARC 303", "ARC 350", "ARC 400",
]);

const hiddenUnpublishedBindings = [
  "pentax-epk-i7010-optivista",
] as const;

const faqPaths = [
  "/catalog/endoskopiya",
  "/catalog/endoskopiya/videoendoskopicheskie-sistemy",
  "/solutions/portativnaya-bronkhoskopiya",
  "/catalog/endoskopiya/obrabotka-endoskopov",
  "/catalog/reanimatsiya/transportnye-apparaty-ivl",
  "/catalog/anesteziologiya/narkozno-dykhatelnye-apparaty",
] as const;

const stageDraftSlugs = new Set(
  stageCatalog.products
    .filter(({ stageImport }) => stageImport.entityOrigin === "new_candidate")
    .map(({ slug }) => slug),
);
for (const slug of detailProducts.slice(0, 42)) {
  assert.ok(stageDraftSlugs.has(slug), `${slug}: missing Stage draft Product.`);
}

const evidenceDir = "docs/reports/evidence/final-stage-acceptance-corrective-v2-2026-08-12";
const captureScreenshots = process.env.ENDOMARKET_STAGE_SCREENSHOTS === "1";
if (captureScreenshots) await mkdir(evidenceDir, { recursive: true });

const desktopDetailEvidence = new Map<string, string>([
  ["sonoscape-eg-430", "product-detail-eg-430"],
  ["sonoscape-ec-430t", "product-detail-ec-430t"],
  ["sonoscape-eb-500", "product-detail-eb-500"],
  ["medinova-br-1231", "product-detail-br-1231"],
  ["medinova-hv-3101", "product-detail-hv-3101"],
  ["medinova-cy-1355", "product-detail-cy-1355"],
  ["met-ks-350", "product-detail-ks-350"],
  ["medinova-endo-clean-1000", "product-detail-endo-clean-1000"],
  ["medinova-ec-5bd", "product-detail-ec-5bd"],
  ["bowa-arc-350", "product-detail-bowa-arc-350"],
  ["767632362-330695211247-apparat-ivl-hamilton-t1", "product-detail-hamilton-t1"],
]);

const expectedFeaturedPaths = [
  "sonoscape-eg-500",
  "sonoscape-ec-500t",
  "sonoscape-eb-500",
  "medinova-br-1231",
  "medinova-endo-clean-1000",
  "medinova-endo-clean-2000",
  "medinova-ec-5bd",
  "ilivtouch-ilivtouch",
].map((slug) => `/catalog/${slug}`);

const runtimeErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${error.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const previewToolbarHost = origin.hostname.endsWith(".vercel.app")
      || origin.hostname === "stage.cyber-medica.ru";
    const previewToolbarCsp = previewToolbarHost
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
    assert.deepEqual(
      await popular.getByRole("link", { name: /^Подробнее о /u }).evaluateAll((links) =>
        links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
      ),
      expectedFeaturedPaths,
      `${label}: featured Product order or canonical links drifted.`,
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
    if (label === "chromium-desktop-1440" || label === "webkit-mobile-390") {
      const track = popular.locator('[aria-label="Избранные опубликованные товары"]');
      const before = await track.evaluate((element) => element.scrollLeft);
      await popular.getByRole("button", { name: "Следующие товары" }).click();
      await page.waitForTimeout(500);
      const afterButton = await track.evaluate((element) => element.scrollLeft);
      assert.ok(afterButton > before, `${label}: carousel next control did not move the track.`);
      await track.focus();
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(500);
      assert.ok(
        await track.evaluate((element) => element.scrollLeft) < afterButton,
        `${label}: carousel keyboard navigation did not move the track.`,
      );
    }

    await assertPage(page, "/catalog", label);
    await page.getByRole("heading", { name: "Каталог медицинских изделий" }).waitFor();
    assert.equal(await page.locator("article.group").count(), 114, `${label}: visible catalog must contain 114 Product cards.`);
    assert.equal(
      await page.getByText(/Найдено:\s*\d+/u).count(),
      0,
      `${label}: unfiltered catalog must omit the redundant result counter.`,
    );
    assert.ok((await page.getByText("В наличии", { exact: true }).count()) >= 50, `${label}: visible EndoMarket presentations missing.`);
    assert.ok((await page.getByText("Рассрочка 0%", { exact: true }).count()) >= 50, `${label}: EndoMarket installment badges missing.`);
    assert.equal(await page.locator("article dl").count(), 0, `${label}: ProductCard leaked technical characteristics.`);
    const catalogText = await page.locator("body").innerText();
    assert.doesNotMatch(catalogText, /Made on Tilda|medvist\.ru|publication_status|review_state/iu);
    assert.doesNotMatch(catalogText, /щипцы|клапан для эндоскопа|моющее средство/iu);
    if (captureScreenshots && screenshotName) {
      await page.screenshot({ path: `${evidenceDir}/catalog-${screenshotName}.png`, fullPage: true });
    }

    await assertPage(page, "/catalog?q=EC-430T", label);
    assert.equal(await page.getByText(/EC-430T/u).count() > 0, true, `${label}: catalog search failed for EC-430T.`);
    await page.getByText(/^Найдено:\s*\d+$/u).waitFor();
    if (captureScreenshots && label === "chromium-desktop-1440") {
      await page.screenshot({ path: `${evidenceDir}/catalog-search-ec-430t.png`, fullPage: true });
    }
    await assertPage(page, "/manufacturers", label);
    if (label === "chromium-desktop-1440") {
      const manufacturerPaths = await page
        .locator('main a[href^="/manufacturers/"]')
        .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")).filter(Boolean))]);
      assert.equal(manufacturerPaths.length, 19, `${label}: manufacturer directory must contain 19 public Product-backed routes.`);
      assert.equal(await page.locator('[data-logo-kind="graphic"]').count(), 2, `${label}: expected two rights-cleared graphic logos.`);
      assert.equal(await page.locator('[data-logo-kind="fallback"]').count(), 17, `${label}: expected 17 fail-closed logo fallbacks.`);

      for (const manufacturer of finalAcceptance.zeroProductEntities.zeroProductManufacturers) {
        assert.equal(
          manufacturerPaths.includes(`/manufacturers/${manufacturer.slug}`),
          false,
          `${manufacturer.name}: zero-product manufacturer leaked into discovery.`,
        );
        const zeroResponse = await fetch(new URL(`/manufacturers/${manufacturer.slug}`, origin), {
          redirect: "manual",
          signal: AbortSignal.timeout(12_000),
        });
        assert.equal(zeroResponse.status, 404, `${manufacturer.name}: direct route must return HTTP 404.`);
      }

      for (const manufacturerPath of manufacturerPaths) {
        const response = await page.goto(new URL(manufacturerPath!, origin).toString(), {
          waitUntil: "networkidle",
          timeout: 45_000,
        });
        assert.equal(response?.status(), 200, `${manufacturerPath}: manufacturer detail must return HTTP 200.`);
        assert.equal(await page.locator('[data-logo-kind]').count(), 1, `${manufacturerPath}: logo or fallback missing.`);
        assert.equal(
          await page.locator("img").evaluateAll((images) => images.filter(
            (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0,
          ).length),
          0,
          `${manufacturerPath}: broken image detected.`,
        );
      }

      const supplierResponse = await fetch(new URL("/suppliers/not-a-public-supplier", origin), {
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      });
      assert.equal(supplierResponse.status, 404, `${label}: unknown supplier route must return HTTP 404.`);
    }
    await assertPage(page, "/manufacturers/sonoscape", label);
    assert.equal(await page.getByText(/SonoScape/u).count() > 0, true, `${label}: manufacturer route failed.`);
    if (captureScreenshots && label === "chromium-desktop-1440") {
      await page.screenshot({ path: `${evidenceDir}/manufacturer-sonoscape.png`, fullPage: true });
    }
    await assertPage(page, "/request", label);

    if (label === "chromium-desktop-1440") {
      for (const slug of hiddenUnpublishedBindings) {
        const response = await fetch(new URL(`/catalog/${slug}`, origin), {
          redirect: "manual",
          signal: AbortSignal.timeout(12_000),
        });
        const body = await response.text();
        assert.ok([200, 404].includes(response.status), `${slug}: hidden route returned an unexpected transport status.`);
        assert.match(body, /Страница не найдена/u, `${slug}: hidden binding did not resolve to notFound.`);
        assert.doesNotMatch(body, /href=["']\/request\?/u, `${slug}: hidden binding exposed an RFQ action.`);
      }
    }

    for (const slug of detailProducts.slice(0, detailCount)) {
      await assertPage(page, `/catalog/${slug}`, label);
      const text = await page.locator("body").innerText();
      const directSource = sourceTruthBySlug.get(slug);
      if (directSource) {
        assert.match(text, /В наличии/u, `${slug}: availability badge missing.`);
        assert.match(text, /Рассрочка 0%/u, `${slug}: installment badge missing.`);
        assert.match(text, /До 12 месяцев без удорожания/u, `${slug}: installment detail missing.`);
        const detailImages = await page.locator("main img").evaluateAll((images) =>
          images.map((image) => (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src),
        );
        assert.ok(detailImages.some((url) => url.includes("%2Fmedia%2Fendomarket-wave1%2F") || url.includes("/media/endomarket-wave1/")), `${slug}: clean local media missing.`);
        assert.equal(detailImages.some((url) => /endomarket\.ru\/files|fallback/iu.test(url)), false, `${slug}: source/fallback media leaked.`);
        assert.equal(
          await page.locator('[data-testid="product-characteristic-row"]').count(),
          DIRECT_SPECIFICATION_COUNT_OVERRIDES[directSource.model] ?? directSource.sourceSpecificationsCount,
          `${slug}: source specifications are not complete.`,
        );
        assert.equal(
          await page.locator("#advantages li").count(),
          PRESENTATION_FEATURE_COUNTS[directSource.model],
          `${slug}: v7 presentation features are not complete.`,
        );
        const normalize = (value: string) => value.replace(/\s+/gu, " ").trim();
        const description = normalize(await page.locator("#description").innerText());
        if (ELECTROSURGERY_DESCRIPTION_CORRECTIVES.has(directSource.model)) {
          assert.match(description, new RegExp(directSource.model.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
          assert.doesNotMatch(description, /ЛУЧШЕЕ СООТНОШЕНИЕ|минимальн(?:ый|ым) риск|инновационн|уникальн/iu);
        } else {
          assert.ok(description.includes(normalize(directSource.sourceDescription)), `${slug}: exact source description missing from Product Detail.`);
        }
        assert.equal(await page.getByRole("heading", { name: "Ключевые особенности", exact: true }).count(), 1, `${slug}: feature heading drifted.`);
        assert.equal(await page.locator('[aria-label="Миниатюры товара"]').count(), 0, `${slug}: thumbnail strip returned.`);
        const hero = await page.locator('[data-testid="product-hero"]').boundingBox();
        assert.ok(hero && hero.height < 900, `${slug}: Product Detail hero blank-space regression.`);
        const heroSummary = page.locator('[data-testid="product-hero-summary"]');
        if (await heroSummary.count()) {
          const summary = await heroSummary.boundingBox();
          assert.ok(summary && summary.height <= 110, `${slug}: Product Detail hero summary is not bounded.`);
        }
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

    if (label === "chromium-desktop-1440" || label === "webkit-mobile-390") {
      for (const faqPath of faqPaths) {
        await assertPage(page, faqPath, label);
        const details = page.locator("details");
        assert.ok(await details.count() > 0, `${label}: ${faqPath} FAQ is empty.`);
        assert.equal(await details.first().evaluate((node) => (node as HTMLDetailsElement).open), true, `${label}: ${faqPath} first answer is not visible.`);
        assert.ok((await details.first().locator("p").innerText()).trim().length > 0, `${label}: ${faqPath} first answer is blank.`);
        if (await details.count() > 1) {
          const second = details.nth(1);
          await second.locator("summary").focus();
          await page.keyboard.press("Enter");
          assert.equal(await second.evaluate((node) => (node as HTMLDetailsElement).open), true, `${label}: ${faqPath} keyboard toggle failed.`);
          assert.ok((await second.locator("p").innerText()).trim().length > 0, `${label}: ${faqPath} toggled answer is blank.`);
        }
        if (captureScreenshots && faqPath === faqPaths[0]) {
          await page.screenshot({
            path: `${evidenceDir}/faq-${label}.png`,
            fullPage: true,
          });
        }
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

await runProfile({ browserType: chromium, label: "chromium-desktop-1440", viewport: { width: 1440, height: 900 }, detailCount: detailProducts.length, screenshotName: "desktop-1440" });
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

console.info("Final Stage acceptance corrective v2 smoke passed: 11 profiles, 48 key Product Detail routes, 42/42 imported Products, 114 visible Products.");
