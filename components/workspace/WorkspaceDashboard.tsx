import Link from "next/link";

import type {
  WorkspaceInsight,
  WorkspaceRecommendation,
  WorkspaceSession,
} from "@/lib/workspace/types";

function severityClass(severity: WorkspaceInsight["severity"]) {
  if (severity === "warning") return "border-red-200 bg-red-50 text-red-800";
  if (severity === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-cm-teal/20 bg-cm-teal-soft/70 text-cm-teal";
}

function priorityLabel(priority: WorkspaceRecommendation["priority"]) {
  const labels: Record<WorkspaceRecommendation["priority"], string> = {
    high: "важно",
    medium: "следующий шаг",
    low: "позже",
  };
  return labels[priority];
}

function Panel({
  title,
  eyebrow,
  children,
  href,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <article className="rounded-lg border border-[var(--cm-rule)] bg-white p-5 shadow-[var(--cm-shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="cm-label">{eyebrow}</div>
          <h2 className="mt-2 text-lg font-semibold text-cm-ink">{title}</h2>
        </div>
        <Link href={href} className="text-xs font-semibold text-cm-teal hover:underline">
          Открыть
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

export default function WorkspaceDashboard({
  session,
}: {
  session: WorkspaceSession;
}) {
  const compatibilityRecords = session.compatibility.groups.flatMap(
    (group) => group.records,
  );

  return (
    <div className="space-y-7">
      <section className="grid gap-3 lg:grid-cols-4">
        <Panel title="Поиск изделия" eyebrow="Поиск" href="/search?q=FS510">
          <div className="font-sans text-2xl font-semibold text-cm-ink">
            {session.search.total}
          </div>
          <p className="mt-2 text-sm leading-6 text-cm-slate">
            Результатов по запросу {session.selection.searchQuery}.
          </p>
        </Panel>

        <Panel title="Сравнение" eyebrow="Модели" href="/compare">
          <div className="font-sans text-2xl font-semibold text-cm-ink">
            {session.comparison.summary.differences}
          </div>
          <p className="mt-2 text-sm leading-6 text-cm-slate">
            Различий между выбранными товарами каталога.
          </p>
        </Panel>

        <Panel
          title="Совместимость"
          eyebrow="Связи"
          href="/products/fs510#compatibility"
        >
          <div className="font-sans text-2xl font-semibold text-cm-ink">
            {compatibilityRecords.length}
          </div>
          <p className="mt-2 text-sm leading-6 text-cm-slate">
            Связей FS510 с аппаратами и условиями применения.
          </p>
        </Panel>

        <Panel title="Проверка ТЗ" eyebrow="Требования" href="/tender">
          <div className="font-sans text-2xl font-semibold text-cm-ink">
            {session.tender.summary.matches}/{session.tender.summary.totalRequirements}
          </div>
          <p className="mt-2 text-sm leading-6 text-cm-slate">
            Требований соответствуют по pilot-проверке Hamilton T1.
          </p>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-[var(--cm-rule)] bg-white p-5 shadow-[var(--cm-shadow-card)]">
          <div className="cm-label !text-cm-teal">Ключевые выводы</div>
          <div className="mt-4 grid gap-3">
            {session.insights.map((insight) => (
              <div
                key={insight.insightId}
                className={`rounded-md border p-4 ${severityClass(insight.severity)}`}
              >
                <div className="font-semibold">{insight.title}</div>
                <p className="mt-1 text-sm leading-6">{insight.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--cm-rule)] bg-white p-5 shadow-[var(--cm-shadow-card)]">
          <div className="cm-label !text-cm-teal">Следующие действия</div>
          <div className="mt-4 grid gap-3">
            {session.recommendations.map((recommendation) => (
              <Link
                key={recommendation.recommendationId}
                href={recommendation.href}
                className="rounded-md border border-[var(--cm-rule)] bg-cm-surface-low/70 p-4 transition duration-200 hover:border-cm-teal/30 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-cm-ink">
                    {recommendation.label}
                  </div>
                  <span className="rounded-md border border-[var(--cm-rule)] bg-white px-2 py-1 font-sans text-[9px] text-cm-dim">
                    {priorityLabel(recommendation.priority)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-cm-slate">
                  {recommendation.reason}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--cm-rule)] bg-cm-surface-low p-5 text-sm leading-6 text-cm-slate">
        <div className="cm-label !text-cm-teal">Граница безопасности</div>
        <ul className="mt-3 grid gap-2">
          {session.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
