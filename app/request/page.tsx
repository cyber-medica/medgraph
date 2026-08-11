import type { Metadata } from "next";

import RequestForm from "@/components/request/RequestForm";
import { resolveRequestProductContext } from "@/lib/request/product-context";
import { catalogRepository, productService } from "@/lib/storefront";

export const metadata: Metadata = {
  title: "Запросить коммерческое предложение",
  description:
    "Отправьте деловую заявку на медицинское изделие, документы, аналоги, совместимость или коммерческое предложение.",
  alternates: {
    canonical: "/request",
  },
};

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
          <div className="cm-label !text-cm-teal">
            Деловая заявка
          </div>
          <h1 className="cm-balanced mt-3 text-3xl font-extrabold tracking-[-0.03em]">
            Запросить КП
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-cm-slate">
            Опишите изделие, закупочную задачу или параметры. Мы поможем
            подобрать позицию, проверить документы и подготовить коммерческое
            предложение.
          </p>
          <div className="mt-8 space-y-3 border-t border-[var(--cm-rule)] pt-6 text-xs text-cm-slate">
            {[
              ["1", "Уточним задачу", "изделие, количество, сроки и важные характеристики"],
              ["2", "Проверим документы", "регистрационные сведения, инструкции и совместимость"],
              ["3", "Подготовим ответ", "КП или консультацию по доступным вариантам"],
            ].map(([number, title, text]) => (
              <div key={title} className="rounded-md border border-[var(--cm-rule)] bg-white/72 p-3">
                <div className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-cm-teal-soft font-mono text-[9px] font-bold text-cm-teal">
                    {number}
                  </span>
                  <div>
                    <div className="font-semibold text-cm-ink">{title}</div>
                    <div className="mt-1 leading-5">{text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-[var(--cm-rule)] bg-cm-surface-low/70 p-4 text-[11px] leading-6 text-cm-slate">
            Ответ обычно готовится в течение рабочего дня. Данные заявки не
            публикуются и используются только для ответа. Кибермедика помогает
            с проверкой информации, но не заменяет официальную экспертизу или
            регистратора.
          </div>
        </div>
        <div className="cm-card p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-[var(--cm-rule)] pb-4">
            <span className="cm-label !text-cm-teal">Заявка</span>
            <span className="font-mono text-[9px] text-cm-dim">152-ФЗ</span>
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

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
