import type { Metadata } from "next";
import Link from "next/link";

import { PUBLIC_COMPANY } from "@/lib/company/public-company";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";

export const metadata: Metadata = buildStorefrontMetadata({
  title: "Политика конфиденциальности",
  description: "Политика обработки персональных данных на сайте Кибермедика.",
  canonical: "/privacy",
  noindexFollow: true,
});

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-cm-canvas">
      <article className="cm-container max-w-4xl py-10 sm:py-14">
        <p className="cm-eyebrow !text-cm-teal">ПЕРСОНАЛЬНЫЕ ДАННЫЕ</p>
        <h1 className="cm-heading-1 mt-3 text-3xl font-extrabold">Политика обработки персональных данных</h1>
        <p className="mt-4 text-sm leading-7 text-cm-slate">Дата редакции: 15 сентября 2026 года.</p>
        <LegalSection title="1. Оператор">
          Оператором персональных данных является {PUBLIC_COMPANY.legalName}, ИНН {PUBLIC_COMPANY.inn}, ОГРН {PUBLIC_COMPANY.ogrn}, адрес: {PUBLIC_COMPANY.legalAddress}. По вопросам обработки данных: <a href={PUBLIC_COMPANY.emailHref}>{PUBLIC_COMPANY.email}</a>.
        </LegalSection>
        <LegalSection title="2. Какие данные обрабатываются">
          При отправке формы могут обрабатываться наименование организации, имя и должность контактного лица, телефон, email, содержание запроса, выбранное оборудование, адрес страницы и переданные браузером параметры источника обращения. Сайт также использует технические cookie и обезличенные данные веб-аналитики.
        </LegalSection>
        <LegalSection title="3. Цели и основание обработки">
          Данные используются для приёма и обработки запроса, связи с заявителем, подготовки подбора и коммерческого предложения, защиты формы от злоупотреблений и анализа эффективности источников обращений. Основанием является согласие пользователя и действия по его запросу до заключения договора.
        </LegalSection>
        <LegalSection title="4. Действия с данными и получатели">
          Оператор может собирать, записывать, систематизировать, хранить, уточнять, использовать, передавать привлекаемым для приёма и доставки заявки техническим обработчикам, блокировать и удалять данные. Данные не публикуются и не используются для принятия автоматизированных решений, порождающих юридические последствия.
        </LegalSection>
        <LegalSection title="5. Срок обработки и отзыв согласия">
          Данные обрабатываются до достижения целей обращения либо до отзыва согласия, если более длительное хранение не требуется по закону. Отозвать согласие и запросить сведения об обработке можно письмом на <a href={PUBLIC_COMPANY.emailHref}>{PUBLIC_COMPANY.email}</a>.
        </LegalSection>
        <LegalSection title="6. Защита данных">
          Оператор применяет организационные и технические меры, соответствующие характеру обрабатываемых данных, и ограничивает доступ к заявкам лицами и сервисами, которым он необходим для обработки обращения.
        </LegalSection>
        <p className="mt-8 text-sm leading-7 text-cm-slate">
          Перед отправкой формы также ознакомьтесь с <Link href="/personal-data-consent">текстом согласия на обработку персональных данных</Link>.
        </p>
      </article>
    </main>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="cm-heading-2 text-lg font-extrabold">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-cm-slate [&_a]:font-semibold [&_a]:text-cm-teal [&_a]:underline">{children}</p>
    </section>
  );
}
