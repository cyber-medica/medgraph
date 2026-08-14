"use client";

import { useMemo, useState } from "react";

import TenderComplianceTable from "@/components/tender/TenderComplianceTable";
import { analyzeTenderWorkflow } from "@/lib/tender/engine";
import {
  publishedTenderProducts,
  ventilatorTenderRequirements,
} from "@/lib/tender/mock-data";
import type {
  ComplianceResult,
  TenderRequirementDraft,
  TenderRuleOperator,
  TenderWorkflowStep,
} from "@/lib/tender/types";

const operatorOptions: Array<{ value: TenderRuleOperator; label: string }> = [
  { value: "numeric_gte", label: ">=" },
  { value: "numeric_lte", label: "<=" },
  { value: "numeric_eq", label: "=" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
  { value: "string_contains", label: "Contains" },
  { value: "string_exact", label: "Text =" },
];

const characteristicOptions = [
  { key: "battery_hours", label: "Автономная работа", category: "Питание", unit: "ч" },
  { key: "display_size", label: "Экран", category: "Интерфейс", unit: "inch" },
  { key: "niv_support", label: "Поддержка NIV", category: "Режимы вентиляции", unit: null },
  { key: "weight", label: "Масса", category: "Физические параметры", unit: "kg" },
  { key: "device_type", label: "Тип изделия", category: "Классификация", unit: null },
  { key: "compatibility", label: "Совместимость", category: "Совместимость", unit: null },
];

function draftFromRequirement(
  requirement: (typeof ventilatorTenderRequirements)[number],
): TenderRequirementDraft {
  return {
    characteristicKey: requirement.requirementId,
    label: requirement.label,
    category: requirement.category,
    operator: requirement.operator,
    expectedValueInput: Array.isArray(requirement.expectedValue)
      ? requirement.expectedValue.join(", ")
      : String(requirement.expectedValue),
    unit: requirement.unit,
  };
}

const initialDrafts = ventilatorTenderRequirements.map(draftFromRequirement);

function metricLabel(risk: ComplianceResult["summary"]["riskLevel"]) {
  if (risk === "Low") return "Low";
  if (risk === "Medium") return "Medium";
  return "High";
}

function riskClass(risk: ComplianceResult["summary"]["riskLevel"]) {
  if (risk === "Low") return "border-cm-teal/20 bg-cm-teal-soft/70 text-cm-teal";
  if (risk === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-700";
}

function StepBadge({
  index,
  label,
  active,
}: {
  index: number;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        active
          ? "border-cm-teal/30 bg-cm-teal-soft/70 text-cm-teal"
          : "border-[var(--cm-rule)] bg-white text-cm-slate"
      }`}
    >
      <div className="font-sans text-[10px] font-semibold">Шаг {index}</div>
      <div className="mt-1 text-sm font-semibold">{label}</div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--cm-rule)] bg-white px-4 py-3">
      <div className="cm-label">{label}</div>
      <div className="mt-2 font-sans text-2xl font-semibold text-cm-ink">
        {value}
      </div>
    </div>
  );
}

export default function TenderAssistantWorkflow() {
  const [step, setStep] = useState<TenderWorkflowStep>("select_product");
  const [productSlug, setProductSlug] = useState("hamilton-t1");
  const [drafts, setDrafts] = useState<TenderRequirementDraft[]>(initialDrafts);

  const result = useMemo(
    () =>
      analyzeTenderWorkflow({
        workflow: {
          tenderTitle: "Ручной анализ технического задания",
          productSlug,
          drafts,
        },
        products: publishedTenderProducts,
      }),
    [drafts, productSlug],
  );

  const selectedProduct = publishedTenderProducts.find(
    (product) => product.slug === productSlug,
  );

  function updateDraft(index: number, patch: Partial<TenderRequirementDraft>) {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function selectCharacteristic(index: number, key: string) {
    const option = characteristicOptions.find((item) => item.key === key);
    updateDraft(index, {
      characteristicKey: key,
      label: option?.label ?? "",
      category: option?.category ?? "Требование ТЗ",
      unit: option?.unit ?? null,
    });
  }

  function addDraft() {
    if (drafts.length >= 10) return;
    setDrafts((current) => [
      ...current,
      {
        characteristicKey: "device_type",
        label: "Тип изделия",
        category: "Классификация",
        operator: "string_contains",
        expectedValueInput: "",
        unit: null,
      },
    ]);
  }

  function removeDraft(index: number) {
    setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  }

  return (
    <section className="cm-container space-y-6 py-8">
      <div className="grid gap-3 md:grid-cols-4">
        <StepBadge index={1} label="Выбор изделия" active={step === "select_product"} />
        <StepBadge
          index={2}
          label="Требования ТЗ"
          active={step === "edit_requirements"}
        />
        <StepBadge index={3} label="Анализ" active={step === "analysis"} />
        <StepBadge index={4} label="Результат" active={step === "result"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-[var(--cm-rule)] bg-white p-5">
          <div className="cm-label">Шаг 1 · изделие</div>
          <label className="mt-4 block text-sm font-semibold text-cm-ink" htmlFor="tender-product">
            Изделие из опубликованной проекции
          </label>
          <select
            id="tender-product"
            value={productSlug}
            onChange={(event) => {
              setProductSlug(event.target.value);
              setStep("select_product");
            }}
            className="mt-2 h-11 w-full rounded-md border border-[var(--cm-rule)] bg-white px-3 text-sm text-cm-ink outline-none focus:border-cm-teal focus:ring-2 focus:ring-cm-teal/15"
          >
            {publishedTenderProducts.map((product) => (
              <option key={product.slug} value={product.slug}>
                {product.title}
              </option>
            ))}
          </select>
          {selectedProduct ? (
            <div className="mt-4 rounded-lg border border-[var(--cm-rule)] bg-cm-surface-low p-4">
              <div className="text-sm font-semibold text-cm-ink">
                {selectedProduct.title}
              </div>
              <div className="mt-1 text-sm text-cm-slate">
                {selectedProduct.manufacturer} · {selectedProduct.category}
              </div>
              <div className="mt-3 inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1 font-sans text-[10px] font-semibold text-cm-slate">
                Published Projection
              </div>
            </div>
          ) : null}
        </article>

        <article className="rounded-lg border border-[var(--cm-rule)] bg-white p-5">
          <div className="cm-label">Граница данных</div>
          <p className="mt-2 text-sm leading-6 text-cm-slate">
            Анализ использует только опубликованную проекцию знаний. Candidate
            Claims, Review Queue и черновые факты не могут подтвердить требование
            ТЗ.
          </p>
          <button
            type="button"
            onClick={() => setStep("edit_requirements")}
            className="mt-4 h-10 rounded-md bg-cm-ink px-4 text-sm font-semibold text-white transition hover:bg-cm-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-cm-teal/30"
          >
            Перейти к требованиям
          </button>
        </article>
      </div>

      <article className="rounded-lg border border-[var(--cm-rule)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="cm-label">Шаг 2 · требования ТЗ</div>
            <h2 className="mt-2 text-xl font-semibold text-cm-ink">
              Ручной rule-based редактор
            </h2>
          </div>
          <button
            type="button"
            onClick={addDraft}
            disabled={drafts.length >= 10}
            className="h-10 rounded-md border border-[var(--cm-rule)] bg-white px-4 text-sm font-semibold text-cm-ink transition hover:border-cm-teal hover:text-cm-teal disabled:cursor-not-allowed disabled:opacity-50"
          >
            Добавить требование
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {drafts.map((draft, index) => (
            <div
              key={`${draft.characteristicKey}-${index}`}
              className="grid gap-3 rounded-lg border border-[var(--cm-rule)] bg-cm-surface-low p-3 lg:grid-cols-[1fr_0.8fr_0.7fr_0.8fr_0.45fr_auto]"
            >
              <label className="block text-xs font-semibold text-cm-slate">
                Параметр
                <select
                  value={draft.characteristicKey}
                  onChange={(event) => selectCharacteristic(index, event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-[var(--cm-rule)] bg-white px-2 text-sm text-cm-ink outline-none focus:border-cm-teal focus:ring-2 focus:ring-cm-teal/15"
                >
                  {characteristicOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-cm-slate">
                Формулировка
                <input
                  value={draft.label}
                  onChange={(event) => updateDraft(index, { label: event.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-[var(--cm-rule)] bg-white px-2 text-sm text-cm-ink outline-none focus:border-cm-teal focus:ring-2 focus:ring-cm-teal/15"
                />
              </label>
              <label className="block text-xs font-semibold text-cm-slate">
                Правило
                <select
                  value={draft.operator}
                  onChange={(event) =>
                    updateDraft(index, {
                      operator: event.target.value as TenderRuleOperator,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-md border border-[var(--cm-rule)] bg-white px-2 text-sm text-cm-ink outline-none focus:border-cm-teal focus:ring-2 focus:ring-cm-teal/15"
                >
                  {operatorOptions.map((operator) => (
                    <option key={operator.value} value={operator.value}>
                      {operator.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-cm-slate">
                Значение
                <input
                  value={draft.expectedValueInput}
                  onChange={(event) =>
                    updateDraft(index, { expectedValueInput: event.target.value })
                  }
                  placeholder="например 4"
                  className="mt-1 h-10 w-full rounded-md border border-[var(--cm-rule)] bg-white px-2 text-sm text-cm-ink outline-none focus:border-cm-teal focus:ring-2 focus:ring-cm-teal/15"
                />
              </label>
              <label className="block text-xs font-semibold text-cm-slate">
                Ед.
                <input
                  value={draft.unit ?? ""}
                  onChange={(event) =>
                    updateDraft(index, { unit: event.target.value || null })
                  }
                  className="mt-1 h-10 w-full rounded-md border border-[var(--cm-rule)] bg-white px-2 text-sm text-cm-ink outline-none focus:border-cm-teal focus:ring-2 focus:ring-cm-teal/15"
                />
              </label>
              <button
                type="button"
                onClick={() => removeDraft(index)}
                disabled={drafts.length <= 1}
                className="h-10 self-end rounded-md border border-[var(--cm-rule)] bg-white px-3 text-sm font-semibold text-cm-slate transition hover:border-red-200 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Удалить требование"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setStep("analysis")}
          className="mt-5 h-11 rounded-md bg-cm-teal px-5 text-sm font-semibold text-white transition hover:bg-cm-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cm-teal/30"
        >
          Запустить анализ
        </button>
      </article>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryMetric label="соответствует" value={result.summary.matches} />
        <SummaryMetric label="не соответствует" value={result.summary.doesNotMatch} />
        <SummaryMetric label="нет данных" value={result.summary.notVerified + result.summary.unknown} />
        <SummaryMetric label="частично" value={result.summary.partiallyMatches} />
        <div className="rounded-lg border border-[var(--cm-rule)] bg-white px-4 py-3">
          <div className="cm-label">Risk Level</div>
          <div
            className={`mt-3 inline-flex rounded-md border px-3 py-1.5 font-sans text-sm font-semibold ${riskClass(result.summary.riskLevel)}`}
          >
            {metricLabel(result.summary.riskLevel)}
          </div>
        </div>
      </section>

      <article className="rounded-lg border border-[var(--cm-rule)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="cm-label">Шаг 3–4 · анализ и результат</div>
            <h2 className="mt-2 text-xl font-semibold text-cm-ink">
              {result.product.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setStep("result")}
            className="h-10 rounded-md border border-[var(--cm-rule)] bg-white px-4 text-sm font-semibold text-cm-ink transition hover:border-cm-teal hover:text-cm-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-cm-teal/20"
          >
            Скачать отчёт
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-cm-slate">
          Экспорт пока является UI-заглушкой. PDF не создаётся, а результат не
          публикуется и не меняет Verification.
        </p>
      </article>

      <TenderComplianceTable result={result} />
    </section>
  );
}
