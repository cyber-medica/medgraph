"use client";

import { useState } from "react";

const OPERATION_KEY = "production-launch-catalog-import-v1";
const MANIFEST_SHA256 =
  "aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309";
const PRODUCTION_LAUNCH_RELEASE_PHASES = [
  "import",
  "create_structured_revisions",
  "review_structured",
  "publish_structured",
  "create_product_revisions",
  "review_products",
  "publish_products",
] as const;
type ProductionLaunchReleasePhase =
  (typeof PRODUCTION_LAUNCH_RELEASE_PHASES)[number];

type PhaseState = Readonly<{
  status: "idle" | "pending" | "completed" | "already_complete" | "blocked";
  message: string;
}>;

export default function ProductionLaunchReleaseExecution() {
  const [states, setStates] = useState<Record<ProductionLaunchReleasePhase, PhaseState>>(
    Object.fromEntries(PRODUCTION_LAUNCH_RELEASE_PHASES.map((phase) => [
      phase,
      { status: "idle", message: "" },
    ])) as Record<ProductionLaunchReleasePhase, PhaseState>,
  );

  async function execute(phase: ProductionLaunchReleasePhase) {
    setStates((current) => ({
      ...current,
      [phase]: { status: "pending", message: "Выполняется fail-closed проверка…" },
    }));
    try {
      const response = await fetch("/internal/operations/production-launch-release", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationKey: OPERATION_KEY,
          manifestSha256: MANIFEST_SHA256,
          phase,
        }),
      });
      const result = await response.json() as {
        status?: unknown;
        code?: unknown;
        count?: unknown;
      };
      if (
        response.ok
        && (result.status === "completed" || result.status === "already_complete")
        && result.count === 43
      ) {
        setStates((current) => ({
          ...current,
          [phase]: {
            status: result.status,
            message: `${phase}: ${result.status}, exact scope 43/43.`,
          },
        }));
        return;
      }
      setStates((current) => ({
        ...current,
        [phase]: {
          status: "blocked",
          message: `Операция остановлена fail-closed: ${String(result.code ?? "unknown")}.`,
        },
      }));
    } catch {
      setStates((current) => ({
        ...current,
        [phase]: { status: "blocked", message: "Операция остановлена fail-closed." },
      }));
    }
  }

  return (
    <section className="mt-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-6">
      {PRODUCTION_LAUNCH_RELEASE_PHASES.map((phase, index) => {
        const state = states[phase];
        const previous = index === 0 ? null : states[PRODUCTION_LAUNCH_RELEASE_PHASES[index - 1]];
        const previousComplete = !previous
          || previous.status === "completed"
          || previous.status === "already_complete";
        return (
          <div className="rounded-lg border border-slate-200 p-4" key={phase}>
            <button
              className="min-h-11 rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!previousComplete || state.status === "pending"}
              onClick={() => execute(phase)}
              type="button"
            >
              {state.status === "pending" ? "Выполняется…" : phase}
            </button>
            {state.message ? <p className="mt-2 text-sm" role="status">{state.message}</p> : null}
          </div>
        );
      })}
    </section>
  );
}
