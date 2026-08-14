"use client";

import { useMemo, useState } from "react";

import {
  compatibilityTypeLabels,
  filterCompatibilityRecords,
} from "@/lib/compatibility/engine";
import type {
  CompatibilityRecord,
  CompatibilityResult,
  CompatibilityStatus,
} from "@/lib/compatibility/types";

type CompatibilityFilter = "all" | "confirmed" | "conditions" | "not_verified";

const filters: Array<{ id: CompatibilityFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "confirmed", label: "Опубликовано" },
  { id: "conditions", label: "При условиях" },
  { id: "not_verified", label: "Нет подтверждённых данных" },
];

function statusLabel(status: CompatibilityStatus) {
  const labels: Record<CompatibilityStatus, string> = {
    compatible: "Опубликовано",
    compatible_with_conditions: "При условиях",
    not_verified: "Нет подтверждённых данных",
    not_compatible: "Не применяется",
    unknown: "Нет подтверждённых данных",
  };
  return labels[status];
}

function statusClass(status: CompatibilityStatus) {
  if (status === "compatible") {
    return "border-cm-teal/20 bg-cm-teal-soft/70 text-cm-teal";
  }
  if (status === "compatible_with_conditions") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "not_compatible") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function otherProduct(record: CompatibilityRecord, productSlug: string) {
  return record.productA.slug === productSlug ? record.productB : record.productA;
}

function CompatibilityCard({
  record,
  productSlug,
}: {
  record: CompatibilityRecord;
  productSlug: string;
}) {
  const product = otherProduct(record, productSlug);
  const source = record.evidence.sourceUrls[0];

  return (
    <article className="rounded-lg border border-[var(--cm-rule)] bg-white p-4 shadow-[0_8px_22px_rgba(11,19,32,0.03)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="cm-label">{compatibilityTypeLabels[record.compatibilityType]}</div>
          <h3 className="mt-2 text-sm font-semibold text-cm-ink">
            {product.title}
          </h3>
          <p className="mt-1 text-xs text-cm-slate">
            {product.manufacturer} · {product.category}
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-md border px-2.5 py-1 font-sans text-[9px] font-semibold ${statusClass(record.status)}`}
        >
          {statusLabel(record.status)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-[var(--cm-rule)] pt-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="cm-label text-[8px]">Источник</dt>
          <dd className="mt-1 break-all text-cm-slate">
            {source ? (
              <a href={source} className="hover:text-cm-teal hover:underline">
                {source}
              </a>
            ) : (
              "Нет источника"
            )}
          </dd>
        </div>
        <div>
          <dt className="cm-label text-[8px]">Документ</dt>
          <dd className="mt-1 font-sans text-cm-slate">
            {record.evidence.documentVersionIds.join(", ")}
          </dd>
        </div>
        <div>
          <dt className="cm-label text-[8px]">Последнее обновление</dt>
          <dd className="mt-1 font-sans text-cm-slate">
            {record.evidence.lastUpdated}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-md border border-[var(--cm-rule)] bg-cm-surface-low/70 p-3">
        <div className="cm-label text-[8px]">Примечание</div>
        <p className="mt-2 text-xs leading-6 text-cm-slate">
          {record.status === "not_verified"
            ? "Нет подтверждённых данных."
            : record.evidence.notes.join(" ")}
        </p>
      </div>
    </article>
  );
}

export default function CompatibilityEvidencePanel({
  result,
}: {
  result: CompatibilityResult;
}) {
  const [filter, setFilter] = useState<CompatibilityFilter>("all");
  const allRecords = result.groups.flatMap((group) => group.records);
  const filteredRecords = useMemo(
    () => filterCompatibilityRecords(allRecords, filter),
    [allRecords, filter],
  );

  return (
    <section id="compatibility" className="scroll-mt-28 pt-10">
      <div className="cm-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="cm-label !text-cm-teal">Совместимость</p>
            <h2 className="cm-heading-2 mt-2 text-xl font-bold sm:text-2xl">
              Доказуемая совместимость
            </h2>
            <p className="mt-3 max-w-2xl text-xs leading-6 text-cm-slate">
              Связи показываются только с источником, версией документа и
              статусом проверки. Совместимость не выводится по аналогии.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold transition duration-200 ${
                  filter === item.id
                    ? "border-cm-teal/30 bg-cm-teal-soft text-cm-teal"
                    : "border-[var(--cm-rule)] bg-white text-cm-slate hover:border-cm-teal/25 hover:text-cm-teal"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRecords.length ? (
          <div className="mt-5 grid gap-3">
            {filteredRecords.map((record) => (
              <CompatibilityCard
                key={record.compatibilityId}
                record={record}
                productSlug={result.productSlug}
              />
            ))}
          </div>
        ) : (
          <div className="cm-empty-state mt-5">
            <div className="cm-empty-icon">↔</div>
            <div className="mt-4 text-sm font-semibold">
              Нет подтверждённых данных о совместимости.
            </div>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-cm-slate">
              Для выбранного фильтра нет записей с источником и документом.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
