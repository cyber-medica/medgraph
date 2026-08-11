import { createHash, randomUUID } from "node:crypto";

import bundledSnapshotJson from "../../data/published-catalog-last-known-good.json" with { type: "json" };
import {
  parsePublishedCatalogProjection,
  type PublishedCatalogProjection,
} from "../published-catalog/contracts.ts";

import {
  CloudPublishedCatalogRepositoryError,
  loadValidatedPublishedCatalogProjection,
} from "./cloud-published-response.ts";

export const PUBLISHED_CATALOG_ATTEMPT_TIMEOUTS_MS = [8_000, 2_500] as const;
export const PUBLISHED_CATALOG_ATTEMPTS = PUBLISHED_CATALOG_ATTEMPT_TIMEOUTS_MS.length;
export const PUBLISHED_CATALOG_BACKOFF_MS = [250] as const;
export const PUBLISHED_CATALOG_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

type SnapshotEnvelope = Readonly<{
  schemaVersion: 1;
  projectionVersion: number;
  projectionChecksum: string;
  projectionDocumentChecksum: string;
  capturedAt: string;
  projection: PublishedCatalogProjection;
}>;

export type PublishedCatalogSource = "live" | "retry" | "last_known_good";
export type PublishedCatalogHealth = Readonly<{
  liveTransport: "healthy" | "degraded" | "unavailable";
  source: PublishedCatalogSource;
  projectionVersion: number;
  projectionChecksumPrefix: string;
  lastKnownGoodAgeSeconds: number;
  snapshotProductCount: number;
  fallbackActive: boolean;
  lastSuccessfulRefresh: string | null;
  retryCount: number;
}>;

type RuntimeState = {
  snapshot: SnapshotEnvelope;
  health: PublishedCatalogHealth;
};

const checksumPattern = /^[a-f0-9]{64}$/u;
const runtimeStateKey = Symbol.for("cybermedica.publishedCatalogResilience.v1");

function parseSnapshot(value: unknown): SnapshotEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CloudPublishedCatalogRepositoryError("configuration");
  }
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== 1
    || !Number.isSafeInteger(record.projectionVersion)
    || (record.projectionVersion as number) < 1
    || typeof record.projectionChecksum !== "string"
    || !checksumPattern.test(record.projectionChecksum)
    || typeof record.projectionDocumentChecksum !== "string"
    || !checksumPattern.test(record.projectionDocumentChecksum)
    || typeof record.capturedAt !== "string"
    || !Number.isFinite(Date.parse(record.capturedAt))
  ) throw new CloudPublishedCatalogRepositoryError("configuration");
  const projection = parsePublishedCatalogProjection(record.projection);
  if (projection.products.length === 0) {
    throw new CloudPublishedCatalogRepositoryError("configuration");
  }
  return Object.freeze({
    schemaVersion: 1,
    projectionVersion: record.projectionVersion as number,
    projectionChecksum: record.projectionChecksum,
    projectionDocumentChecksum: record.projectionDocumentChecksum,
    capturedAt: record.capturedAt,
    projection,
  });
}

export const BUNDLED_PUBLISHED_CATALOG_SNAPSHOT = parseSnapshot(bundledSnapshotJson);

function initialHealth(snapshot: SnapshotEnvelope): PublishedCatalogHealth {
  return {
    liveTransport: "degraded",
    source: "last_known_good",
    projectionVersion: snapshot.projectionVersion,
    projectionChecksumPrefix: snapshot.projectionChecksum.slice(0, 12),
    lastKnownGoodAgeSeconds: snapshotAgeSeconds(snapshot),
    snapshotProductCount: snapshot.projection.products.length,
    fallbackActive: true,
    lastSuccessfulRefresh: null,
    retryCount: 0,
  };
}

function state(): RuntimeState {
  const globalState = globalThis as typeof globalThis & { [runtimeStateKey]?: RuntimeState };
  globalState[runtimeStateKey] ??= {
    snapshot: BUNDLED_PUBLISHED_CATALOG_SNAPSHOT,
    health: initialHealth(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT),
  };
  return globalState[runtimeStateKey];
}

function snapshotAgeSeconds(snapshot: SnapshotEnvelope, now = Date.now()) {
  return Math.max(0, Math.floor((now - Date.parse(snapshot.capturedAt)) / 1_000));
}

function logCatalogRead(input: Readonly<{
  source: PublishedCatalogSource;
  durationMs: number;
  retryCount: number;
  productCount: number;
  errorClass: string | null;
  correlationId: string;
}>) {
  console.info(JSON.stringify({
    event: "published_catalog_read",
    route: "public_catalog",
    source: input.source,
    durationMs: input.durationMs,
    retryCount: input.retryCount,
    projectionVersion: state().snapshot.projectionVersion,
    productCount: input.productCount,
    errorClass: input.errorClass,
    correlationId: input.correlationId,
  }));
}

