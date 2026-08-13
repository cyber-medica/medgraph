import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Диагностика HTML-документа",
  robots: {
    index: false,
    follow: false,
  },
};

export default function IphoneDocumentControlPage() {
  return (
    <main className="min-h-screen bg-cm-canvas">
      <section className="cm-container py-12 sm:py-16">
        <div className="cm-card mx-auto max-w-2xl p-7 sm:p-10">
          <p className="cm-label">P0 DIAGNOSTIC CONTROL</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-[-0.025em] text-cm-ink sm:text-3xl">
            HTML-документ Кибермедика загружен
          </h1>
          <p className="mt-4 text-sm leading-6 text-cm-slate sm:text-base sm:leading-7">
            Эта контрольная страница использует тот же App Router layout, CSS и
            security headers, но не читает каталог и не выполняет асинхронную
            серверную работу.
          </p>
          <dl className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--cm-rule)] bg-white p-4">
              <dt className="font-bold text-cm-ink">Document</dt>
              <dd className="mt-1 text-cm-slate">complete</dd>
            </div>
            <div className="rounded-xl border border-[var(--cm-rule)] bg-white p-4">
              <dt className="font-bold text-cm-ink">Catalog transport</dt>
              <dd className="mt-1 text-cm-slate">not requested</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
