import assert from "node:assert/strict";
import test from "node:test";

import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import {
  BUNDLED_PUBLISHED_CATALOG_SNAPSHOT,
  calculateProjectionDocumentChecksum,
  loadResilientPublishedCatalogProjection,
  PUBLISHED_CATALOG_ATTEMPTS,
  PUBLISHED_CATALOG_ATTEMPT_TIMEOUTS_MS,
  PUBLISHED_CATALOG_BACKOFF_MS,
  readPublishedCatalogHealth,
} from "../../lib/storefront/published-catalog-resilience.ts";

function liveProjection(): PublishedCatalogProjection {
  return structuredClone(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection);
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

const noFrameworkError = () => undefined;

test("first transient failure retries once and returns live catalog", async () => {
  let calls = 0;
  const delays: number[] = [];
  const timeouts: number[] = [];
  const projection = await loadResilientPublishedCatalogProjection({
    request: async (_attempt, timeoutMs) => {
      timeouts.push(timeoutMs);
      calls += 1;
      return calls === 1 ? response({}, 503) : response(liveProjection());
    },
    rethrowFrameworkError: noFrameworkError,
    delay: async (value) => { delays.push(value); },
    random: () => 0.5,
  });
  assert.equal(calls, 2);
  assert.deepEqual(timeouts, [...PUBLISHED_CATALOG_ATTEMPT_TIMEOUTS_MS]);
  assert.deepEqual(delays, [250]);
  assert.equal(
    projection.summary.productCount,
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection.summary.productCount,
  );
  assert.equal(
    readPublishedCatalogHealth().projectionChecksumPrefix,
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projectionChecksum.slice(0, 12),
  );
  assert.notEqual(
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projectionChecksum,
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projectionDocumentChecksum,
  );
});

test("live-first retry policy remains bounded below the public route budget", () => {
  assert.deepEqual(PUBLISHED_CATALOG_ATTEMPT_TIMEOUTS_MS, [8_000, 2_500]);
  assert.equal(PUBLISHED_CATALOG_ATTEMPTS, 2);
  assert.ok(
    PUBLISHED_CATALOG_ATTEMPT_TIMEOUTS_MS.reduce((sum, value) => sum + value, 0)
      + PUBLISHED_CATALOG_BACKOFF_MS.reduce((sum, value) => sum + value, 0)
      < 12_000,
  );
});

test("bundled last-known-good seed is complete and checksum-valid", () => {
  assert.ok(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection.products.length >= 114);
  assert.equal(
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection.summary.productCount,
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection.products.length,
  );
  assert.equal(
    calculateProjectionDocumentChecksum(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection),
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projectionDocumentChecksum,
  );
});

test("exhausted transient transport uses validated last-known-good", async () => {
  let calls = 0;
  const projection = await loadResilientPublishedCatalogProjection({
    request: async () => { calls += 1; return response({}, 503); },
    rethrowFrameworkError: noFrameworkError,
    delay: async () => undefined,
    random: () => 0.5,
  });
  assert.equal(calls, PUBLISHED_CATALOG_ATTEMPTS);
  assert.deepEqual(projection, BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection);
});

test("empty, malformed and regressed responses never replace the snapshot", async () => {
  const empty = liveProjection();
  empty.products = [];
  empty.summary.productCount = 0;
  for (const value of [empty, { invalid: true }]) {
    const projection = await loadResilientPublishedCatalogProjection({
      request: async () => response(value),
      rethrowFrameworkError: noFrameworkError,
      delay: async () => undefined,
    });
    assert.deepEqual(projection, BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection);
  }
});

test("same-version checksum mismatch is rejected in favor of LKG", async () => {
  const changed = liveProjection();
  changed.products[0].title = "Unexpected partial rewrite";
  assert.notEqual(
    calculateProjectionDocumentChecksum(changed),
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projectionDocumentChecksum,
  );
  const projection = await loadResilientPublishedCatalogProjection({
    request: async () => response(changed),
    rethrowFrameworkError: noFrameworkError,
    delay: async () => undefined,
  });
  assert.deepEqual(projection, BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection);
});

test("without any valid snapshot the route receives a controlled error", async () => {
  await assert.rejects(() => loadResilientPublishedCatalogProjection({
    request: async () => response({}, 503),
    rethrowFrameworkError: noFrameworkError,
    delay: async () => undefined,
    snapshot: null,
  }));
});

test("non-transient auth rejection is not retried and falls back safely", async () => {
  let calls = 0;
  const projection = await loadResilientPublishedCatalogProjection({
    request: async () => { calls += 1; return response({}, 401); },
    rethrowFrameworkError: noFrameworkError,
    delay: async () => undefined,
  });
  assert.equal(calls, 1);
  assert.deepEqual(projection, BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection);
});
