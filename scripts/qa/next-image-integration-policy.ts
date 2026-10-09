export type NextImageTransportClass =
  | "ETIMEDOUT"
  | "ENOTFOUND"
  | "EAI_AGAIN"
  | "ECONNRESET"
  | "ECONNREFUSED"
  | "UND_ERR_CONNECT_TIMEOUT"
  | "UND_ERR_SOCKET";

export type NextImageIntegrationDecision =
  | {
      outcome: "PASS";
      failureClass: null;
      reason: "OPTIMIZER_IMAGE_RESPONSE";
      transportClass: null;
    }
  | {
      outcome: "DEGRADED_EXTERNAL_UPSTREAM";
      failureClass: "REMOTE_MEDIA_UPSTREAM_FAILURE";
      reason: "REMOTE_MEDIA_UPSTREAM_UNAVAILABLE";
      transportClass: NextImageTransportClass;
    }
  | {
      outcome: "HARD_FAIL";
      failureClass: "LOCAL_OPTIMIZER_OR_CONFIG_FAILURE";
      reason:
        | "UNSUPPORTED_MEDIA_HOST"
        | "LOCAL_OPTIMIZER_ROUTE_UNAVAILABLE"
        | "INVALID_OPTIMIZER_RESPONSE"
        | "UNPROVEN_UPSTREAM_FAILURE";
      transportClass: NextImageTransportClass | null;
    };

export type NextImageIntegrationEvidence = {
  approvedSourceHost: boolean;
  routeResponded: boolean;
  status: number | null;
  contentType: string | null;
  serverEvidence: string;
};

const transportPatterns: ReadonlyArray<[
  NextImageTransportClass,
  RegExp,
]> = [
  ["ETIMEDOUT", /\bETIMEDOUT\b/u],
  ["ENOTFOUND", /\bENOTFOUND\b/u],
  ["EAI_AGAIN", /\bEAI_AGAIN\b/u],
  ["ECONNRESET", /\bECONNRESET\b/u],
  ["ECONNREFUSED", /\bECONNREFUSED\b/u],
  ["UND_ERR_CONNECT_TIMEOUT", /\bUND_ERR_CONNECT_TIMEOUT\b/u],
  ["UND_ERR_SOCKET", /\bUND_ERR_SOCKET\b/u],
];

export function nextImageTransportClass(
  serverEvidence: string,
): NextImageTransportClass | null {
  for (const [transportClass, pattern] of transportPatterns) {
    if (pattern.test(serverEvidence)) return transportClass;
  }
  return null;
}

export function classifyNextImageIntegration(
  evidence: NextImageIntegrationEvidence,
): NextImageIntegrationDecision {
  const transportClass = nextImageTransportClass(evidence.serverEvidence);

  if (!evidence.approvedSourceHost) {
    return {
      outcome: "HARD_FAIL",
      failureClass: "LOCAL_OPTIMIZER_OR_CONFIG_FAILURE",
      reason: "UNSUPPORTED_MEDIA_HOST",
      transportClass,
    };
  }

  if (!evidence.routeResponded) {
    return {
      outcome: "HARD_FAIL",
      failureClass: "LOCAL_OPTIMIZER_OR_CONFIG_FAILURE",
      reason: "LOCAL_OPTIMIZER_ROUTE_UNAVAILABLE",
      transportClass,
    };
  }

  if (
    evidence.status === 200
    && /^image\//u.test(evidence.contentType ?? "")
  ) {
    return {
      outcome: "PASS",
      failureClass: null,
      reason: "OPTIMIZER_IMAGE_RESPONSE",
      transportClass: null,
    };
  }

  if (
    evidence.status !== null
    && evidence.status >= 500
    && transportClass !== null
  ) {
    return {
      outcome: "DEGRADED_EXTERNAL_UPSTREAM",
      failureClass: "REMOTE_MEDIA_UPSTREAM_FAILURE",
      reason: "REMOTE_MEDIA_UPSTREAM_UNAVAILABLE",
      transportClass,
    };
  }

  return {
    outcome: "HARD_FAIL",
    failureClass: "LOCAL_OPTIMIZER_OR_CONFIG_FAILURE",
    reason: evidence.status === 200
      ? "INVALID_OPTIMIZER_RESPONSE"
      : "UNPROVEN_UPSTREAM_FAILURE",
    transportClass,
  };
}
