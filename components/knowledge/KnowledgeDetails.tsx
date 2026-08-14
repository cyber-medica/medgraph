import type { Product } from "@/types/product";

interface KnowledgeDetailsProps {
  product: Product;
}

function ListCard({
  title,
  items,
  tone = "blue",
}: {
  title: string;
  items: string[];
  tone?: "blue" | "amber" | "green";
}) {
  const marker = {
    blue: "bg-cm-teal-soft text-cm-teal",
    amber: "bg-cm-warning-soft text-cm-warning",
    green: "bg-cm-verified-soft text-cm-verified",
  }[tone];

  return (
    <section className="cm-card p-6">
      <h2 className="cm-heading-2 text-base font-bold">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3 text-xs leading-6 text-cm-slate">
            <span
              className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-md font-sans text-[9px] font-bold ${marker}`}
            >
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function KnowledgeDetails({
  product,
}: KnowledgeDetailsProps) {
  const identifiers = [
    ["Регистрационное удостоверение", product.identifiers.registration],
    ["КТРУ", product.identifiers.ktru],
    ["НКМИ", product.identifiers.nkmi],
    ["ОКПД2", product.identifiers.okpd2],
  ];

  return (
    <>
      <section className="cm-card p-6">
        <div className="cm-label !text-cm-teal">
          Классификаторы
        </div>
        <h2 className="mt-2 text-base font-bold">РУ, КТРУ, НКМИ и ОКПД2</h2>
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {identifiers.map(([label, value]) => (
            <div key={label} className="rounded-md border border-[var(--cm-rule)] bg-cm-surface-low/75 p-4">
              <div className="cm-label">{label}</div>
              <div className="mt-2 font-sans text-[11px] font-semibold">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <ListCard title="Применение" items={product.applications} tone="green" />
        <ListCard
          title="Отличия и подбор аналогов"
          items={product.analogDifferences}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ListCard
          title="Ошибки при выборе"
          items={product.selectionMistakes}
          tone="amber"
        />
        <ListCard
          title="Рекомендации по подбору"
          items={product.recommendations}
          tone="green"
        />
      </div>

      <section className="cm-card p-6">
        <h2 className="text-base font-bold">Частые вопросы</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--cm-rule)] bg-white">
          {product.faq.map((item, index) => (
            <details key={item.question} className="group border-b border-[var(--cm-rule)] px-4 py-4 last:border-b-0" open={index === 0}>
              <summary className="cursor-pointer list-none pr-8 text-xs font-semibold">
                {item.question}
                <span className="float-right text-cm-teal transition duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-4xl text-xs leading-6 text-cm-slate">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="cm-card p-6">
        <h2 className="text-base font-bold">История закупок</h2>
        {product.procurementHistory.length === 0 ? (
          <div className="cm-empty-state mt-4 px-5 py-7">
            <div className="cm-empty-icon">↗</div>
            <div className="mt-4 text-xs font-semibold text-cm-ink">
              История закупок готовится
            </div>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-cm-slate">
              Для проверки конкретной закупки отправьте запрос — мы сопоставим
              характеристики и документы.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="cm-eyebrow !text-[9px]">
                <tr>
                  <th className="pb-4">Заказчик</th>
                  <th className="pb-4">Дата</th>
                  <th className="pb-4">Количество</th>
                  <th className="pb-4">Цена</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cm-rule)]">
                {product.procurementHistory.map((record) => (
                  <tr key={`${record.customer}-${record.date}`}>
                    <td className="py-4">{record.customer}</td>
                    <td className="py-4">{record.date}</td>
                    <td className="py-4">{record.quantity}</td>
                    <td className="py-4">{record.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
