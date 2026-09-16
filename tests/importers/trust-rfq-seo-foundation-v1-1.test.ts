import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import publishedSnapshotJson from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import { PUBLIC_COMPANY, buildPublicCompanyStructuredData } from "../../lib/company/public-company.ts";
import { hasNonAttributionQueryParameter } from "../../lib/seo/query-indexing-hygiene.ts";
import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import { mapCloudPublishedCatalogProjection } from "../../lib/storefront/cloud-published-mapper.ts";
import { buildStorefrontSitemapFromCatalog } from "../../lib/storefront/storefront-sitemap.ts";

const projection = publishedSnapshotJson.projection as unknown as PublishedCatalogProjection;
const catalog = mapCloudPublishedCatalogProjection(projection);

test("public company contract contains exact trust details and conservative Organization schema", () => {
  assert.deepEqual(
    {
      legalName: PUBLIC_COMPANY.legalName,
      shortLegalName: PUBLIC_COMPANY.shortLegalName,
      brandName: PUBLIC_COMPANY.brandName,
      legalAddress: PUBLIC_COMPANY.legalAddress,
      inn: PUBLIC_COMPANY.inn,
      ogrn: PUBLIC_COMPANY.ogrn,
      kpp: PUBLIC_COMPANY.kpp,
      email: PUBLIC_COMPANY.email,
      phone: PUBLIC_COMPANY.phoneDisplay,
    },
    {
      legalName: "Общество с ограниченной ответственностью «Кибермедика»",
      shortLegalName: "ООО «КИМ»",
      brandName: "Кибермедика",
      legalAddress: "295021, Республика Крым, г. Симферополь, ул. Данилова, д. 43, кабинет 32",
      inn: "9102256625",
      ogrn: "1199112011020",
      kpp: "910201001",
      email: "info@cyber-medica.ru",
      phone: "+7 (903) 947-72-47",
    },
  );

  const schema = buildPublicCompanyStructuredData();
  assert.equal(schema["@type"], "Organization");
  assert.equal(schema.name, PUBLIC_COMPANY.brandName);
  assert.equal(schema.legalName, PUBLIC_COMPANY.legalName);
  assert.equal(schema.alternateName, PUBLIC_COMPANY.shortLegalName);
  assert.equal(schema.taxID, PUBLIC_COMPANY.inn);
  assert.equal(JSON.stringify(schema).includes("LocalBusiness"), false);
  assert.equal(JSON.stringify(schema).includes("MedicalBusiness"), false);
});

test("About and Contacts are canonical, indexable public trust pages with Organization JSON-LD", async () => {
  const [about, contacts] = await Promise.all([
    readFile("app/about/page.tsx", "utf8"),
    readFile("app/contacts/page.tsx", "utf8"),
  ]);

  for (const [source, canonical] of [[about, "/about"], [contacts, "/contacts"]] as const) {
    assert.match(source, /<h1/u);
    assert.match(source, /buildPublicCompanyStructuredData/u);
    assert.match(source, /<JsonLd/u);
    assert.match(source, new RegExp(`canonical: ["']${canonical}["']`, "u"));
    assert.doesNotMatch(source, /noindexFollow:\s*true/u);
  }

  const urls = new Set(buildStorefrontSitemapFromCatalog(catalog).map(({ url }) => url));
  assert.equal(urls.has("https://cyber-medica.ru/about"), true);
  assert.equal(urls.has("https://cyber-medica.ru/contacts"), true);
});

