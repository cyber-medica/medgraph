import type { Metadata } from "next";

import TenderAssistantWorkflow from "@/components/tender/TenderAssistantWorkflow";

export const metadata: Metadata = {
  title: "Tender Assistant",
  description:
    "Rule-based анализ соответствия медицинского изделия требованиям технического задания с источниками и документами.",
  alternates: {
    canonical: "/tender",
  },
};

export default function TenderPage() {
  return (
    <main className="min-h-screen bg-cm-canvas">
      <header className="border-b border-[var(--cm-rule)] bg-white">
        <div className="cm-container py-10">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <div className="cm-label">Кибермедика · ТЗ</div>
              <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-[-0.03em]">
                Tender Assistant
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-cm-slate">
                Пошаговый анализ технического задания: выбор изделия, ввод
                требований, rule-based проверка и отчёт по соответствию.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--cm-rule)] bg-cm-surface-low p-4">
              <div className="cm-label">Без AI</div>
              <p className="mt-2 text-sm leading-6 text-cm-slate">
                Анализ выполняется детерминированными правилами и использует
                только опубликованную проекцию знаний.
              </p>
            </div>
          </div>
        </div>
      </header>

      <TenderAssistantWorkflow />
    </main>
  );
}
