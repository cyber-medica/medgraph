import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import contract from "../../data/analytics/source/cybermedica_r9_attribution_conversion_contract.json" with { type: "json" };
import {
  ATTRIBUTION_PARAMETER_NAMES,
  ATTRIBUTION_RETENTION_MS,
  buildAttributionTouch,
  flattenAttribution,
  mergeAttribution,
  parseAttributionEnvelope,
} from "../../lib/analytics/attribution.ts";
import { RFQ_EVENT_NAMES } from "../../lib/analytics/events.ts";
import {
  PRODUCTION_YANDEX_METRICA_COUNTER_ID,
  readApprovedMetricaCounterId,
} from "../../lib/analytics/metrica.ts";

test("R9 implementation is bound to the authoritative conversion contract", () => {
  assert.equal(contract.primary_conversion, "rfq_success");
  assert.equal(contract.rfq_success_fire_condition, "POST /api/request successful and requestId returned");
  assert.deepEqual(
    RFQ_EVENT_NAMES,
    contract.events.map(([name]) => name),
  );
  assert.deepEqual(ATTRIBUTION_PARAMETER_NAMES, [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "yclid",
  ]);
  assert.equal(ATTRIBUTION_RETENTION_MS, 30 * 24 * 60 * 60 * 1000);
});

test("R9 stores first and last touch for 30 days without referrer query leakage", () => {
  const start = new Date("2026-08-01T10:00:00.000Z");
  const first = buildAttributionTouch(
    new URL("https://cyber-medica.ru/catalog?utm_source=yandex-direct&utm_medium=cpc&yclid=one"),
    "https://yandex.ru/search/?text=confidential",
    start,
  );
  const initial = mergeAttribution(null, first, start);
  const secondTime = new Date("2026-08-03T10:00:00.000Z");
  const second = buildAttributionTouch(
    new URL("https://cyber-medica.ru/catalog/model?utm_campaign=42_endoscopy&utm_content=7_a"),
    "https://example.org/path?private=value",
    secondTime,
  );
  const merged = mergeAttribution(initial, second, secondTime);

  assert.equal(merged.firstTouch.utm_source, "yandex-direct");
  assert.equal(merged.firstTouch.initialReferrer, "https://yandex.ru/search/");
  assert.equal(merged.lastTouch.utm_campaign, "42_endoscopy");
  assert.equal(merged.lastTouch.initialReferrer, "https://example.org/path");
  assert.equal(
    Date.parse(merged.expiresAt) - secondTime.getTime(),
    ATTRIBUTION_RETENTION_MS,
  );
});

test("R9 rejects expired or malformed client attribution and emits only non-PII fields", () => {
  assert.equal(parseAttributionEnvelope("not-json"), null);
  assert.equal(parseAttributionEnvelope({ expiresAt: "2020-01-01T00:00:00Z" }), null);

  const now = new Date();
  const touch = buildAttributionTouch(
    new URL("https://cyber-medica.ru/request?utm_term=endoscope&yclid=abc"),
    "",
    now,
  );
  const flattened = flattenAttribution(mergeAttribution(null, touch, now));
  assert.deepEqual(
    Object.keys(flattened).sort(),
    ["firstTouch", "initialReferrer", "landingPath", "lastTouch", "utm_term", "yclid"].sort(),
  );
  assert.equal("email" in flattened, false);
  assert.equal("phone" in flattened, false);
  assert.equal("name" in flattened, false);
});

test("rfq_success is fail-closed behind backend acceptance and a valid requestId", async () => {
  const form = await readFile("components/request/RequestForm.tsx", "utf8");
  const backendGuard = form.indexOf("if (!response.ok || !result.ok)");
  const requestIdGuard = form.indexOf("if (!result.requestId || !/^[0-9a-f]");
  const success = form.indexOf('trackRfqEvent("rfq_success"');

  assert.ok(backendGuard >= 0);
  assert.ok(requestIdGuard > backendGuard);
  assert.ok(success > requestIdGuard);
  assert.match(form, /requestId: result\.requestId/u);
  assert.doesNotMatch(form.slice(0, backendGuard), /trackRfqEvent\("rfq_success"/u);
});

test("R9 product-aware payload and Metrica integration remain narrow and configurable", async () => {
  const [route, runtime, tracker, productPage] = await Promise.all([
    readFile("app/api/request/route.ts", "utf8"),
    readFile("components/analytics/AttributionRuntime.tsx", "utf8"),
    readFile("components/analytics/ProductViewTracker.tsx", "utf8"),
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
  ]);

  assert.match(route, /productModel: productContext\.model/u);
  assert.match(route, /productManufacturer: productContext\.manufacturer/u);
  assert.match(route, /flattenAttribution\(attribution\)/u);
  assert.match(runtime, /readApprovedMetricaCounterId/u);
  assert.match(runtime, /window\.location\.hostname !== "cyber-medica\.ru"/u);
  assert.doesNotMatch(runtime, /NEXT_PUBLIC_YANDEX_METRICA_ID\s*\?\?\s*["']?\d/u);
  assert.match(tracker, /trackRfqEvent\("product_view"/u);
  assert.match(productPage, /<ProductViewTracker/u);
});

test("Production Metrica is fail-closed to the one authorized counter", async () => {
  assert.equal(PRODUCTION_YANDEX_METRICA_COUNTER_ID, "98376495");
  assert.equal(readApprovedMetricaCounterId("98376495"), 98376495);
  assert.equal(readApprovedMetricaCounterId(" 98376495 "), 98376495);
  assert.equal(readApprovedMetricaCounterId(undefined), null);
  assert.equal(readApprovedMetricaCounterId("12345678"), null);

  const [runtime, events, config] = await Promise.all([
    readFile("components/analytics/AttributionRuntime.tsx", "utf8"),
    readFile("lib/analytics/events.ts", "utf8"),
    readFile("next.config.ts", "utf8"),
  ]);
  assert.match(runtime, /readApprovedMetricaCounterId/u);
  assert.match(events, /readApprovedMetricaCounterId/u);
  assert.match(config, /script-src[^\n]+https:\/\/mc\.yandex\.ru[^\n]+https:\/\/yastatic\.net/u);
  assert.match(config, /script-src[^\n]+https:\/\/mc\.yandex\.com/u);
  assert.match(config, /img-src[^\n]+https:\/\/mc\.yandex\.com/u);
  assert.match(config, /connect-src[^\n]+https:\/\/mc\.yandex\.ru/u);
  assert.match(config, /connect-src[^\n]+https:\/\/mc\.yandex\.com/u);
  assert.match(config, /connect-src[^\n]+wss:\/\/mc\.yandex\.ru/u);
  assert.match(config, /connect-src[^\n]+wss:\/\/mc\.yandex\.com/u);
  assert.match(config, /frame-src https:\/\/mc\.yandex\.ru https:\/\/mc\.yandex\.com/u);
});
