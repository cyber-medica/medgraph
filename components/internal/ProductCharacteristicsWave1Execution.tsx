"use client";

import { useState } from "react";

const OPERATION_KEY = "product-characteristics-wave-1-patch-v1";
const MANIFEST_SHA256 =
  "8d045b48864c2ca1d4de0c4403edb7eb6e508345cc84afa2594cd42a69db24c1";

type PatchEvidence = {
  productId: string;
  sourceUid: string;
  model: string;
  status: "applied" | "already_applied";
  draftUpdatedAt: string;
  payloadChecksum: string;
  characteristicCount: 10;
};

type OperationState = {
  status: "idle" | "pending" | "completed" | "already_complete" | "blocked";
  message: string;
  applied?: number;
  alreadyApplied?: number;
  patches?: PatchEvidence[];
};

export default function ProductCharacteristicsWave1Execution() {
  const [state, setState] = useState<OperationState>({ status: "idle", message: "" });
  const finished = state.status === "completed" || state.status === "already_complete";

  async function execute() {
    setState({ status: "pending", message: "Выполняется fail-closed Production preflight…" });
    try {
      const response = await fetch("/internal/operations/product-characteristics-wave-1", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationKey: OPERATION_KEY, manifestSha256: MANIFEST_SHA256 }),
      });
      const result = await response.json() as {
        status?: unknown;
        code?: unknown;
        applied?: unknown;
        alreadyApplied?: unknown;
        patches?: PatchEvidence[];
        projectionInvariant?: unknown;
      };
      if (
        response.ok
        && (result.status === "completed" || result.status === "already_complete")
        && typeof result.applied === "number"
        && typeof result.alreadyApplied === "number"
        && Array.isArray(result.patches)
        && result.patches.length === 15
        && result.projectionInvariant === true
      ) {
        setState({
          status: result.status,
          message: result.status === "completed"
            ? "15 deterministic drafts применены и replay-проверены."
            : "Операция уже завершена; duplicate writes не созданы.",
          applied: result.applied,
          alreadyApplied: result.alreadyApplied,
          patches: result.patches,
        });
        return;
      }
      setState({
        status: "blocked",
        message: `Операция остановлена fail-closed: ${String(result.code ?? "unknown")}.`,
      });
    } catch {
      setState({ status: "blocked", message: "Операция остановлена fail-closed." });
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <button
        className="rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50"
        disabled={state.status === "pending" || finished}
        onClick={execute}
        type="button"
      >
        {state.status === "pending" ? "Проверка и patch…" : "Применить exact 15 patches"}
      </button>
      {state.message ? <p className="mt-4" role="status">{state.message}</p> : null}
      {finished ? (
        <>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <div><dt>Applied now</dt><dd>{state.applied}</dd></div>
            <div><dt>Already applied</dt><dd>{state.alreadyApplied}</dd></div>
          </dl>
          <ol className="mt-6 space-y-3">
            {state.patches?.map((patch) => (
              <li className="rounded-lg border border-slate-200 p-4" key={patch.productId}>
                <div className="font-semibold">{patch.model}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {patch.status} · {patch.characteristicCount} characteristics
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
