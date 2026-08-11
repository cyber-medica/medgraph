import type { Metadata } from "next";
import { connection } from "next/server";

import ProductionLaunchReleaseExecution from "@/components/internal/ProductionLaunchReleaseExecution";
import { requireTrustedReviewer } from "@/lib/internal-auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Production Launch Release",
  robots: { index: false, follow: false },
};

export default async function ProductionLaunchReleaseExecutionPage() {
  await connection();
  await requireTrustedReviewer();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="font-mono text-xs font-semibold uppercase tracking-wide text-teal-700">
        Corporate Production session · exact tracked 43-Product manifest
      </div>
      <h1 className="mt-3 text-3xl font-semibold">Production launch release</h1>
      <p className="mt-4 text-slate-700">
        Последовательный server-only lifecycle exact manifest. Каждый этап
        идемпотентен и доступен только корпоративному администратору.
      </p>
      <ProductionLaunchReleaseExecution />
    </main>
  );
}
