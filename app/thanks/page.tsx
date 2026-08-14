import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Заявка отправлена",
  description:
    "Кибермедика получила заявку и свяжется с клиентом, чтобы уточнить детали и подготовить предложение.",
  alternates: {
    canonical: "/thanks",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ThanksPage() {
  return (
    <main className="bg-cm-canvas">
      <section className="cm-container grid min-h-[58svh] place-items-center py-10 sm:min-h-[60svh] sm:py-14 lg:min-h-[calc(100svh-14.875rem)] lg:py-16">
        <div className="cm-card w-full max-w-xl px-6 py-10 text-center sm:px-10 sm:py-12">
          <div
            aria-hidden="true"
            className="mx-auto flex size-14 items-center justify-center rounded-full border border-[var(--cm-verified-border)] bg-cm-verified-soft text-cm-verified"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-7">
              <path
                d="m7 12 3.2 3.2L17.5 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="mt-6" role="status" aria-live="polite">
            <h1 className="cm-heading-1 cm-balanced text-[1.75rem] font-extrabold leading-tight sm:text-3xl">
              Заявка отправлена
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-cm-slate">
              Спасибо! Мы получили вашу заявку. Специалист Кибермедика свяжется
              с вами, чтобы уточнить детали и подготовить предложение.
            </p>
          </div>

          <Link
            href="/catalog"
            className="cm-button-primary mt-8 !min-h-[44px] w-full sm:w-auto sm:min-w-52"
          >
            Вернуться в каталог
          </Link>
        </div>
      </section>
    </main>
  );
}
