import type { Metadata } from "next";

import RequestForm from "@/components/request/RequestForm";
import { PUBLIC_COMPANY } from "@/lib/company/public-company";
import { resolveRequestProductContext } from "@/lib/request/product-context";
import { catalogRepository, productService } from "@/lib/storefront";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";
import { hasNonAttributionQueryParameter } from "@/lib/seo/query-indexing-hygiene";

const requestDescription =
  "Пришлите техническое задание на медицинское оборудование: подготовим подбор, проверку соответствия и коммерческое предложение.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  return buildStorefrontMetadata({
    title: "Запросить коммерческое предложение",
    description: requestDescription,
    canonical: "/request",
    noindexFollow: hasNonAttributionQueryParameter(await searchParams),
  });
}

const acceptedInputs = ["ТЗ", "ООЗ", "спецификация", "КТРУ", "ссылка на закупку"] as const;
const outputs = [
  "подбор оборудования",
  "таблица соответствия",
  "коммерческое предложение",
  "документы по запросу",
] as const;
const audiences = [
  "государственные медицинские учреждения",
  "частные клиники и медицинские центры",
  "службы закупок и технические специалисты",
] as const;

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string | string[];
    productId?: string | string[];
    query?: string | string[];
  }>;
}) {
  const { product, productId, query } = await searchParams;
  const productContext = await resolveRequestProductContext(
    {
      id: firstSearchParam(productId),
      slug: firstSearchParam(product),
    },
    { catalogRepository, productService },
  );
  const initialMessage = productContext
    ? `Нужно коммерческое предложение на «${productContext.title}». Количество: `
    : firstSearchParam(query)
      ? `Необходимо подобрать: ${firstSearchParam(query)}`
      : "";

  return (
    <main className="min-h-screen bg-cm-canvas">
      <section className="cm-container grid gap-6 py-10 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="rounded-lg border border-[var(--cm-rule)] bg-white/78 p-6 pt-6 shadow-[0_14px_42px_rgba(11,19,32,0.055)]">
          <h1 className="cm-heading-1 cm-balanced text-3xl font-extrabold">
            <span className="sr-only">Запросить КП. </span>
            Пришлите ТЗ — подберём медицинское оборудование, проверим соответствие требованиям и подготовим КП
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-cm-slate">
            Укажите предмет закупки и важные параметры в форме или направьте
            материалы на <a className="font-semibold text-cm-teal underline" href={PUBLIC_COMPANY.emailHref}>{PUBLIC_COMPANY.email}</a>.
          </p>
          <div className="mt-7 space-y-5 border-t border-[var(--cm-rule)] pt-6 text-xs text-cm-slate">
            <RequestInfo title="Для кого" items={audiences} />
            <RequestInfo title="Что можно прислать" items={acceptedInputs} compact />
            <RequestInfo title="Что подготовим" items={outputs} />
          </div>
          <div className="mt-5 rounded-md border border-[var(--cm-rule)] bg-cm-surface-low/70 p-4 text-[11px] leading-6 text-cm-slate">
            <strong className="block text-xs text-cm-ink">{PUBLIC_COMPANY.legalName}</strong>
            <span className="mt-1 block">ИНН {PUBLIC_COMPANY.inn} · ОГРН {PUBLIC_COMPANY.ogrn}</span>
            <span className="mt-1 block">{PUBLIC_COMPANY.specialization}.</span>
            <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <a className="font-semibold text-cm-teal underline" href={PUBLIC_COMPANY.phoneHref}>{PUBLIC_COMPANY.phoneDisplay}</a>
              <a className="font-semibold text-cm-teal underline" href={PUBLIC_COMPANY.emailHref}>{PUBLIC_COMPANY.email}</a>
            </span>
          </div>
        </div>
        <div className="cm-card p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-[var(--cm-rule)] pb-4">
            <span className="cm-label !text-cm-teal">Заявка</span>
            <span className="font-sans text-[9px] text-cm-dim">152-ФЗ</span>
          </div>
          <RequestForm
            initialMessage={initialMessage}
            productContext={productContext ?? undefined}
          />
        </div>
      </section>
    </main>
  );
}

function RequestInfo({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: readonly string[];
  compact?: boolean;
}) {
  return (
    <div>
      <h2 className="cm-label text-cm-ink">{title}</h2>
      <ul className={`mt-2 flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
        {items.map((item) => (
          <li key={item} className="rounded-full border border-[var(--cm-rule)] bg-white px-2.5 py-1.5 leading-4">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
