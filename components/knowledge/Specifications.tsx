import { Product } from "@/types/product";

interface SpecificationsProps {
  product: Product;
}

export default function Specifications({
  product,
}: SpecificationsProps) {
  const specs = [
    ["Производитель", product.manufacturer],
    ["Дыхательный объем", product.specifications.vt],
    ["Эффективность фильтрации", product.specifications.filtration],
    ["Степень увлажнения", product.specifications.humidity],
    ["Сопротивление потоку", product.specifications.resistance],
    ["Мертвое пространство", product.specifications.deadSpace],
    ["Вес", product.specifications.weight],
    ["Регистрационное удостоверение", product.specifications.ru],
    ["Страна происхождения", product.specifications.country],
  ];

  return (
    <section className="cm-card p-6">
      <div className="cm-label mb-2 !text-cm-teal">Характеристики</div>
      <h2 className="mb-5 text-base font-bold">
        Технические характеристики
      </h2>

      <div className="overflow-hidden rounded-lg border border-[var(--cm-rule)] bg-white">
        {specs.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-2 border-b border-[var(--cm-rule)] px-4 py-3 text-xs last:border-b-0 sm:grid-cols-[13rem_1fr]"
          >
            <span className="text-cm-slate">
              {label}
            </span>

            <span className="font-sans text-[11px] font-semibold text-cm-ink sm:text-right">
              {value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
