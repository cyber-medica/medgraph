import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("homepage hero and SEO communicate the approved commercial purpose", async () => {
  const [page, hero] = await Promise.all([
    source("app/page.tsx"),
    source("components/home/Hero.tsx"),
  ]);

  assert.match(page, /Кибермедика — медицинское оборудование для клиник и учреждений/u);
  assert.match(page, /Поставка и подбор профессионального медицинского оборудования/u);
  assert.match(hero, /Медицинское оборудование для клиник и медицинских учреждений/u);
  assert.match(hero, /Подбор, поставка и сопровождение профессионального медицинского/u);
  assert.match(hero, /href="\/catalog"/u);
  assert.match(hero, /href="\/request"/u);
  assert.ok(hero.indexOf("Перейти в каталог") < hero.indexOf("Отправить запрос"));
});

test("homepage category navigation uses only published catalog category filters", async () => {
  const [page, categories, catalog] = await Promise.all([
    source("app/page.tsx"),
    source("components/home/Categories.tsx"),
    source("components/catalog/CatalogExplorer.tsx"),
  ]);

  for (const slug of [
    "ventilators",
    "patient-monitors",
    "syringe-pumps",
    "ultrasound-systems",
    "endoscopy-systems",
    "x-ray-systems",
    "defibrillator-monitors",
    "respiratory-support-devices",
  ]) {
    assert.match(page, new RegExp(`"${slug}"`, "u"));
  }
  assert.match(categories, /\/catalog\?category=/u);
  assert.match(catalog, /urlSearchParams\.get\("category"\)/u);
  assert.match(catalog, /item\.slug === initialUrlCategory/u);
  assert.doesNotMatch(`${page}\n${categories}`, /draft|unpublished|lifecycle|sourceChecksum/u);
});

test("homepage renders trust, credibility and one focused RFQ conversion action", async () => {
  const [page, trust, company, cta] = await Promise.all([
    source("app/page.tsx"),
    source("components/home/WhyCyberMedica.tsx"),
    source("components/home/CompanyCredibility.tsx"),
    source("components/home/CTA.tsx"),
  ]);

  assert.match(page, /<CompanyCredibility \/>/u);
  assert.equal((trust.match(/<TrustIcon kind=/gu) ?? []).length, 1);
  assert.match(trust, /Оборудование ведущих производителей/u);
  assert.match(trust, /Подбор под техническое задание/u);
  assert.match(trust, /Работа с государственными и частными заказчиками/u);
  assert.match(trust, /Сопровождение поставки и документации/u);
  assert.match(company, /Мы специализируемся на поставках медицинского оборудования/u);
  assert.match(cta, /Не нашли нужное оборудование\?/u);
  assert.match(cta, /href="\/request" className="cm-button-primary/u);
  assert.doesNotMatch(`${trust}\n${company}\n${cta}`, /№1|лучшие цены|официальн(?:ый|ого) дилер|гарантируем/iu);
});

test("public homepage surfaces contain no legacy domain or personal identity", async () => {
  const paths = [
    "app/page.tsx",
    "components/home/Hero.tsx",
    "components/home/Categories.tsx",
    "components/home/Equipment.tsx",
    "components/home/WhyCyberMedica.tsx",
    "components/home/CompanyCredibility.tsx",
    "components/home/CTA.tsx",
    "components/home/Footer.tsx",
  ];
  const combined = (await Promise.all(paths.map(source))).join("\n");

  assert.doesNotMatch(combined, /medvist\.ru|tilda|armansmarkosyan@gmail\.com/iu);
  assert.match(await source("components/home/Footer.tsx"), /href="\/" aria-label="Кибермедика — главная"/u);
});

test("homepage polish is protected by a dedicated WebKit gate", async () => {
  const [packageJson, smoke] = await Promise.all([
    source("package.json"),
    source("scripts/qa/homepage-polish-smoke.ts"),
  ]);

  assert.match(packageJson, /"qa:homepage-polish": "node scripts\/qa\/homepage-polish-smoke\.ts"/u);
  assert.match(smoke, /from "playwright-core"/u);
  assert.match(smoke, /document\.documentElement\.scrollWidth <= document\.documentElement\.clientWidth/u);
  assert.match(smoke, /rect\.height < 44/u);
  assert.match(smoke, /Избранные опубликованные товары/u);
  assert.match(smoke, /expectedCategories/u);
});
