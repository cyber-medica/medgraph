export const ATTRIBUTION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const ATTRIBUTION_STORAGE_KEY = "cybermedica_attribution_v1";

export const ATTRIBUTION_PARAMETER_NAMES = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "yclid",
] as const;

export type AttributionParameterName = typeof ATTRIBUTION_PARAMETER_NAMES[number];

export interface AttributionTouch extends Partial<Record<AttributionParameterName, string>> {
  capturedAt: string;
  initialReferrer: string;
  landingPath: string;
}

export interface AttributionEnvelope {
  expiresAt: string;
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
}

const MAX_VALUE_LENGTH = 240;

function normalizeValue(value: unknown, limit = MAX_VALUE_LENGTH) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, limit);
  return normalized || undefined;
}

function normalizePath(value: unknown) {
  const normalized = normalizeValue(value, 500);
  if (!normalized?.startsWith("/")) return "/";
  return normalized;
}

function normalizeReferrer(value: unknown) {
  const normalized = normalizeValue(value, 500);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return "";
  }
}

function normalizeTimestamp(value: unknown) {
  const normalized = normalizeValue(value, 40);
  if (!normalized) return undefined;
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

export function buildAttributionTouch(
  url: URL,
  referrer: string,
  capturedAt = new Date(),
): AttributionTouch {
  const touch: AttributionTouch = {
    capturedAt: capturedAt.toISOString(),
    initialReferrer: normalizeReferrer(referrer),
    landingPath: `${url.pathname}${url.search}`.slice(0, 500),
  };

  for (const name of ATTRIBUTION_PARAMETER_NAMES) {
    const value = normalizeValue(url.searchParams.get(name));
    if (value) touch[name] = value;
  }

  return touch;
}

export function hasCampaignAttribution(touch: AttributionTouch) {
  return ATTRIBUTION_PARAMETER_NAMES.some((name) => Boolean(touch[name]));
}

export function mergeAttribution(
  current: AttributionEnvelope | null,
  touch: AttributionTouch,
  now = new Date(),
): AttributionEnvelope {
  const currentIsValid = current && Date.parse(current.expiresAt) > now.getTime();
  const firstTouch = currentIsValid ? current.firstTouch : touch;
  const lastTouch = !currentIsValid || hasCampaignAttribution(touch)
    ? touch
    : current.lastTouch;

  return {
    expiresAt: new Date(now.getTime() + ATTRIBUTION_RETENTION_MS).toISOString(),
    firstTouch,
    lastTouch,
  };
}

export function parseAttributionEnvelope(value: unknown): AttributionEnvelope | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const candidate = parsed as Record<string, unknown>;
  const firstTouch = parseAttributionTouch(candidate.firstTouch);
  const lastTouch = parseAttributionTouch(candidate.lastTouch);
  const expiresAt = normalizeTimestamp(candidate.expiresAt);
  if (!firstTouch || !lastTouch || !expiresAt || Date.parse(expiresAt) <= Date.now()) return null;
  return { expiresAt, firstTouch, lastTouch };
}

function parseAttributionTouch(value: unknown): AttributionTouch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const capturedAt = normalizeTimestamp(candidate.capturedAt);
  if (!capturedAt) return null;
  const touch: AttributionTouch = {
    capturedAt,
    initialReferrer: normalizeReferrer(candidate.initialReferrer),
    landingPath: normalizePath(candidate.landingPath),
  };
  for (const name of ATTRIBUTION_PARAMETER_NAMES) {
    const normalized = normalizeValue(candidate[name]);
    if (normalized) touch[name] = normalized;
  }
  return touch;
}

export function flattenAttribution(envelope: AttributionEnvelope | null) {
  if (!envelope) return {};
  const lastTouch = envelope.lastTouch;
  return {
    landingPath: envelope.firstTouch.landingPath,
    initialReferrer: envelope.firstTouch.initialReferrer,
    ...Object.fromEntries(
      ATTRIBUTION_PARAMETER_NAMES.flatMap((name) =>
        lastTouch[name] ? [[name, lastTouch[name]]] : [],
      ),
    ),
    firstTouch: envelope.firstTouch,
    lastTouch: envelope.lastTouch,
  };
}
