import Image from "next/image";

import { Product } from "@/types/product";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface HeroProps {
  product: Product;
}

export default function Hero({ product }: HeroProps) {
  return (
    <section className="cm-card grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="p-6 sm:p-8">
        <Badge>{product.category}</Badge>

        <h1 className="cm-heading-1 mt-4 max-w-3xl text-2xl font-extrabold leading-[1.12] sm:text-3xl">
          {product.name}
        </h1>

        <p className="mt-4 max-w-3xl text-[13px] leading-7 text-cm-slate">
          {product.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button href={`/request?product=${product.slug}`}>Запросить КП</Button>

          <Button
            href={
              product.documents.find((document) => document.kind === "registration")
                ?.url
            }
            target="_blank"
            variant="secondary"
          >
            Скачать РУ
          </Button>

          <Button
            href={
              product.documents.find((document) => document.kind === "manual")?.url
            }
            target="_blank"
            variant="secondary"
          >
            Инструкция
          </Button>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--cm-rule)] bg-[var(--cm-rule)]">
          {product.highlights.map((item) => (
            <div key={item.label} className="bg-white p-4">
              <div className="font-sans text-lg font-bold text-cm-teal">
                {item.value}
              </div>

              <div className="cm-eyebrow mt-2 !text-[9px]">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex min-h-80 items-center border-t border-[var(--cm-rule)] bg-[radial-gradient(ellipse_at_center,#c8e8f0_0%,#dcf0f5_38%,#f4f7fa_72%)] p-8 lg:border-l lg:border-t-0">
        <Image
          src={product.images[0]}
          alt={product.name}
          width={900}
          height={900}
          className="max-h-72 w-full object-contain mix-blend-multiply drop-shadow-[0_16px_28px_rgba(11,19,32,0.14)]"
          priority
        />
        <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/70 bg-white/86 p-4 shadow-[0_12px_34px_rgba(11,19,32,0.09)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="cm-eyebrow !text-cm-teal">
              Проверенная запись
            </div>
            <span className="rounded border border-cm-teal/20 bg-cm-teal-soft px-2 py-1 font-sans text-[9px] text-cm-teal">
              Активно
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2">
            <div>
              <dt className="cm-label text-[8px]">Источник</dt>
              <dd className="mt-1 font-semibold text-cm-ink">Кибермедика</dd>
            </div>
            <div>
              <dt className="cm-label text-[8px]">Документ</dt>
              <dd className="mt-1 font-semibold text-cm-ink">
                {product.documents[0]?.title ?? "Нет данных"}
              </dd>
            </div>
            <div>
              <dt className="cm-label text-[8px]">Дата проверки</dt>
              <dd className="mt-1 font-semibold text-cm-ink">2026</dd>
            </div>
            <div>
              <dt className="cm-label text-[8px]">Статус</dt>
              <dd className="mt-1 font-semibold text-cm-verified">Опубликовано</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