function validateCompleteLiveProjection(
  projection: PublishedCatalogProjection,
  snapshot: SnapshotEnvelope,
) {
  const documentChecksum = calculateProjectionDocumentChecksum(projection);
  if (
    projection.products.length === 0
    || projection.summary.productCount !== projection.products.length
    || projection.products.length < snapshot.projection.products.length
    || Date.parse(projection.generatedAt) < Date.parse(snapshot.projection.generatedAt)
    || (
      projection.generatedAt === snapshot.projection.generatedAt
      && documentChecksum !== snapshot.projectionDocumentChecksum
    )
  ) throw new CloudPublishedCatalogRepositoryError("invalid_payload");
  return { projection, documentChecksum };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function calculateProjectionDocumentChecksum(projection: PublishedCatalogProjection) {
  return createHash("sha256")
    .update(canonicalJson({ ...projection, generatedAt: undefined }))
    .digest("hex");
}

function shouldRetry(error: unknown) {
  return error instanceof CloudPublishedCatalogRepositoryError
    && error.code === "transport";
}

async function defaultDelay(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function loadResilientPublishedCatalogProjection(input: Readonly<{
  request: (attempt: number, timeoutMs: number) => Promise<Response>;
  rethrowFrameworkError: (error: unknown) => void;
  delay?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  snapshot?: SnapshotEnvelope | null;
}>): Promise<PublishedCatalogProjection> {
  const startedAt = (input.now ?? Date.now)();
  const correlationId = randomUUID();
  const delay = input.delay ?? defaultDelay;
  const random = input.random ?? Math.random;
  const runtime = state();
  const snapshot = input.snapshot === undefined ? runtime.snapshot : input.snapshot;
  let finalError: unknown;

  for (let attempt = 0; attempt < PUBLISHED_CATALOG_ATTEMPTS; attempt += 1) {
    try {
      const liveBaseline = snapshot ?? BUNDLED_PUBLISHED_CATALOG_SNAPSHOT;
      const validated = validateCompleteLiveProjection(
        await loadValidatedPublishedCatalogProjection(
          () => input.request(
            attempt,
            PUBLISHED_CATALOG_ATTEMPT_TIMEOUTS_MS[attempt]
              ?? PUBLISHED_CATALOG_ATTEMPT_TIMEOUTS_MS.at(-1)!,
          ),
          { rethrowFrameworkError: input.rethrowFrameworkError },
        ),
        liveBaseline,
      );
      const { projection, documentChecksum } = validated;
      const source: PublishedCatalogSource = attempt === 0 ? "live" : "retry";
      runtime.snapshot = {
        ...liveBaseline,
        capturedAt: new Date((input.now ?? Date.now)()).toISOString(),
        projectionDocumentChecksum: documentChecksum,
        projection,
      };
      runtime.health = {
        liveTransport: "healthy",
        source,
        projectionVersion: runtime.snapshot.projectionVersion,
        projectionChecksumPrefix: runtime.snapshot.projectionChecksum.slice(0, 12),
        lastKnownGoodAgeSeconds: 0,
        snapshotProductCount: projection.products.length,
        fallbackActive: false,
        lastSuccessfulRefresh: runtime.snapshot.capturedAt,
        retryCount: attempt,
      };
      logCatalogRead({
        source,
        durationMs: (input.now ?? Date.now)() - startedAt,
        retryCount: attempt,
        productCount: projection.products.length,
        errorClass: null,
        correlationId,
      });
      return projection;
    } catch (error) {
      input.rethrowFrameworkError(error);
      finalError = error;
      if (!shouldRetry(error) || attempt === PUBLISHED_CATALOG_ATTEMPTS - 1) break;
      const base = PUBLISHED_CATALOG_BACKOFF_MS[attempt] ?? 250;
      await delay(Math.round(base * (0.8 + random() * 0.4)));
    }
  }

  if (!snapshot) {
    if (finalError instanceof Error) throw finalError;
    throw new CloudPublishedCatalogRepositoryError("transport");
  }
  runtime.health = {
    liveTransport: shouldRetry(finalError) ? "unavailable" : "degraded",
    source: "last_known_good",
    projectionVersion: snapshot.projectionVersion,
    projectionChecksumPrefix: snapshot.projectionChecksum.slice(0, 12),
    lastKnownGoodAgeSeconds: snapshotAgeSeconds(snapshot, (input.now ?? Date.now)()),
    snapshotProductCount: snapshot.projection.products.length,
    fallbackActive: true,
    lastSuccessfulRefresh: runtime.health.lastSuccessfulRefresh,
    retryCount: shouldRetry(finalError) ? PUBLISHED_CATALOG_ATTEMPTS - 1 : 0,
  };
  logCatalogRead({
    source: "last_known_good",
    durationMs: (input.now ?? Date.now)() - startedAt,
    retryCount: runtime.health.retryCount,
    productCount: snapshot.projection.products.length,
    errorClass: finalError instanceof CloudPublishedCatalogRepositoryError
      ? finalError.code
      : "unknown",
    correlationId,
  });
  return snapshot.projection;
}

export function readPublishedCatalogHealth(): PublishedCatalogHealth {
  const runtime = state();
  return {
    ...runtime.health,
    lastKnownGoodAgeSeconds: snapshotAgeSeconds(runtime.snapshot),
    snapshotProductCount: runtime.snapshot.projection.products.length,
  };
}

export function isPublishedCatalogSnapshotStale() {
  return readPublishedCatalogHealth().lastKnownGoodAgeSeconds
    > PUBLISHED_CATALOG_SNAPSHOT_MAX_AGE_MS / 1_000;
}
