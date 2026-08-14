import type { PublicProductSource } from "@/lib/verticals/fs510/types";

export function ProvenanceChain({ source }: { source: PublicProductSource }) {
  const stages = [
    {
      label: "Источник",
      value: source.source.name,
      detail: source.source.type,
      short: "ист",
    },
    {
      label: "Документ",
      value: source.document.title,
      detail: source.document.type,
      short: "док",
    },
    {
      label: "Версия",
      value: source.documentVersion.label,
      detail: "Зафиксированная версия",
      short: "вер",
    },
    {
      label: "Основание",
      value: source.evidence.locator,
      detail: "Точный локатор",
      short: "осн",
    },
    {
      label: "Проверка",
      value: displayStatus(source.verification.status),
      detail: source.verification.verifiedAt,
      short: "прв",
    },
    {
      label: "Публикация",
      value: displayStatus(source.publication.status),
      detail: source.publication.publishedAt,
      short: "пуб",
    },
  ];

  return (
    <ol
      aria-label="Цепочка происхождения данных"
      className="flex min-w-[700px] items-start pb-2"
    >
      {stages.map((stage, index) => (
        <li
          key={stage.label}
          className="group relative flex min-w-0 flex-1 flex-col items-center px-2 text-center"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="font-sans text-[8px] tracking-[0.08em] text-cm-dim">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={`flex size-11 items-center justify-center rounded-lg border font-sans text-[10px] font-bold uppercase ${
              index === 4
                ? "border-[var(--cm-verified-border)] bg-cm-verified-soft text-cm-verified"
                : index === 5
                  ? "border-cm-teal/25 bg-cm-teal-soft text-cm-teal"
                  : "border-[var(--cm-rule)] bg-cm-surface-low text-cm-slate"
            }`}>
              {stage.short}
            </span>
            <span className="cm-eyebrow !text-[8px]">
              {stage.label}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 max-w-24 text-[10px] font-semibold leading-4 text-cm-ink">
            {stage.value}
          </p>
          <p className="mt-1 max-w-24 truncate font-sans text-[8px] text-cm-dim">{stage.detail}</p>
          {index < stages.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute -right-2 top-9 z-10 flex text-[10px] text-cm-dim"
            >
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function displayStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("verified")) return "Опубликовано";
  if (normalized.includes("published")) return "Опубликовано";
  if (normalized.includes("active")) return "Опубликовано";
  return status;
}
