import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import CompatibilityEvidencePanel from "@/components/knowledge/CompatibilityEvidencePanel";
import { ProvenanceChain } from "@/components/verticals/fs510/ProvenanceChain";
import { getCompatibilityResult } from "@/lib/compatibility/mock-data";
import { formatDate } from "@/lib/date";
import { getPublicProductPage } from "@/lib/verticals/fs510/public-product-page";

export const metadata: Metadata = {
  title: "FS510 — карточка медицинского изделия",
  description:
    "Профессиональная карточка фильтра FS510: регистрационные сведения, документы, характеристики и источник данных.",
  alternates: {
    canonical: "/products/fs510",
  },
  robots: {
    index: false,
    follow: true,
  },
};

function Checkmark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="m7 12 3.2 3.2L17.5 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PageState({
  eyebrow,
  title,
  message,
}: {
  eyebrow: string;
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-cm-canvas px-5 py-16 text-cm-ink">
      <section className="mx-auto grid max-w-4xl overflow-hidden rounded-lg border border-[var(--cm-rule)] bg-white shadow-[0_16px_46px_rgba(11,19,32,0.07)] lg:grid-cols-[1fr_17rem]">
        <div className="p-7 sm:p-9">
          <p className="cm-label !text-cm-teal">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-[-0.025em]">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-[13px] leading-7 text-cm-slate">
            {message}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className="cm-button-primary"
            >
              Перейти в каталог
            </Link>
            <Link
              href="/request?product=fs510"
              className="cm-button-secondary"
            >
              Запросить КП
            </Link>
          </div>
        </div>
        <div className="border-t border-[var(--cm-rule)] bg-cm-surface-low/70 p-5 lg:border-l lg:border-t-0">
          <div className="rounded-lg border border-[var(--cm-rule)] bg-white/88 p-4 shadow-[0_10px_30px_rgba(11,19,32,0.055)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="cm-label !text-cm-teal">Временная карточка</div>
              <span className="rounded-md border border-cm-teal/20 bg-cm-teal-soft px-2 py-1 font-mono text-[8px] font-semibold text-cm-teal">
                обновляется
              </span>
            </div>
            <dl className="mt-4 space-y-3 text-xs">
              {[
                ["Данные", "В процессе"],
                ["Источник", "Публичная карточка"],
                ["Статус", "Обновляется"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="cm-label text-[8px]">{label}</dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-md border border-[var(--cm-rule)] bg-cm-surface-low p-3 text-[11px] leading-5 text-cm-slate">
              Мы показываем временное состояние, пока карточка изделия
              обновляется и проходит проверку доступности.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function Fs510ProductPage() {
  // Resolve environment and product data at request time, not during build.
  await connection();
  const result = await getPublicProductPage("fs510");

  if (result.status === "not-found") {
    return (
      <PageState
        eyebrow="Данные обновляются"
        title="Опубликованная карточка временно недоступна"
        message="Идет обновление опубликованных данных. Пожалуйста, попробуйте позже или отправьте запрос — мы проверим информацию вручную."
      />
    );
  }

  if (result.status === "error") {
    return (
      <PageState
        eyebrow="Данные обновляются"
        title="Опубликованная карточка временно недоступна"
        message="Пожалуйста, попробуйте позже. Если карточка нужна срочно, отправьте запрос — мы подготовим данные и документы вручную."
      />
    );
  }

  const { product } = result;
  const verifiedDate = formatDate(product.publication.verifiedAt);
  const publishedDate = formatDate(product.publication.publishedAt);
  const compatibility = getCompatibilityResult("fs510");

  return (
    <main className="min-h-screen bg-cm-canvas text-cm-ink">
      <div className="border-b border-[var(--cm-rule)] bg-white">
        <div className="cm-container flex flex-wrap items-center justify-between gap-3 py-2.5 text-[10px]">
          <div className="flex items-center gap-2 font-mono font-semibold uppercase tracking-[0.06em] text-cm-verified">
            <span className="flex size-5 items-center justify-center rounded-full bg-cm-verified">
              <Checkmark className="size-3.5 text-white" />
            </span>
            Опубликовано Кибермедика
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-cm-dim">
            <span>
              Проверка:{" "}
              <time dateTime={product.publication.verifiedAt}>
                {verifiedDate}
              </time>
            </span>
            <span>
              Опубликовано:{" "}
              <time dateTime={product.publication.publishedAt}>
                {publishedDate}
              </time>
            </span>
          </div>
        </div>
      </div>

      <div className="cm-container py-6">
        <nav
          aria-label="Хлебные крошки"
          className="mb-4 flex flex-wrap items-center gap-2 font-mono text-[10px] text-cm-dim"
        >
          <Link href="/" className="transition hover:text-cm-teal">
            Главная
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/catalog" className="transition hover:text-cm-teal">
            Каталог
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-cm-ink">FS510</span>
        </nav>

        <section className="cm-card overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--cm-rule)] bg-cm-surface-low px-5 py-3">
            <span className="cm-label">Карточка медицинского изделия · CMR-FS510</span>
            <span className="rounded-md border border-[var(--cm-verified-border)] bg-cm-verified-soft px-2 py-1 font-mono text-[9px] font-semibold text-cm-verified">
              Опубликовано
            </span>
          </div>
          <div className="grid lg:grid-cols-[22.5rem_1fr]">
            <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden border-b border-[var(--cm-rule)] bg-[radial-gradient(ellipse_at_center,#c8e8f0_0%,#dcf0f5_38%,#f4f7fa_72%)] p-10 lg:border-r lg:border-b-0">
              <div
                aria-hidden="true"
                className="absolute inset-x-12 bottom-10 h-12 rounded-[100%] bg-cm-ink/10 blur-2xl"
              />
              <Image
                src={product.heroImage.src}
                alt={product.heroImage.alt}
                width={760}
                height={760}
                priority
                className="relative max-h-[270px] w-full object-contain mix-blend-multiply drop-shadow-[0_16px_28px_rgba(11,19,32,0.14)]"
              />
              <div className="absolute left-4 top-4 rounded border border-white/70 bg-white/80 px-2 py-1 font-mono text-[9px] text-cm-teal backdrop-blur">
                Фото изделия
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--cm-verified-border)] bg-cm-verified-soft px-2.5 py-1 font-mono text-[9px] font-semibold text-cm-verified">
                  <Checkmark className="size-3" />
                  {displayStatus(product.publication.status)}
                </span>
                <span className="rounded border border-[var(--cm-rule)] bg-white px-2.5 py-1 font-mono text-[9px] text-cm-dim">
                  {product.category}
                </span>
              </div>

              <p className="mt-5 font-mono text-[10px] font-semibold tracking-[0.1em] text-cm-teal">
                FS510 · HMEF
              </p>
              <h1 className="mt-2 max-w-2xl text-2xl font-extrabold leading-[1.12] tracking-[-0.03em] sm:text-3xl">
                {product.name}
              </h1>
              <p className="mt-4 max-w-2xl text-[13px] leading-6 text-cm-slate">
                {product.description}
              </p>

              <dl className="mt-6 divide-y divide-[var(--cm-rule)] border-y border-[var(--cm-rule)]">
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="cm-label">
                    Производитель
                  </dt>
                  <dd className="text-xs font-semibold">{product.manufacturer}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="cm-label">
                    Регистрационное удостоверение
                  </dt>
                  <dd className="font-mono text-[11px] font-semibold">
                    {product.registration.number}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="cm-label">
                    Статус РУ
                  </dt>
                  <dd className="text-xs font-semibold text-cm-verified">
                    {product.registration.status}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Link
                  href="/request?product=fs510"
                  className="cm-button-primary"
                >
                  Запросить КП
                </Link>
                <a
                  href="#evidence"
                  className="cm-button-secondary"
                >
                  Смотреть документы
                </a>
              </div>
            </div>
          </div>
        </section>

        <nav
          aria-label="Разделы карточки"
          className="sticky top-24 z-30 mt-3 flex gap-0 overflow-x-auto border-y border-[var(--cm-rule)] bg-white/95 px-2 text-xs font-medium backdrop-blur lg:top-14"
        >
          {[
            ["#overview", "Ключевое"],
            ["#compatibility", "Совместимость"],
            ["#claims", "Проверенные факты"],
            ["#evidence", "Документы"],
            ["#history", "История"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="min-h-10 shrink-0 border-b-2 border-transparent px-4 py-3 text-cm-slate transition hover:border-cm-teal hover:text-cm-teal"
            >
              {label}
            </a>
          ))}
        </nav>

        <section id="overview" className="scroll-mt-28 pt-5">
          <div className="grid gap-3 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-lg bg-cm-ink p-6 text-white">
              <p className="cm-label !text-white/40">
                Для быстрого решения
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.02em]">
                Ключевое за 30 секунд
              </h2>
              <ul className="mt-6 space-y-4">
                {product.keySummary.map((item, index) => (
                  <li key={item} className="flex gap-3 text-xs leading-6 text-white/70">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-cm-teal font-mono text-[9px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="cm-card p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="cm-label !text-cm-teal">
                    Характеристики
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.02em]">
                    Ключевые характеристики
                  </h2>
                </div>
                <span className="rounded border border-[var(--cm-rule)] bg-cm-surface-low px-2 py-1 font-mono text-[9px] text-cm-dim">
                  {product.characteristics.length} параметра
                </span>
              </div>
              <dl className="mt-5 grid gap-px overflow-hidden rounded-lg border border-[var(--cm-rule)] bg-[var(--cm-rule)] sm:grid-cols-2">
                {product.characteristics.map((item) => (
                  <div
                    key={item.label}
                    className="bg-white p-4"
                  >
                    <dt className="font-mono text-[9px] uppercase tracking-[0.06em] text-cm-dim">
                      {item.label}
                    </dt>
                    <dd className="mt-2 font-mono text-base font-bold">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <CompatibilityEvidencePanel result={compatibility} />

        <section id="claims" className="scroll-mt-28 pt-10">
          <div className="max-w-3xl">
            <p className="cm-label !text-cm-teal">
              Проверенные факты
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] sm:text-2xl">
              Что именно проверено — и в каких границах
            </h2>
            <p className="mt-3 max-w-2xl text-xs leading-6 text-cm-slate">
              Каждый опубликованный факт показан вместе с областью применения и ограничениями.
              Это не общая рекомендация и не обещание применимости за пределами
              указанного контекста.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {product.claims.map((claim) => {
              const source = product.sources.find(
                (item) => item.id === claim.sourceId,
              );

              return (
                <article
                  key={claim.code}
                  className="cm-card overflow-hidden border-t-2 border-t-cm-teal"
                >
                  <div className="border-b border-[var(--cm-rule)] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-cm-teal">
                          {claim.code}
                        </p>
                        <h3 className="mt-2 text-sm font-bold">
                          {claim.displayName}
                        </h3>
                      </div>
                      <span className="rounded-md bg-cm-teal-soft px-3 py-2 font-mono text-base font-bold text-cm-teal">
                        {claim.formattedValue}
                      </span>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-cm-slate">
                      {claim.scope.summary}
                    </p>
                  </div>

                  <div className="grid gap-px bg-[var(--cm-rule)] sm:grid-cols-2">
                    <div className="bg-cm-surface-low p-5">
                      <h4 className="cm-label !text-cm-teal">
                        Применимо к
                      </h4>
                      <ul className="mt-3 space-y-2.5">
                        {claim.scope.appliesTo.map((item) => (
                          <li
                            key={item}
                            className="flex gap-2 text-[11px] leading-5"
                          >
                            <Checkmark className="mt-0.5 size-3.5 shrink-0 text-cm-verified" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-cm-warning-soft p-5">
                      <h4 className="cm-label !text-cm-warning">
                        Ограничения
                      </h4>
                      <ul className="mt-3 space-y-2.5">
                        {claim.limitations.map((item) => (
                          <li
                            key={item}
                            className="flex gap-2 text-[11px] leading-5 text-cm-slate"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cm-warning"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cm-rule)] px-5 py-3 font-mono text-[9px] text-cm-dim">
                    <span>
                      Публикация: <span className="text-cm-ink">проверенная запись</span>
                    </span>
                    {source ? (
                      <a
                        href={`#source-${source.id}`}
                        className="font-sans text-[10px] font-semibold text-cm-teal hover:underline"
                      >
                        Перейти к документу ↓
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="evidence" className="scroll-mt-28 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="cm-label !text-cm-teal">
                Источник данных
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] sm:text-2xl">
                От источника до публикации
              </h2>
              <p className="mt-3 max-w-2xl text-xs leading-6 text-cm-slate">
                Цепочка показывает происхождение каждого опубликованного факта.
                Документ можно открыть напрямую, а основание — сверить по локатору.
              </p>
            </div>
            <span className="rounded border border-cm-teal/20 bg-cm-teal-soft px-2.5 py-1 font-mono text-[9px] text-cm-teal">
              {product.sources.length} источника данных
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {product.sources.map((source) => (
              <article
                id={`source-${source.id}`}
                key={source.id}
                className="scroll-mt-28 cm-card overflow-hidden"
              >
                <div className="border-b border-[var(--cm-rule)] bg-cm-surface-low px-5 py-3">
                  <span className="cm-label">Запись о подтверждении данных</span>
                </div>
                <div className="overflow-x-auto p-5">
                  <ProvenanceChain source={source} />

                <div className="mt-5 grid gap-4 rounded-lg border border-[var(--cm-rule)] bg-cm-surface-low p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-[var(--cm-verified-border)] bg-cm-verified-soft px-2 py-1 font-mono text-[9px] font-semibold text-cm-verified">
                        {displayStatus(source.verification.status)}
                      </span>
                      <span className="font-mono text-[9px] text-cm-dim">
                        Публичная запись
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-bold">
                      {source.document.title}
                    </h3>
                    <p className="mt-1 font-mono text-[9px] text-cm-dim">
                      {source.source.name} · {displayDocumentType(source.document.type)} ·{" "}
                      {source.documentVersion.label}
                    </p>
                    <blockquote className="mt-4 border-l-2 border-cm-teal pl-4 font-mono text-[10px] leading-5 text-cm-slate">
                      «{source.evidence.excerpt}»
                    </blockquote>
                    <p className="mt-3 font-mono text-[9px] text-cm-dim">
                      Локатор: {source.evidence.locator}
                    </p>
                  </div>
                  <a
                    href={source.document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="cm-button-secondary shrink-0 !text-cm-teal"
                  >
                    Открыть документ ↗
                  </a>
                </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="history" className="scroll-mt-28 pt-10">
          <div className="cm-card grid gap-7 p-6 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="cm-label !text-cm-teal">
                История изменений
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.02em]">
                История публикаций
              </h2>
              <p className="mt-3 text-xs leading-6 text-cm-slate">
                Здесь отображаются опубликованные события карточки изделия:
                проверка данных, документы и изменения публичной записи.
              </p>
            </div>

            <ol className="relative ml-2 border-l border-cm-teal/25">
              {product.publicationHistory.map((item) => (
                <li
                  key={`${item.publicationKey}-${item.effectiveAt}`}
                  className="relative pb-6 pl-6 last:pb-0"
                >
                  <span className="absolute -left-[5px] top-1 size-2.5 rounded-full border-2 border-white bg-cm-teal ring-1 ring-cm-teal/20" />
                  <div className="flex flex-wrap items-center gap-2">
                    <time
                      dateTime={item.effectiveAt}
                      className="font-mono text-[10px] font-semibold text-cm-teal"
                    >
                      {formatDate(item.effectiveAt)}
                    </time>
                    <span className="rounded bg-cm-surface-low px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-cm-dim">
                      {displayEvent(item.event)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xs font-semibold">{item.title}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-cm-slate">
                    {item.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-lg bg-cm-teal p-6 text-white">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-3xl">
              <p className="cm-label !text-white/55">
                Коммерческое предложение
              </p>
              <h2 className="mt-2 text-xl font-bold">
                Нужны цена, срок поставки или подтверждение характеристик?
              </h2>
              <p className="mt-2 text-xs leading-6 text-white/70">
                Укажите организацию и количество — подготовим ответ для вашей
                закупочной задачи.
              </p>
            </div>
            <Link
              href="/request?product=fs510"
              className="cm-button-secondary shrink-0 !border-white !text-cm-teal"
            >
              Запросить КП
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function displayStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("verified")) return "Опубликовано";
  if (normalized.includes("published")) return "Опубликовано";
  if (normalized.includes("active")) return "Опубликовано";
  return status;
}

function displayDocumentType(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("registration")) return "Регистрационный документ";
  if (normalized.includes("manual")) return "Инструкция";
  if (normalized.includes("declaration")) return "Декларация";
  return "Документ";
}

function displayEvent(event: string) {
  const normalized = event.toLowerCase();
  if (normalized.includes("publish")) return "публикация";
  if (normalized.includes("verify")) return "проверка";
  if (normalized.includes("update")) return "обновление";
  return event;
}