test("RFQ page exposes accepted inputs, outputs, trust contacts and explicit unchecked consent", async () => {
  const [page, form, api] = await Promise.all([
    readFile("app/request/page.tsx", "utf8"),
    readFile("components/request/RequestForm.tsx", "utf8"),
    readFile("app/api/request/route.ts", "utf8"),
  ]);

  for (const value of ["ТЗ", "ООЗ", "спецификация", "КТРУ", "ссылка на закупку"]) {
    assert.match(page, new RegExp(value, "u"));
  }
  for (const value of ["подбор оборудования", "таблица соответствия", "коммерческое предложение", "документы по запросу"]) {
    assert.match(page, new RegExp(value, "u"));
  }
  assert.match(page, /PUBLIC_COMPANY\.phoneDisplay/u);
  assert.match(page, /PUBLIC_COMPANY\.email/u);
  assert.match(form, /type="checkbox"[\s\S]*name="personalDataConsent"[\s\S]*required/u);
  assert.doesNotMatch(form, /defaultChecked|checked=\{true\}/u);
  assert.match(form, /href="\/privacy"/u);
  assert.match(form, /href="\/personal-data-consent"/u);
  assert.match(api, /formData\.get\("personalDataConsent"\) !== "accepted"/u);

  const backendGuard = form.indexOf("if (!response.ok || !result.ok)");
  const requestIdGuard = form.indexOf("if (!result.requestId");
  const success = form.indexOf('trackRfqEvent("rfq_success"');
  assert.ok(backendGuard >= 0 && requestIdGuard > backendGuard && success > requestIdGuard);
  assert.equal(form.match(/trackRfqEvent\("rfq_success"/gu)?.length, 1);
});

test("footer exposes company, contacts and legal navigation without personal email", async () => {
  const footer = await readFile("components/home/Footer.tsx", "utf8");
  for (const path of ["/about", "/contacts", "/privacy", "/personal-data-consent", "/request"]) {
    assert.match(footer, new RegExp(`href=[{]?["]${path}`, "u"));
  }
  assert.match(footer, /PUBLIC_COMPANY\.shortLegalName/u);
  assert.match(footer, /PUBLIC_COMPANY\.inn/u);
  assert.doesNotMatch(footer, /arman|gmail\.com/iu);
});

test("homepage and Product cards expose factual RFQ conversion elements", async () => {
  const [homeTrust, card, detail] = await Promise.all([
    readFile("components/home/WhyCyberMedica.tsx", "utf8"),
    readFile("components/storefront/ProductCard.tsx", "utf8"),
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
  ]);

  assert.match(homeTrust, /Что получает заказчик/u);
  for (const value of ["Подбор по ТЗ", "Проверка соответствия", "Подготовка КП", "Подбор аналогов", "Сопровождение закупки", "Документы по запросу"]) {
    assert.match(homeTrust, new RegExp(value, "u"));
  }
  for (const value of ["Цена", "по запросу", "Срок поставки", "уточняется", "Подбор комплектации под ТЗ", "Запросить КП", "Отправить ТЗ"]) {
    assert.match(card, new RegExp(value, "u"));
  }
  assert.match(card, /hasRegistrationEvidence[\s\S]*РУ предоставляется по запросу/u);
  assert.match(detail, /Запросить КП/u);
  assert.doesNotMatch(detail, /Отправить ТЗ|Техническое задание/u);
});

test("non-commercial query variants are noindex candidates while UTM and yclid stay attributable", () => {
  assert.equal(hasNonAttributionQueryParameter({ category: "endoscopy" }), true);
  assert.equal(hasNonAttributionQueryParameter({ manufacturer: "mindray" }), true);
  assert.equal(hasNonAttributionQueryParameter({ sort: "name-asc" }), true);
  assert.equal(hasNonAttributionQueryParameter({ page: "2" }), true);
  assert.equal(hasNonAttributionQueryParameter({ utm_source: "yandex", yclid: "click" }), false);
  assert.equal(hasNonAttributionQueryParameter({ utm_source: "yandex", category: "endoscopy" }), true);
});

test("legal pages are real linked documents and contain no placeholder data", async () => {
  const [privacy, consent] = await Promise.all([
    readFile("app/privacy/page.tsx", "utf8"),
    readFile("app/personal-data-consent/page.tsx", "utf8"),
  ]);
  for (const source of [privacy, consent]) {
    assert.match(source, /PUBLIC_COMPANY\.legalName/u);
    assert.match(source, /PUBLIC_COMPANY\.inn/u);
    assert.match(source, /noindexFollow:\s*true/u);
    assert.doesNotMatch(source, /TODO|PLACEHOLDER|уточняется|example\.com/iu);
  }
});
