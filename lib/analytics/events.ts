import {
  ATTRIBUTION_STORAGE_KEY,
  buildAttributionTouch,
  mergeAttribution,
  parseAttributionEnvelope,
  type AttributionEnvelope,
} from "./attribution.ts";
import { readApprovedMetricaCounterId } from "./metrica.ts";

export const RFQ_EVENT_NAMES = [
  "product_view",
  "rfq_cta_click",
  "rfq_form_view",
  "rfq_form_start",
  "rfq_submit_attempt",
  "rfq_success",
  "rfq_error",
] as const;

export type RfqEventName = typeof RFQ_EVENT_NAMES[number];

const EVENT_PARAMETER_NAMES = new Set([
  "errorClass",
  "httpStatus",
  "productId",
  "productSlug",
  "productModel",
  "productManufacturer",
  "requestId",
  "sourcePage",
]);

declare global {
  interface Window {
    ym?: ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
  }
}

export function captureBrowserAttribution() {
  if (typeof window === "undefined") return null;
  const current = readBrowserAttribution();
  const next = mergeAttribution(
    current,
    buildAttributionTouch(new URL(window.location.href), document.referrer),
  );
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export function readBrowserAttribution(): AttributionEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    return parseAttributionEnvelope(window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function trackRfqEvent(
  event: RfqEventName,
  parameters: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  const safeParameters = Object.fromEntries(
    Object.entries(parameters).flatMap(([key, value]) => {
      if (!EVENT_PARAMETER_NAMES.has(key)) return [];
      if (typeof value !== "string" && typeof value !== "number") return [];
      return [[key, typeof value === "string" ? value.slice(0, 240) : value]];
    }),
  );
  window.dispatchEvent(new CustomEvent("cybermedica:analytics", {
    detail: { event, parameters: safeParameters },
  }));

  const counterId = readApprovedMetricaCounterId();
  if (counterId === null || typeof window.ym !== "function") return;
  window.ym(counterId, "reachGoal", event, safeParameters);
}
