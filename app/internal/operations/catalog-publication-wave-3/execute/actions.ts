"use server";

import { hasSupabasePrivilegedCredentialConfiguration } from "@/lib/supabase/env";

import { getTrustedAdmin } from "@/lib/internal-auth/session";
import {
  CatalogWave3RunnerError,
  executeProductionCatalogWave3,
} from "@/lib/operations/catalog-wave-3-runner";

export type CatalogWave3ActionState = {
  status: "idle" | "completed" | "already_completed" | "blocked";
  message: string;
  published?: number;
  approvals?: number;
  publicationBatches?: number;
  remainingReviewedUnpublished?: number;
};

function productionEnvironmentPresent() {
  return Boolean(
    process.env.CYBERMEDICA_SUPABASE_URL?.trim()
    && process.env.CYBERMEDICA_SUPABASE_PROJECT_REF?.trim()
    && hasSupabasePrivilegedCredentialConfiguration(process.env),
  );
}

export async function executeCatalogWave3Action(): Promise<CatalogWave3ActionState> {
  if (process.env.VERCEL_ENV !== "production") {
    return { status: "blocked", message: "Operation is Production-only." };
  }
  const user = await getTrustedAdmin();
  if (!user || !productionEnvironmentPresent()) {
    return { status: "blocked", message: "Operation authorization failed closed." };
  }

  try {
    const result = await executeProductionCatalogWave3();
    return {
      status: result.status,
      message: result.status === "completed"
        ? "Wave 3 completed and durably verified."
        : "Wave 3 was already complete; no duplicate writes were created.",
      published: result.totals.published,
      approvals: result.totals.approvals,
      publicationBatches: result.totals.publicationBatches,
      remainingReviewedUnpublished: result.remainingReviewedUnpublished,
    };
  } catch (error) {
    const code = error instanceof CatalogWave3RunnerError ? error.code : "operation_failed";
    return { status: "blocked", message: `Operation failed closed: ${code}.` };
  }
}
