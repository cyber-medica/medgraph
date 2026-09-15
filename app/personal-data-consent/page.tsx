import type { Metadata } from "next";
import Link from "next/link";

import { PUBLIC_COMPANY } from "@/lib/company/public-company";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";

export const metadata: Metadata = buildStorefrontMetadata({
  title: "Согласие на обработку персональных данных",
  description: "Согласие на обработку данных, передаваемых через форму запроса Кибермедика.",
  canonical: "/personal-data-consent",
  noindexFollow: true,
});

export default function PersonalDataConsentPage() {
  return (
    <main className="min-h-screen bg-cm-canvas">
      <article className="cm-container max-w-4xl py-10 sm:py-14">
        <p className="cm-eyebrow !text-cm-teal">152-ФЗ</p>
        <h1 className="cm-heading-1 mt-3 text-3xl font-extrabold">Согласие на обработку персональных данных</h1>
        <p className="mt-5 text-sm leading-7 text-cm-slate">
          Отмечая чекбокс в форме и отправляя заявку, пользователь свободно,
          своей волей и в своём интересе даёт {PUBLIC_COMPANY.legalName}, ИНН {PUBLIC_COMPANY.inn},
          согласие на обработку переданных в форме персональных данных.
        </p>
        <section className="mt-8">
          <h2 className="cm-heading-2 text-lg font-extrabold">Состав данных и цели</h2>
          <p className="mt-3 text-sm leading-7 text-cm-slate">
            Согласие относится к имени, должности, контактному телефону, email,
            организации и сведениям в тексте запроса. Цели: принять обращение,
            связаться с заявителем, уточнить техническую задачу и подготовить
            подбор или коммерческое предложение.
          </p>
        </section>
        <section className="mt-8">
          <h2 className="cm-heading-2 text-lg font-extrabold">Действия и срок</h2>
          <p className="mt-3 text-sm leading-7 text-cm-slate">
            Допускаются сбор, запись, систематизация, хранение, уточнение,
            использование, передача техническим обработчикам заявки,
            блокирование и удаление с использованием средств автоматизации.
            Согласие действует до достижения целей либо его отзыва, если закон
            не требует более длительного хранения.
          </p>
        </section>
        <section className="mt-8">
          <h2 className="cm-heading-2 text-lg font-extrabold">Отзыв согласия</h2>
          <p className="mt-3 text-sm leading-7 text-cm-slate">
            Отзыв можно направить на <a className="font-semibold text-cm-teal underline" href={PUBLIC_COMPANY.emailHref}>{PUBLIC_COMPANY.email}</a>.
            После отзыва обработка прекращается, кроме случаев, когда её
            продолжение допускается законом.
          </p>
        </section>
        <p className="mt-8 text-sm leading-7 text-cm-slate">
          Подробнее: <Link className="font-semibold text-cm-teal underline" href="/privacy">политика обработки персональных данных</Link>.
        </p>
      </article>
    </main>
  );
}
