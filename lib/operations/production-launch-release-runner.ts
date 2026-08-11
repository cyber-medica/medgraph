import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createProjectBoundSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/client.server";

import {
  assertProductionLaunchManifest,
  PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256,
  PRODUCTION_LAUNCH_RELEASE_OPERATION_KEY,
  type ProductionLaunchReleasePhase,
} from "./production-launch-release-manifest";

const CLOUD_API_HEADERS = {
  "Accept-Profile": "cloud_api",
  "Content-Profile": "cloud_api",
  "Content-Type": "application/json",
} as const;

const SERVICE_PHASE_RPC = Object.freeze({
  import: "production_launch_release_import_v1",
  create_structured_revisions:
    "production_launch_release_create_structured_revisions_v1",
  publish_structured: "production_launch_release_publish_structured_v1",
  create_product_revisions:
    "production_launch_release_create_product_revisions_v1",
  publish_products: "production_launch_release_publish_products_v1",
} as const);

const REVIEW_PHASE_RPC = Object.freeze({
  review_structured: "production_launch_release_review_structured_v1",
  review_products: "production_launch_release_review_products_v1",
} as const);

type ReleaseResult = Readonly<{
  status: "completed" | "already_complete";
  phase: ProductionLaunchReleasePhase;
  operationKey: typeof PRODUCTION_LAUNCH_RELEASE_OPERATION_KEY;
  manifestSha256: typeof PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256;
  count: number;
}>;

export class ProductionLaunchReleaseRunnerError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Production launch release operation failed closed.");
    this.name = "ProductionLaunchReleaseRunnerError";
    this.code = code;
  }
}

function fail(code: string): never {
  throw new ProductionLaunchReleaseRunnerError(code);
}

function readStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid_rpc_result");
  }
  const status = (value as Record<string, unknown>).status;
  if (status !== "completed" && status !== "already_complete") {
    fail("operation_not_complete");
  }
  return status;
}

function resultCount(phase: ProductionLaunchReleasePhase, value: unknown) {
  const record = value as Record<string, unknown>;
  if (phase === "import") return record.products;
  if (phase === "review_structured") return record.approvals;
  if (phase === "review_products") {
    return Array.isArray(record.decisions) ? record.decisions.length : record.decisions;
  }
  if (phase === "publish_products") return record.published;
  const key = phase === "publish_structured" ? "publications" : "revisions";
  return Array.isArray(record[key]) ? record[key].length : null;
}

function assertExactCount(phase: ProductionLaunchReleasePhase, value: unknown) {
  const count = resultCount(phase, value);
  if (count !== 43) fail("operation_count_drift");
  return count;
}

async function callServiceRpc(
  client: SupabaseServerClient,
  rpc: string,
  body: Readonly<Record<string, unknown>>,
) {
  if (client.access !== "service_role") fail("service_role_required");
  const response = await client.request(`/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: CLOUD_API_HEADERS,
    body: JSON.stringify(body),
  });
  return response.json() as Promise<unknown>;
}

async function executeServicePhase(phase: keyof typeof SERVICE_PHASE_RPC) {
  const manifest = assertProductionLaunchManifest();
  const client = createProjectBoundSupabaseServerClient();
  const body = phase === "import"
    ? {
        p_manifest: manifest,
        p_manifest_sha256: PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256,
      }
    : { p_manifest_sha256: PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256 };
  return callServiceRpc(client, SERVICE_PHASE_RPC[phase], body);
}

async function executeReviewPhase(
  phase: keyof typeof REVIEW_PHASE_RPC,
  authenticatedClient: SupabaseClient,
) {
  assertProductionLaunchManifest();
  const { data, error } = await authenticatedClient
    .schema("cloud_api")
    .rpc(REVIEW_PHASE_RPC[phase], {
      p_manifest_sha256: PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256,
    });
  if (error) fail("corporate_review_rpc_failed");
  return data as unknown;
}

export async function executeProductionLaunchReleasePhase(
  phase: ProductionLaunchReleasePhase,
  authenticatedClient: SupabaseClient,
): Promise<ReleaseResult> {
  let value: unknown;
  if (phase in SERVICE_PHASE_RPC) {
    value = await executeServicePhase(phase as keyof typeof SERVICE_PHASE_RPC);
  } else if (phase in REVIEW_PHASE_RPC) {
    value = await executeReviewPhase(
      phase as keyof typeof REVIEW_PHASE_RPC,
      authenticatedClient,
    );
  } else {
    fail("unsupported_phase");
  }
  return {
    status: readStatus(value),
    phase,
    operationKey: PRODUCTION_LAUNCH_RELEASE_OPERATION_KEY,
    manifestSha256: PRODUCTION_LAUNCH_RELEASE_MANIFEST_SHA256,
    count: assertExactCount(phase, value),
  };
}
