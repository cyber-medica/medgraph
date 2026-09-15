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
  "Контакты и реквизиты ООО «КИБЕРМЕДИКА»: телефон, email, адрес и форма запроса коммерческого предложения.";

export const metadata: Metadata = buildStorefrontMetadata({
  title: "Контакты и реквизиты",
  description,
  canonical: "/contacts",
});

export default function ContactsPage() {
  return (
    <main className="min-h-screen bg-cm-canvas">
      <JsonLd
        data={[
          buildPublicCompanyStructuredData(),
          buildBreadcrumbJsonLd([
            { name: "Главная", path: "/" },
            { name: "Контакты", path: "/contacts" },
          ]),
        ]}
      />
      <header className="border-b border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f6fafc_58%,#e8f5f7_100%)]">
        <div className="cm-container cm-page-intro">
          <Breadcrumbs
            items={[
              { name: "Главная", path: "/" },
              { name: "Контакты", path: "/contacts" },
            ]}
          />
          <p className="cm-eyebrow mt-5 !text-cm-teal">КОНТАКТЫ</p>
          <h1 className="cm-heading-1 mt-3 text-3xl font-extrabold sm:text-4xl">
            Контакты и реквизиты
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-cm-slate sm:text-base">
            Направьте техническое задание или запрос — мы уточним требования и
            подготовим ответ по доступной комплектации.
          </p>
        </div>
      </header>

      <section className="cm-section" aria-labelledby="contacts-title">
        <div className="cm-container grid gap-5 lg:grid-cols-2">
          <div className="cm-card p-5 sm:p-6">
            <h2 id="contacts-title" className="cm-heading-2 text-xl font-extrabold">Связаться с нами</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="cm-label text-cm-dim">Телефон</dt>
                <dd className="mt-1"><a className="font-semibold text-cm-teal hover:underline" href={PUBLIC_COMPANY.phoneHref}>{PUBLIC_COMPANY.phoneDisplay}</a></dd>
              </div>
              <div>
                <dt className="cm-label text-cm-dim">Email</dt>
                <dd className="mt-1"><a className="font-semibold text-cm-teal hover:underline" href={PUBLIC_COMPANY.emailHref}>{PUBLIC_COMPANY.email}</a></dd>
              </div>
              <div>
                <dt className="cm-label text-cm-dim">Режим работы</dt>
                <dd className="mt-1 font-semibold text-cm-ink">{PUBLIC_COMPANY.businessHours}</dd>
              </div>
            </dl>
            <Link href="/request" className="cm-button-primary mt-6">Запросить коммерческое предложение</Link>
          </div>

          <div className="cm-card p-5 sm:p-6">
            <h2 className="cm-heading-2 text-xl font-extrabold">Реквизиты</h2>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <CompanyDetail label="Юридическое лицо" value={PUBLIC_COMPANY.legalName} />
              <CompanyDetail label="ИНН" value={PUBLIC_COMPANY.inn} />
              <CompanyDetail label="КПП" value={PUBLIC_COMPANY.kpp} />
              <CompanyDetail label="ОГРН" value={PUBLIC_COMPANY.ogrn} />
              <CompanyDetail label="Юридический адрес" value={PUBLIC_COMPANY.legalAddress} wide />
            </dl>
            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--cm-rule)] pt-4 text-xs">
              <Link href="/privacy" className="font-semibold text-cm-teal hover:underline">Политика конфиденциальности</Link>
              <Link href="/personal-data-consent" className="font-semibold text-cm-teal hover:underline">Согласие на обработку персональных данных</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function CompanyDetail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="cm-label text-cm-dim">{label}</dt>
      <dd className="mt-1 font-semibold leading-6 text-cm-ink">{value}</dd>
    </div>
  );
}
