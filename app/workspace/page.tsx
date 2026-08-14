import type { Metadata } from "next";

import WorkspaceDashboard from "@/components/workspace/WorkspaceDashboard";
import { createWorkspaceSession } from "@/lib/workspace/mock-data";

export const metadata: Metadata = {
  title: "Рабочее пространство закупки",
  description:
    "Единое рабочее пространство Кибермедика для поиска изделия, сравнения, совместимости и проверки требований ТЗ.",
  alternates: {
    canonical: "/workspace",
  },
};

export default async function WorkspacePage() {
  const session = await createWorkspaceSession();

  return (
    <main className="min-h-screen bg-cm-canvas">
      <header className="border-b border-[var(--cm-rule)] bg-white">
        <div className="cm-container py-10">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <div className="cm-label">Кибермедика · Рабочее пространство</div>
              <h1 className="cm-heading-1 mt-3 max-w-3xl text-3xl font-extrabold">
                Рабочее пространство закупки
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-cm-slate">
                Рабочая страница объединяет поиск, сравнение, совместимость и
                проверку ТЗ. Все выводы основаны на уже подготовленных данных и
                подтверждающих материалах.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--cm-rule)] bg-cm-surface-low p-4">
              <div className="cm-label">Безопасный режим</div>
              <p className="mt-2 text-sm leading-6 text-cm-slate">
                Выводы и рекомендации формируются только по готовым результатам
                поиска, сравнения, совместимости и проверки требований.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="cm-container py-8">
        <WorkspaceDashboard session={session} />
      </section>
    </main>
  );
}
