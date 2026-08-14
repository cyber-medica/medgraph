import Link from "next/link";

export default function CTA() {
  return (
    <section
      aria-labelledby="homepage-cta-title"
      className="cm-section bg-cm-canvas"
    >
      <div className="cm-container">
        <div className="cm-card grid gap-5 overflow-hidden bg-[linear-gradient(135deg,#ffffff_0%,#f4fafb_100%)] p-5 sm:p-6 lg:grid-cols-[minmax(0,3fr)_minmax(15rem,1fr)] lg:items-center lg:gap-8 lg:p-8">
          <div className="max-w-[38rem]">
            <h2
              id="homepage-cta-title"
              className="cm-heading-2 text-2xl font-extrabold leading-[1.2] sm:text-[26px] lg:text-[30px]"
            >
              Не нашли нужное оборудование?
            </h2>
            <p className="mt-3 text-[14px] leading-7 text-cm-slate">
              Отправьте наименование, модель или техническое задание — мы рассмотрим
              запрос и подберём подходящие варианты.
            </p>
          </div>
          <nav
            aria-label="Отправить запрос на оборудование"
            className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end"
          >
            <Link href="/request" className="cm-button-primary !min-h-[48px] w-full sm:w-auto">
              Отправить запрос
            </Link>
          </nav>
        </div>
      </div>
    </section>
  );
}
