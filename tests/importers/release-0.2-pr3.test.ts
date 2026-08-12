import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatCountryForPublic } from "../../lib/storefront/country-presentation.ts";
import { isVerifiedLocalManufacturerLogo } from "../../lib/storefront/manufacturer-presentation.ts";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("country presentation localizes canonical values and fails closed", () => {
  assert.equal(formatCountryForPublic("RU"), "Россия");
  assert.equal(formatCountryForPublic("CH"), "Швейцария");
  assert.equal(formatCountryForPublic("CN"), "Китай");
  assert.equal(formatCountryForPublic("DE"), "Германия");
  assert.equal(formatCountryForPublic("US"), "США");
  assert.equal(formatCountryForPublic("KR"), "Республика Корея");
  assert.equal(formatCountryForPublic("JP"), "Япония");
  assert.equal(formatCountryForPublic("GB"), "Великобритания");
  assert.equal(formatCountryForPublic("ZZ"), null);
  assert.equal(formatCountryForPublic("Швейцария"), "Швейцария");
});

test("manufacturer logos accept only the verified local asset convention", () => {
  assert.equal(
    isVerifiedLocalManufacturerLogo("/manufacturers/fresenius-kabi/logo.png"),
    true,
  );
  assert.equal(
    isVerifiedLocalManufacturerLogo("/manufacturers/hamilton-medical/logo.webp"),
    false,
  );
  assert.equal(
    isVerifiedLocalManufacturerLogo("https://example.com/hamilton.svg"),
    false,
  );
  assert.equal(isVerifiedLocalManufacturerLogo(null), false);
});

test("homepage ranks and limits active categories and manufacturers", async () => {
  const homepage = await source("app/page.tsx");
  const categories = await source("components/home/Categories.tsx");

  assert.match(homepage, /productService\.getActiveProducts\(\)/u);
  assert.match(homepage, /categoryProductCounts/u);
  assert.match(homepage, /manufacturerProductCounts/u);
  assert.equal((homepage.match(/\.slice\(0,\s*8\)/gu) ?? []).length, 2);
  assert.match(homepage, /right\.productCount - left\.productCount/u);
  assert.match(categories, /Основные категории оборудования/u);
  assert.match(categories, /Все категории/u);
  assert.doesNotMatch(categories, /Популярные категории/u);
  assert.doesNotMatch(categories, /function CategoryIcon/u);
});

test("unsupported comparison claims are absent from shared public navigation", async () => {
  const [header, hero, footer, capabilities] = await Promise.all([
    source("components/layout/Header.tsx"),
    source("components/home/Hero.tsx"),
    source("components/home/Footer.tsx"),
    source("components/home/WhyCyberMedica.tsx"),
  ]);

  for (const publicComponent of [header, hero, footer, capabilities]) {
    assert.doesNotMatch(publicComponent, /href="\/compare"/u);
  }
  assert.doesNotMatch(hero, /productCount|manufacturerCount|categoryCount/u);
  assert.match(capabilities, /Подбор под техническое задание/u);
  assert.match(capabilities, /Оборудование ведущих производителей/u);
  assert.match(capabilities, /Работа с государственными и частными заказчиками/u);
  assert.match(capabilities, /Сопровождение поставки и документации/u);
  assert.doesNotMatch(capabilities, /Совместимость|Тендерная аналитика/u);
});

test("header search uses the existing Storefront SearchService in place", async () => {
  const header = await source("components/layout/Header.tsx");

  assert.match(header, /SearchService\.forProducts/u);
  assert.match(header, /aria-controls="header-search-panel"/u);
  assert.match(header, /Закрыть поиск/u);
  assert.match(header, /event\.key === "Enter"/u);
  assert.match(header, /navigateSearch\(\)/u);
  assert.match(header, /router\.push\(`\/catalog\/\$\{product\.slug\}`\)/u);
  assert.match(header, /href=\{`\/search/u);
});

test("catalog omits the static summary and product media is an accessible link", async () => {
  const [page, productCard] = await Promise.all([
    source("app/catalog/page.tsx"),
    source("components/storefront/ProductCard.tsx"),
  ]);

  assert.doesNotMatch(page, /Сводка каталога|catalogSummary|sm:grid-cols-4/u);
  assert.match(productCard, /aria-label=\{`Открыть карточку \$\{product\.name\}`\}/u);
  assert.match(productCard, /const productHref = `\/catalog\/\$\{product\.slug\}`/u);
});

test("manufacturer directory uses localized country labels and responsive density", async () => {
  const [directory, detail, mark] = await Promise.all([
    source("app/manufacturers/page.tsx"),
    source("app/manufacturers/[slug]/page.tsx"),
    source("components/storefront/ManufacturerMark.tsx"),
  ]);

  assert.match(directory, /formatCountryForPublic\(manufacturer\.country\)/u);
  assert.match(directory, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/u);
  assert.match(detail, /const country = formatCountryForPublic/u);
  assert.doesNotMatch(directory, /manufacturer\.country\}</u);
  assert.doesNotMatch(mark, /name\.slice/u);
});
