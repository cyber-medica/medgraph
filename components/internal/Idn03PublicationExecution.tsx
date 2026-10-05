"use client";

import { useState } from "react";

const OPERATION_KEY = "idn-03-publication-v1";
const MANIFEST_SHA256 =
  "ddac576c6a5b5d9322e15d9f109d91120ca5bf3145de1b6a6a4afd4d8a20e4c2";

type OperationState = {
  status: "idle" | "pending" | "completed" | "already_complete" | "blocked";
  message: string;
  approvalId?: string;
  publicationBatchId?: string;
  productUrl?: string;
};

export default function Idn03PublicationExecution() {
  const [state, setState] = useState<OperationState>({ status: "idle", message: "" });
  const finished = state.status === "completed" || state.status === "already_complete";

  async function execute() {
    setState({ status: "pending", message: "Выполняется fail-closed Production preflight…" });
    try {
      const response = await fetch("/internal/operations/idn-03-publication", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationKey: OPERATION_KEY, manifestSha256: MANIFEST_SHA256 }),
      });
      const result = await response.json() as {
        status?: unknown;
        code?: unknown;
        approvalId?: unknown;
        publicationBatchId?: unknown;
        productUrl?: unknown;
        totals?: { published?: unknown };
      };
      if (
        response.ok
        && (result.status === "completed" || result.status === "already_complete")
        && typeof result.approvalId === "string"
        && typeof result.publicationBatchId === "string"
        && typeof result.productUrl === "string"
        && result.totals?.published === 71
      ) {
        setState({
          status: result.status,
          message: result.status === "completed"
            ? "Approval и Publication ИДН-03 завершены и replay-проверены."
            : "Операция уже завершена; duplicate lifecycle writes не созданы.",
          approvalId: result.approvalId,
          publicationBatchId: result.publicationBatchId,
          productUrl: result.productUrl,
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
        {state.status === "pending" ? "Проверка и публикация…" : "Опубликовать exact ИДН-03"}
      </button>
      {state.message ? <p className="mt-4" role="status">{state.message}</p> : null}
      {finished ? (
        <dl className="mt-4 grid gap-2">
          <div><dt>Approval ID</dt><dd>{state.approvalId}</dd></div>
          <div><dt>Publication Batch ID</dt><dd>{state.publicationBatchId}</dd></div>
          <div><dt>Product URL</dt><dd>{state.productUrl}</dd></div>
        </dl>
      ) : null}
    </section>
  );
}
