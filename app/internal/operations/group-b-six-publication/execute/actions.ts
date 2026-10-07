"use server";

import { hasSupabasePrivilegedCredentialConfiguration } from "@/lib/supabase/env";

import { getTrustedAdmin } from "@/lib/internal-auth/session";
import {
  executeProductionGroupBSixPublication,
  GroupBSixPublicationRunnerError,
} from "@/lib/operations/group-b-six-publication-runner";

export type GroupBSixPublicationActionState = {
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

export async function executeGroupBSixPublicationAction(): Promise<GroupBSixPublicationActionState> {
  if (process.env.VERCEL_ENV !== "production") {
    return { status: "blocked", message: "Operation is Production-only." };
  }
  const user = await getTrustedAdmin();
  if (!user || !productionEnvironmentPresent()) {
    return { status: "blocked", message: "Operation authorization failed closed." };
  }

  try {
    const result = await executeProductionGroupBSixPublication();
    return {
      status: result.status,
      message: result.status === "completed"
        ? "Group B six publication completed and durably verified."
        : "Group B six publication was already complete; no duplicate writes were created.",
      published: result.totals.published,
      approvals: result.totals.approvals,
      publicationBatches: result.totals.publicationBatches,
      remainingReviewedUnpublished: result.remainingReviewedUnpublished,
    };
  } catch (error) {
    const code = error instanceof GroupBSixPublicationRunnerError
      ? error.code
      : "operation_failed";
    return { status: "blocked", message: `Operation failed closed: ${code}.` };
  }
}
