import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import {
  PUBLIC_COMPANY,
  buildPublicCompanyStructuredData,
} from "@/lib/company/public-company";
import { buildBreadcrumbJsonLd, buildStorefrontMetadata } from "@/lib/storefront/seo";

const description =
  "О компании Кибермедика: подбор и поставка медицинского оборудования для государственных и частных организаций по техническому заданию.";

export const metadata: Metadata = buildStorefrontMetadata({
  title: "О компании",
  description,
  canonical: "/about",
});

const capabilities = [
  "Подбор оборудования по техническому заданию и параметрам закупки",
  "Проверка соответствия предложенной комплектации требованиям",
  "Подготовка коммерческого предложения и подбор аналогов",
  "Сопровождение поставки и предоставление документов по запросу",
] as const;

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-cm-canvas">
      <JsonLd
        data={[
          buildPublicCompanyStructuredData(),
          buildBreadcrumbJsonLd([
            { name: "Главная", path: "/" },
            { name: "О компании", path: "/about" },
          ]),
        ]}
      />
      <header className="border-b border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f6fafc_58%,#e8f5f7_100%)]">
        <div className="cm-container cm-page-intro">
          <Breadcrumbs
            items={[
              { name: "Главная", path: "/" },
              { name: "О компании", path: "/about" },
            ]}
          />
          <p className="cm-eyebrow mt-5 !text-cm-teal">О КОМПАНИИ</p>
          <h1 className="cm-heading-1 mt-3 max-w-4xl text-3xl font-extrabold sm:text-4xl">
            Кибермедика — поставщик медицинского оборудования для организаций
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-cm-slate sm:text-base">
            {PUBLIC_COMPANY.legalName} специализируется на B2B-поставках
            медицинского оборудования и помогает заказчикам подобрать решения
            под технические требования.
          </p>
        </div>
      </header>

      <section aria-labelledby="about-work" className="cm-section">
        <div className="cm-container grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
          <div>
            <h2 id="about-work" className="cm-heading-2 text-2xl font-extrabold">
              Как мы работаем
            </h2>
            <p className="mt-3 text-sm leading-7 text-cm-slate">
              Работаем с государственными и частными заказчиками. Принимаем
              технические задания, спецификации, позиции КТРУ и ссылки на
              закупки, чтобы подготовить предметный ответ.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((capability) => (
              <li key={capability} className="cm-card flex min-h-28 items-start gap-3 p-4">
                <span aria-hidden="true" className="mt-0.5 text-cm-teal">✓</span>
                <span className="text-sm font-semibold leading-6">{capability}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="about-geography" className="border-y border-[var(--cm-rule)] bg-white py-9">
        <div className="cm-container grid gap-6 sm:grid-cols-2">
          <div>
            <h2 id="about-geography" className="cm-heading-2 text-xl font-extrabold">География</h2>
            <p className="mt-3 text-sm leading-7 text-cm-slate">
              Обрабатываем запросы на поставку медицинского оборудования для
              организаций в регионах России.
            </p>
          </div>
          <div>
            <h2 className="cm-heading-2 text-xl font-extrabold">Юридическая информация</h2>
            <p className="mt-3 text-sm leading-7 text-cm-slate">
              {PUBLIC_COMPANY.legalName}<br />
              ИНН {PUBLIC_COMPANY.inn} · ОГРН {PUBLIC_COMPANY.ogrn}
            </p>
          </div>
        </div>
      </section>

      <section className="cm-section" aria-label="Связаться с Кибермедикой">
        <div className="cm-container flex flex-col gap-3 sm:flex-row">
          <Link href="/request" className="cm-button-primary">Отправить техническое задание</Link>
          <Link href="/contacts" className="cm-button-secondary">Контакты и реквизиты</Link>
        </div>
      </section>
    </main>
  );
}
