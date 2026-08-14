import type {
  ComplianceResult,
  ComplianceStatus,
  RequirementResult,
} from "@/lib/tender/types";

function statusLabel(status: ComplianceStatus) {
  const labels: Record<ComplianceStatus, string> = {
    matches: "✓ соответствует",
    partially_matches: "△ частично",
    not_verified: "— нет подтверждения",
    does_not_match: "✕ не соответствует",
    unknown: "— неизвестно",
  };
  return labels[status];
}

function statusClass(status: ComplianceStatus) {
  if (status === "matches") {
    return "border-cm-teal/20 bg-cm-teal-soft/70 text-cm-teal";
  }
  if (status === "partially_matches") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "does_not_match") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function EvidenceCell({ result }: { result: RequirementResult }) {
  if (!result.evidence) {
    return (
      <>
        <td className="min-w-52 border-l border-[var(--cm-rule)] px-4 py-4 align-top text-xs text-cm-slate">
          Нет источника
        </td>
        <td className="min-w-52 border-l border-[var(--cm-rule)] px-4 py-4 align-top text-xs text-cm-slate">
          Нет документа
        </td>
        <td className="min-w-32 border-l border-[var(--cm-rule)] px-4 py-4 align-top font-sans text-xs text-cm-dim">
          Нет даты
        </td>
      </>
    );
  }

  return (
    <>
      <td className="min-w-52 border-l border-[var(--cm-rule)] px-4 py-4 align-top text-xs text-cm-slate">
        <a
          href={result.evidence.source.url}
          className="hover:text-cm-teal hover:underline"
        >
          {result.evidence.source.title}
        </a>
      </td>
      <td className="min-w-52 border-l border-[var(--cm-rule)] px-4 py-4 align-top text-xs text-cm-slate">
        {result.evidence.documentVersion.title}
        <div className="mt-1 font-sans text-[10px] text-cm-dim">
          {result.evidence.documentVersion.version}
        </div>
      </td>
      <td className="min-w-32 border-l border-[var(--cm-rule)] px-4 py-4 align-top font-sans text-xs text-cm-dim">
        {result.evidence.lastUpdated}
      </td>
    </>
  );
}

export default function TenderComplianceTable({
  result,
}: {
  result: ComplianceResult;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--cm-rule)] bg-white shadow-[var(--cm-shadow-card)]">
      <table className="min-w-[1080px] border-collapse text-left">
        <thead className="bg-cm-surface-low text-xs text-cm-slate">
          <tr>
            <th className="sticky left-0 z-10 min-w-56 bg-cm-surface-low px-4 py-3 font-semibold">
              Требование ТЗ
            </th>
            <th className="min-w-44 px-4 py-3 font-semibold">Значение изделия</th>
            <th className="min-w-44 px-4 py-3 font-semibold">Результат</th>
            <th className="min-w-52 px-4 py-3 font-semibold">Источник</th>
            <th className="min-w-52 px-4 py-3 font-semibold">Документ</th>
            <th className="min-w-32 px-4 py-3 font-semibold">Дата</th>
          </tr>
        </thead>
        <tbody>
          {result.results.map((item) => (
            <tr
              key={item.requirement.requirementId}
              className="border-t border-[var(--cm-rule)]"
            >
              <th className="sticky left-0 z-10 bg-white px-4 py-4 align-top">
                <div className="text-sm font-semibold text-cm-ink">
                  {item.requirement.label}
                </div>
                <div className="mt-1 text-xs text-cm-dim">
                  {item.requirement.category}
                </div>
                <div className="mt-2 font-sans text-[11px] text-cm-slate">
                  требуется: {item.expectedValueLabel}
                </div>
              </th>
              <td className="px-4 py-4 align-top text-sm font-semibold text-cm-ink">
                {item.actualValueLabel}
              </td>
              <td className="border-l border-[var(--cm-rule)] px-4 py-4 align-top">
                <span
                  className={`inline-flex rounded-md border px-2.5 py-1 font-sans text-[10px] font-semibold ${statusClass(item.status)}`}
                >
                  {statusLabel(item.status)}
                </span>
                {item.notes.length ? (
                  <p className="mt-2 text-xs leading-5 text-cm-slate">
                    {item.notes.join(" ")}
                  </p>
                ) : null}
              </td>
              <EvidenceCell result={item} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
