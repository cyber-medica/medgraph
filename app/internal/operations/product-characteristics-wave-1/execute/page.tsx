import type { Metadata } from "next";
import { connection } from "next/server";

import ProductCharacteristicsWave1Execution from "@/components/internal/ProductCharacteristicsWave1Execution";
import { requireTrustedReviewer } from "@/lib/internal-auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Characteristics Wave 1 Controlled Patches",
  robots: { index: false, follow: false },
};

export default async function ProductCharacteristicsWave1ExecutionPage() {
  await connection();
  await requireTrustedReviewer();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="font-mono text-xs font-semibold uppercase tracking-wide text-teal-700">
        Corporate Production session · exact 15-Product manifest
      </div>
      <h1 className="mt-3 text-3xl font-semibold">Characteristics Wave 1 patches</h1>
      <p className="mt-4 text-slate-700">
        Server-only операция создаёт только deterministic authoring drafts.
        Revisions, Decisions, Approvals, Publications и текущая public projection не меняются.
      </p>
      <ProductCharacteristicsWave1Execution />
    </main>
  );
}
