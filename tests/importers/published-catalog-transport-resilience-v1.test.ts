import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { PublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import { CloudPublishedCatalogRepositoryError } from "../../lib/storefront/cloud-published-response.ts";
import {
  PublishedCatalogReleaseGateError,
  runPublishedCatalogReleaseGate,
} from "../../lib/storefront/published-catalog-release-gate.ts";
import {
  BUNDLED_PUBLISHED_CATALOG_SNAPSHOT,
  calculateProjectionDocumentChecksum,
  isPublishedCatalogOperationallyCurrent,
  loadResilientPublishedCatalogProjection,
  PUBLISHED_CATALOG_ATTEMPTS,
  PUBLISHED_CATALOG_ATTEMPT_TIMEOUTS_MS,
  PUBLISHED_CATALOG_BACKOFF_MS,
  PUBLISHED_CATALOG_REFRESH_INTERVAL_MS,
  PUBLISHED_CATALOG_SNAPSHOT_MAX_AGE_MS,
  PublishedCatalogRequestPathRefresh,
  readPublishedCatalogHealth,
  type PublishedCatalogHealth,
} from "../../lib/storefront/published-catalog-resilience.ts";

function liveProjection(): PublishedCatalogProjection {
  return structuredClone(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection);
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

const noFrameworkError = () => undefined;

const runtimeStateKey = Symbol.for("cybermedica.publishedCatalogResilience.v1");
const requestPathRefreshKey = Symbol.for(
  "cybermedica.publishedCatalogRequestPathRefresh.v1",
);

test.beforeEach(() => {
  Reflect.deleteProperty(globalThis, runtimeStateKey);
  Reflect.deleteProperty(globalThis, requestPathRefreshKey);
});

test("fresh and stale validated fallbacks stay serveable with explicit health and recovery", async () => {
  const snapshot = BUNDLED_PUBLISHED_CATALOG_SNAPSHOT;
  const capturedAt = Date.parse(snapshot.capturedAt);
  const freshNow = capturedAt + PUBLISHED_CATALOG_SNAPSHOT_MAX_AGE_MS - 1_000;
  const staleNow = capturedAt + PUBLISHED_CATALOG_SNAPSHOT_MAX_AGE_MS + 1_000;
  let now = freshNow;
  let current = snapshot.projection;
  let refreshRuns = 0;
  const coordinator = new PublishedCatalogRequestPathRefresh(() => now);

  const refreshWith = (
    request: () => Promise<Response>,
    refreshNow: number,
  ) => async () => {
    refreshRuns += 1;
    current = await loadResilientPublishedCatalogProjection({
      request,
      rethrowFrameworkError: noFrameworkError,
      delay: async () => undefined,
      random: () => 0.5,
      now: () => refreshNow,
      snapshot,
    });
    return current;
  };

  const freshServed = coordinator.serve(
    current,
    refreshWith(async () => response({}, 503), freshNow),
  );
  assert.equal(freshServed, snapshot.projection);
  await coordinator.waitForRefresh();
  const freshFallback = readPublishedCatalogHealth(freshNow);
  assert.equal(freshFallback.fallbackActive, true);
  assert.equal(freshFallback.snapshotStale, false);
  assert.equal(isPublishedCatalogOperationallyCurrent(freshFallback), false);

  now = staleNow;
  const staleCoordinator = new PublishedCatalogRequestPathRefresh(() => now);
  const checksumBeforeOutage = calculateProjectionDocumentChecksum(current);
  const staleServed = staleCoordinator.serve(
    current,
    refreshWith(async () => response({}, 503), staleNow),
  );
  assert.equal(staleServed, snapshot.projection);
  assert.equal(staleServed.summary.productCount, 114);
  await staleCoordinator.waitForRefresh();
  const staleFallback = readPublishedCatalogHealth(staleNow);
  assert.equal(staleFallback.fallbackActive, true);
  assert.equal(staleFallback.snapshotStale, true);
  assert.equal(isPublishedCatalogOperationallyCurrent(staleFallback), false);
  assert.equal(calculateProjectionDocumentChecksum(current), checksumBeforeOutage);

  const refreshesBeforeIntervalRead = refreshRuns;
  now = staleNow + PUBLISHED_CATALOG_REFRESH_INTERVAL_MS - 1;
  staleCoordinator.serve(current, async () => {
    refreshRuns += 1;
    return current;
  });
  await Promise.resolve();
  assert.equal(refreshRuns, refreshesBeforeIntervalRead);

  const partial = liveProjection();
  partial.products = [];
  partial.summary.productCount = 0;
  now = staleNow + PUBLISHED_CATALOG_REFRESH_INTERVAL_MS;
  staleCoordinator.serve(
    current,
    refreshWith(async () => response(partial), now),
  );
  await staleCoordinator.waitForRefresh();
  assert.equal(calculateProjectionDocumentChecksum(current), checksumBeforeOutage);
  assert.equal(readPublishedCatalogHealth(now).snapshotStale, true);

  const recovered = liveProjection();
  recovered.generatedAt = new Date(
    Date.parse(snapshot.projection.generatedAt) + 1_000,
  ).toISOString();
  recovered.products[0].title = `${recovered.products[0].title} recovered`;
  now += PUBLISHED_CATALOG_REFRESH_INTERVAL_MS;
  const successfulRefreshAt = now;
  staleCoordinator.serve(
    current,
    refreshWith(async () => response(recovered), successfulRefreshAt),
  );
  await staleCoordinator.waitForRefresh();

  const recoveredHealth = readPublishedCatalogHealth(successfulRefreshAt);
  assert.equal(recoveredHealth.liveTransport, "healthy");
  assert.equal(recoveredHealth.fallbackActive, false);
  assert.equal(recoveredHealth.snapshotStale, false);
  assert.equal(
    recoveredHealth.lastSuccessfulRefresh,
    new Date(successfulRefreshAt).toISOString(),
  );
  assert.equal(isPublishedCatalogOperationallyCurrent(recoveredHealth), true);
  assert.match(current.products[0].title, / recovered$/u);

  const publicAfterRecovery = staleCoordinator.serve(current, async () => {
    refreshRuns += 1;
    return current;
  });
  assert.deepEqual(publicAfterRecovery, recovered);
});

test("failed background refresh is handled and future intervals can retry", async (context) => {
  let now = 0;
  let refreshCalls = 0;
  let unhandledRejections = 0;
  const onUnhandledRejection = () => { unhandledRejections += 1; };
  process.on("unhandledRejection", onUnhandledRejection);
  context.after(() => process.off("unhandledRejection", onUnhandledRejection));
  const coordinator = new PublishedCatalogRequestPathRefresh(() => now);
  const failedRefresh = async () => {
    refreshCalls += 1;
    throw new Error("synthetic background refresh failure");
  };

  coordinator.serve(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection, failedRefresh);
  await coordinator.waitForRefresh();
  assert.equal(refreshCalls, 1);
  assert.equal(unhandledRejections, 0);

  coordinator.serve(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection, failedRefresh);
  await Promise.resolve();
  assert.equal(refreshCalls, 1);

  now = PUBLISHED_CATALOG_REFRESH_INTERVAL_MS;
  coordinator.serve(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection, failedRefresh);
  await coordinator.waitForRefresh();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshCalls, 2);
  assert.equal(unhandledRejections, 0);
});

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

test("request path returns the validated 114-product snapshot before a hanging refresh", async () => {
  let refreshCalls = 0;
  let releaseRefresh!: () => void;
  const hangingRefresh = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  const coordinator = new PublishedCatalogRequestPathRefresh(() => 0);

  const projection = coordinator.serve(
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection,
    async () => {
      refreshCalls += 1;
      await hangingRefresh;
      return liveProjection();
    },
  );

  assert.equal(projection.summary.productCount, 114);
  assert.ok(projection.products.some(
    ({ slug }) => slug === "767632362-330695211247-apparat-ivl-hamilton-t1",
  ));
  await Promise.resolve();
  assert.equal(refreshCalls, 1);
  releaseRefresh();
  await coordinator.waitForRefresh();
});

test("repeated outage reads and metadata/page consumers schedule one remote refresh", async () => {
  let refreshCalls = 0;
  let releaseRefresh!: () => void;
  const hangingRefresh = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  const coordinator = new PublishedCatalogRequestPathRefresh(() => 0);
  const refresh = async () => {
    refreshCalls += 1;
    await hangingRefresh;
    return liveProjection();
  };

  const metadataProjection = coordinator.serve(
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection,
    refresh,
  );
  const pageProjection = coordinator.serve(
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection,
    refresh,
  );
  const repeatedProjection = coordinator.serve(
    BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection,
    refresh,
  );

  assert.equal(metadataProjection, pageProjection);
  assert.equal(pageProjection, repeatedProjection);
  await Promise.resolve();
  assert.equal(refreshCalls, 1);
  releaseRefresh();
  await coordinator.waitForRefresh();
});

test("validated recovery becomes current after the refresh interval", async () => {
  let now = 0;
  let current = BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection;
  let refreshCalls = 0;
  const recovered = liveProjection();
  recovered.generatedAt = new Date(
    Date.parse(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection.generatedAt) + 1_000,
  ).toISOString();
  recovered.products[0].title = `${recovered.products[0].title} refreshed`;
  const coordinator = new PublishedCatalogRequestPathRefresh(() => now);

  const first = coordinator.serve(current, async () => {
    refreshCalls += 1;
    current = await loadResilientPublishedCatalogProjection({
      request: async () => response(recovered),
      rethrowFrameworkError: noFrameworkError,
      snapshot: BUNDLED_PUBLISHED_CATALOG_SNAPSHOT,
    });
    return current;
  });
  assert.equal(first, BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.projection);
  await coordinator.waitForRefresh();

  const afterRecovery = coordinator.serve(current, async () => {
    refreshCalls += 1;
    return current;
  });
  assert.deepEqual(afterRecovery, recovered);
  assert.match(afterRecovery.products[0].title, / refreshed$/u);
  assert.equal(refreshCalls, 1);

  now = PUBLISHED_CATALOG_REFRESH_INTERVAL_MS;
  coordinator.serve(current, async () => {
    refreshCalls += 1;
    return current;
  });
  await coordinator.waitForRefresh();
  assert.equal(refreshCalls, 2);
});

test("request path fails closed when no trustworthy snapshot exists", () => {
  let refreshCalls = 0;
  const coordinator = new PublishedCatalogRequestPathRefresh(() => 0);
  assert.throws(
    () => coordinator.serve(null, async () => {
      refreshCalls += 1;
      return liveProjection();
    }),
    CloudPublishedCatalogRepositoryError,
  );
  assert.equal(refreshCalls, 0);
});

test("release gate passes only after a valid authoritative refresh", async () => {
  const now = Date.parse(BUNDLED_PUBLISHED_CATALOG_SNAPSHOT.capturedAt) + 1_000;
  let authoritativeCalls = 0;
  const health = await runPublishedCatalogReleaseGate({
    runAuthoritativeCheck: async () => {
      await loadResilientPublishedCatalogProjection({
        request: async () => {
          authoritativeCalls += 1;
          return response(liveProjection());
        },
        rethrowFrameworkError: noFrameworkError,
        now: () => now,
      });
      return { authoritativeCheckCompleted: true };
    },
    readHealth: () => readPublishedCatalogHealth(now),
  });

  assert.equal(authoritativeCalls, 1);
  assert.equal(health.liveTransport, "healthy");
  assert.equal(health.fallbackActive, false);
  assert.equal(health.snapshotStale, false);
  assert.equal(health.lastSuccessfulRefresh, new Date(now).toISOString());
  assert.equal(isPublishedCatalogOperationallyCurrent(health), true);
});

test("release gate rejects fresh and stale fallbacks while public LKG stays serveable", async () => {
  const snapshot = BUNDLED_PUBLISHED_CATALOG_SNAPSHOT;
  const capturedAt = Date.parse(snapshot.capturedAt);
  const cases = [
    {
      name: "fresh",
      now: capturedAt + PUBLISHED_CATALOG_SNAPSHOT_MAX_AGE_MS - 1_000,
      stale: false,
    },
    {
      name: "stale",
      now: capturedAt + PUBLISHED_CATALOG_SNAPSHOT_MAX_AGE_MS + 1_000,
      stale: true,
    },
  ] as const;

  for (const item of cases) {
    Reflect.deleteProperty(globalThis, runtimeStateKey);
    let publicProjection: PublishedCatalogProjection | undefined;
    await assert.rejects(
      runPublishedCatalogReleaseGate({
        runAuthoritativeCheck: async () => {
          publicProjection = await loadResilientPublishedCatalogProjection({
            request: async () => response({}, 503),
            rethrowFrameworkError: noFrameworkError,
            delay: async () => undefined,
            now: () => item.now,
          });
          return { authoritativeCheckCompleted: true };
        },
        readHealth: () => readPublishedCatalogHealth(item.now),
      }),
      PublishedCatalogReleaseGateError,
      `${item.name} fallback must fail the release gate`,
    );
    assert.deepEqual(publicProjection, snapshot.projection);
    const health = readPublishedCatalogHealth(item.now);
    assert.equal(health.fallbackActive, true);
    assert.equal(health.snapshotStale, item.stale);
    assert.equal(health.lastSuccessfulRefresh, null);
    assert.equal(isPublishedCatalogOperationallyCurrent(health), false);
  }
});

test("invalid, partial and regressed projections fail the gate without replacing LKG", async () => {
  const snapshot = BUNDLED_PUBLISHED_CATALOG_SNAPSHOT;
  const invalid = { invalid: true };
  const partial = liveProjection();
  partial.products = [];
  partial.summary.productCount = 0;
  const regressed = liveProjection();
  regressed.generatedAt = new Date(
    Date.parse(snapshot.projection.generatedAt) - 1_000,
  ).toISOString();

  for (const value of [invalid, partial, regressed]) {
    Reflect.deleteProperty(globalThis, runtimeStateKey);
    let served: PublishedCatalogProjection | undefined;
    await assert.rejects(
      runPublishedCatalogReleaseGate({
        runAuthoritativeCheck: async () => {
          served = await loadResilientPublishedCatalogProjection({
            request: async () => response(value),
            rethrowFrameworkError: noFrameworkError,
            delay: async () => undefined,
          });
          return { authoritativeCheckCompleted: true };
        },
        readHealth: readPublishedCatalogHealth,
      }),
      PublishedCatalogReleaseGateError,
    );
    assert.deepEqual(served, snapshot.projection);
    assert.equal(
      calculateProjectionDocumentChecksum(served!),
      snapshot.projectionDocumentChecksum,
    );
    assert.equal(readPublishedCatalogHealth().fallbackActive, true);
  }
});

test("release gate fails closed without a trustworthy snapshot or an executed check", async () => {
  let authoritativeCalls = 0;
  await assert.rejects(
    runPublishedCatalogReleaseGate({
      runAuthoritativeCheck: async () => {
        await loadResilientPublishedCatalogProjection({
          request: async () => {
            authoritativeCalls += 1;
            return response({}, 503);
          },
          rethrowFrameworkError: noFrameworkError,
          delay: async () => undefined,
          snapshot: null,
        });
        return { authoritativeCheckCompleted: true };
      },
      readHealth: readPublishedCatalogHealth,
    }),
    PublishedCatalogReleaseGateError,
  );
  assert.equal(authoritativeCalls, PUBLISHED_CATALOG_ATTEMPTS);

  const apparentlyCurrent: PublishedCatalogHealth = {
    liveTransport: "healthy",
    source: "live",
    projectionVersion: 1,
    projectionChecksumPrefix: "0".repeat(12),
    lastKnownGoodAgeSeconds: 0,
    snapshotProductCount: 114,
    fallbackActive: false,
    snapshotStale: false,
    lastSuccessfulRefresh: new Date().toISOString(),
    retryCount: 0,
  };
  await assert.rejects(
    runPublishedCatalogReleaseGate({
      runAuthoritativeCheck: async () => ({ authoritativeCheckCompleted: false }),
      readHealth: () => apparentlyCurrent,
    }),
    PublishedCatalogReleaseGateError,
  );
});

test("authoritative recovery records a real refresh and clears the release gate", async () => {
  const snapshot = BUNDLED_PUBLISHED_CATALOG_SNAPSHOT;
  const outageAt = Date.parse(snapshot.capturedAt) + PUBLISHED_CATALOG_SNAPSHOT_MAX_AGE_MS + 1_000;
  await assert.rejects(
    runPublishedCatalogReleaseGate({
      runAuthoritativeCheck: async () => {
        await loadResilientPublishedCatalogProjection({
          request: async () => response({}, 503),
          rethrowFrameworkError: noFrameworkError,
          delay: async () => undefined,
          now: () => outageAt,
        });
        return { authoritativeCheckCompleted: true };
      },
      readHealth: () => readPublishedCatalogHealth(outageAt),
    }),
    PublishedCatalogReleaseGateError,
  );
  const failedHealth = readPublishedCatalogHealth(outageAt);
  assert.equal(failedHealth.lastSuccessfulRefresh, null);
  assert.equal(failedHealth.snapshotStale, true);

  const recovered = liveProjection();
  recovered.generatedAt = new Date(
    Date.parse(snapshot.projection.generatedAt) + 1_000,
  ).toISOString();
  recovered.products[0].title = `${recovered.products[0].title} release recovery`;
  const recoveryAt = outageAt + 1_000;
  const recoveredHealth = await runPublishedCatalogReleaseGate({
    runAuthoritativeCheck: async () => {
      await loadResilientPublishedCatalogProjection({
        request: async () => response(recovered),
        rethrowFrameworkError: noFrameworkError,
        now: () => recoveryAt,
      });
      return { authoritativeCheckCompleted: true };
    },
    readHealth: () => readPublishedCatalogHealth(recoveryAt),
  });

  assert.equal(recoveredHealth.lastSuccessfulRefresh, new Date(recoveryAt).toISOString());
  assert.equal(recoveredHealth.fallbackActive, false);
  assert.equal(recoveredHealth.snapshotStale, false);
  assert.equal(isPublishedCatalogOperationallyCurrent(recoveredHealth), true);
  assert.notEqual(recoveredHealth.lastSuccessfulRefresh, snapshot.capturedAt);
});

test("canonical release verification runs an uncached authoritative check before health evaluation", async () => {
  const [repository, route, canonicalGate] = await Promise.all([
    readFile("lib/storefront/cloud-published-catalog-repository.ts", "utf8"),
    readFile("app/internal/health/catalog/route.ts", "utf8"),
    readFile("scripts/qa/canonical-routing-gate.ts", "utf8"),
  ]);

  assert.match(
    repository,
    /loadCloudPublishedCatalogFresh = requestCloudPublishedCatalogUncached/u,
  );
  assert.match(route, /runAuthoritativeCheck: async \(\) => \{/u);
  assert.ok(
    route.indexOf("await runPublishedCatalogReleaseGate")
      < route.indexOf("const health = readPublishedCatalogHealth"),
  );
  for (const field of [
    "liveTransport",
    "fallbackActive",
    "snapshotStale",
    "operationallyCurrent",
    "lastSuccessfulRefresh",
  ]) assert.match(canonicalGate, new RegExp(`healthValue\\.${field}`, "u"));
});
