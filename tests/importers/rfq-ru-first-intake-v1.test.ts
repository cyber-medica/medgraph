import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { sanitizeRfqEventParameters } from "../../lib/analytics/events.ts";
import type { RequestProductContext } from "../../lib/request/product-context.ts";
import { readRfqIntakeConfig } from "../../services/rfq-intake/config.ts";
import {
  buildRfqEmail,
  DeliveryError,
  smtpMessageId,
  YandexSmtpDeliveryClient,
} from "../../services/rfq-intake/delivery.ts";
import { handleRfqIntake } from "../../services/rfq-intake/intake.ts";
import { SnapshotProductContextResolver } from "../../services/rfq-intake/product-catalog.ts";
import { HashedRateLimiter } from "../../services/rfq-intake/rate-limit.ts";
import type {
  DeliveryClaim,
  NewRfqLead,
  PersistedRfqLead,
  RfqDeliveryClient,
  RfqRepository,
  SafeLogger,
  YandexSmtpConfig,
} from "../../services/rfq-intake/types.ts";
import { runDeliveryCycle } from "../../services/rfq-intake/worker.ts";

const PRODUCT: RequestProductContext = {
  id: "product-hamilton-t1",
  slug: "apparat-ivl-hamilton-t1",
  title: "Аппарат ИВЛ HAMILTON-T1",
  model: "HAMILTON-T1",
  manufacturer: "Hamilton Medical",
};

const NOW = new Date("2026-09-16T12:00:00.000Z");
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const NOOP_LOGGER: SafeLogger = { info() {}, error() {} };
const SMTP_CONFIG: YandexSmtpConfig = {
  host: "smtp.yandex.ru",
  port: 465,
  secure: true,
  user: "rfq@example.test",
  password: "test-only-password",
  from: "rfq@example.test",
  to: "qa@example.test",
  replyTo: null,
};

function validForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const fields = {
    company: "PRE-CUTOVER TEST — НЕ ОБРАБАТЫВАТЬ",
    name: "Тестовый пользователь",
    phone: "+7 900 000-00-00",
    email: "test@example.invalid",
    message: "Тест локальной первичной записи",
    personalDataConsent: "accepted",
    sourcePage: "/request",
    ...overrides,
  };
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

function dependencies(repository: Pick<RfqRepository, "insertLead">, rateLimiter?: HashedRateLimiter) {
  return {
    repository,
    productResolver: {
      async resolve(selection: { id: string | null; slug: string | null }) {
        return selection.id === PRODUCT.id && selection.slug === PRODUCT.slug ? PRODUCT : null;
      },
    },
    rateLimiter: rateLimiter ?? new HashedRateLimiter("x".repeat(32)),
    now: () => NOW,
    createRequestId: () => REQUEST_ID,
  };
}

class MemoryRepository implements RfqRepository {
  leads = new Map<string, PersistedRfqLead>();
  order: string[] = [];

  async insertLead(lead: NewRfqLead) {
    const persisted: PersistedRfqLead = {
      ...lead,
      deliveryStatus: "pending",
      deliveryAttempts: 0,
      lastDeliveryError: null,
    };
    this.leads.set(lead.id, persisted);
    this.order.push("commit");
    return persisted;
  }

  async claimNextDelivery(input: {
    lockToken: string;
    now: Date;
    leaseSeconds: number;
    maxAttempts: number;
  }) {
    const lead = [...this.leads.values()].find(
      (candidate) => candidate.deliveryStatus !== "delivered"
        && candidate.deliveryAttempts < input.maxAttempts,
    );
    if (!lead) return null;
    lead.deliveryAttempts += 1;
    return { ...lead, deliveryLockToken: input.lockToken } satisfies DeliveryClaim;
  }

  async markDelivered(input: { id: string; lockToken: string; deliveredAt: Date }) {
    const lead = this.leads.get(input.id);
    if (!lead) return false;
    lead.deliveryStatus = "delivered";
    lead.lastDeliveryError = null;
    return true;
  }

  async markFailed(input: {
    id: string;
    lockToken: string;
    errorClass: string;
    nextAttemptAt: Date;
  }) {
    const lead = this.leads.get(input.id);
    if (!lead) return false;
    lead.deliveryStatus = "failed";
    lead.lastDeliveryError = input.errorClass;
    return true;
  }

  async healthCheck() {}
  async close() {}
}

class RecordingDelivery implements RfqDeliveryClient {
  calls: PersistedRfqLead[] = [];
  failuresRemaining = 0;
  private readonly order: string[];

  constructor(order: string[]) {
    this.order = order;
  }

  async deliver(lead: PersistedRfqLead) {
    this.order.push("smtp");
    this.calls.push(lead);
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new DeliveryError("smtp_transport_error");
    }
  }
}

async function submit(repository: MemoryRepository, form = validForm()) {
  return handleRfqIntake(
    form,
    { ip: "198.51.100.10", userAgent: "RFQ test agent" },
    dependencies(repository),
  );
}

test("valid consent commits locally before asynchronous SMTP delivery", async () => {
  const repository = new MemoryRepository();
  const delivery = new RecordingDelivery(repository.order);
  const response = await submit(repository);

  assert.deepEqual(response.body, { ok: true, requestId: REQUEST_ID });
  assert.equal(response.status, 200);
  assert.deepEqual(repository.order, ["commit"]);
  assert.equal(repository.leads.get(REQUEST_ID)?.deliveryStatus, "pending");

  assert.equal(await runDeliveryCycle({
    repository,
    deliveryClient: delivery,
    logger: NOOP_LOGGER,
    maxAttempts: 12,
    leaseSeconds: 60,
    now: () => NOW,
    createLockToken: () => "22222222-2222-4222-8222-222222222222",
  }), "delivered");
  assert.deepEqual(repository.order, ["commit", "smtp"]);
  assert.equal(repository.leads.get(REQUEST_ID)?.deliveryStatus, "delivered");
});

test("missing consent is rejected before persistence or delivery", async () => {
  const repository = new MemoryRepository();
  const form = validForm();
  form.delete("personalDataConsent");
  const response = await submit(repository, form);

  assert.equal(response.status, 400);
  assert.equal(repository.leads.size, 0);
  assert.deepEqual(repository.order, []);
});

for (const failure of ["database insert", "transaction commit"] as const) {
  test(`${failure} failure returns 503 and cannot call SMTP`, async () => {
    const smtpCalls = 0;
    const response = await handleRfqIntake(
      validForm(),
      { ip: "198.51.100.11", userAgent: "RFQ test agent" },
      dependencies({
        async insertLead() {
          throw new Error(`${failure}_failed`);
        },
      }),
    );
    assert.equal(response.status, 503);
    assert.equal(response.body.ok, false);
    assert.equal(smtpCalls, 0);
  });
}

test("SMTP failure occurs after commit, keeps the lead, and retry has one final outcome", async () => {
  const repository = new MemoryRepository();
  const delivery = new RecordingDelivery(repository.order);
  delivery.failuresRemaining = 1;
  await submit(repository);

  const worker = {
    repository,
    deliveryClient: delivery,
    logger: NOOP_LOGGER,
    maxAttempts: 12,
    leaseSeconds: 60,
    now: () => NOW,
    createLockToken: () => crypto.randomUUID(),
  };
  assert.equal(await runDeliveryCycle(worker), "failed");
  assert.equal(repository.leads.get(REQUEST_ID)?.deliveryStatus, "failed");
  assert.equal(repository.leads.size, 1);
  assert.equal(await runDeliveryCycle(worker), "delivered");
  assert.equal(await runDeliveryCycle(worker), "idle");
  assert.equal(repository.leads.get(REQUEST_ID)?.deliveryStatus, "delivered");
  assert.equal(delivery.calls.length, 2);
});

test("arbitrary query PII is stripped from persistence and the SMTP message", async () => {
  const repository = new MemoryRepository();
  const capturedAt = NOW.toISOString();
  const expiresAt = new Date(NOW.getTime() + 86_400_000).toISOString();
  const touch = {
    capturedAt,
    initialReferrer: "https://example.org/search?email=secret@example.org",
    landingPath: "/catalog/device?phone=79990000000&token=secret&utm_source=forged",
    utm_source: "approved-source",
    yclid: "approved-click",
  };
  const form = validForm({
    sourcePage: "/request?email=secret@example.org#phone",
    attribution: JSON.stringify({ expiresAt, firstTouch: touch, lastTouch: touch }),
  });
  const response = await submit(repository, form);
  const lead = repository.leads.get(response.body.requestId ?? "");
  assert.ok(lead);
  assert.equal(lead.sourcePath, "/request");
  assert.equal(lead.attribution.landingPath, "/catalog/device");
  assert.equal(lead.attribution.initialReferrer, "https://example.org/search");
  assert.equal(lead.attribution.utm_source, "approved-source");
  assert.equal(lead.attribution.yclid, "approved-click");

  const serialized = JSON.stringify(buildRfqEmail(lead));
  assert.doesNotMatch(serialized, /secret@example\.org|79990000000|token=secret/u);
});

test("SMTP client uses deterministic Message-ID and safe local-only content", async () => {
  const repository = new MemoryRepository();
  const response = await submit(repository, validForm({
    company: "Клиника <script>alert(1)</script>",
    name: "Тест & Проверка",
    message: "Первая строка\n<img src=https://tracker.invalid/pixel>",
  }));
  const lead = repository.leads.get(response.body.requestId ?? "");
  assert.ok(lead);

  const messages: Array<{
    messageId: string;
    subject: string;
    text: string;
    html: string;
    disableFileAccess: true;
    disableUrlAccess: true;
  }> = [];
  const delivery = new YandexSmtpDeliveryClient(SMTP_CONFIG, {
    async sendMail(message) {
      messages.push(message);
      return { accepted: [SMTP_CONFIG.to] };
    },
  });
  await delivery.deliver(lead);
  await delivery.deliver(lead);

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.messageId, `<rfq-${REQUEST_ID}@cyber-medica.ru>`);
  assert.equal(messages[1]?.messageId, messages[0]?.messageId);
  assert.equal(messages[0]?.subject, "Новая заявка с cyber-medica.ru — 11111111");
  assert.doesNotMatch(String(messages[0]?.subject), /[\r\n]/u);
  assert.equal(messages[0]?.disableFileAccess, true);
  assert.equal(messages[0]?.disableUrlAccess, true);
  assert.doesNotMatch(String(messages[0]?.html), /<script>|<img/iu);
  assert.match(String(messages[0]?.html), /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.match(String(messages[0]?.html), /&lt;img src=https:\/\/tracker\.invalid\/pixel&gt;/u);
  assert.match(String(messages[0]?.text), /<img src=https:\/\/tracker\.invalid\/pixel>/u);
});

test("worker retry reuses Message-ID and a delivered row cannot be resent", async () => {
  const repository = new MemoryRepository();
  await submit(repository);
  const messageIds: string[] = [];
  let shouldFail = true;
  const delivery = new YandexSmtpDeliveryClient(SMTP_CONFIG, {
    async sendMail(message) {
      messageIds.push(message.messageId);
      if (shouldFail) {
        shouldFail = false;
        throw Object.assign(new Error("sensitive provider text"), { code: "ETIMEDOUT" });
      }
      return { accepted: [SMTP_CONFIG.to] };
    },
  });
  const worker = {
    repository,
    deliveryClient: delivery,
    logger: NOOP_LOGGER,
    maxAttempts: 12,
    leaseSeconds: 60,
    now: () => NOW,
    createLockToken: () => crypto.randomUUID(),
  };

  assert.equal(await runDeliveryCycle(worker), "failed");
  assert.equal(repository.leads.get(REQUEST_ID)?.lastDeliveryError, "smtp_etimedout");
  assert.equal(await runDeliveryCycle(worker), "delivered");
  assert.deepEqual(messageIds, [
    `<rfq-${REQUEST_ID}@cyber-medica.ru>`,
    `<rfq-${REQUEST_ID}@cyber-medica.ru>`,
  ]);
  assert.equal(await runDeliveryCycle(worker), "idle");
  assert.equal(messageIds.length, 2);
});

test("Message-ID rejects non-UUID input instead of allowing header injection", () => {
  assert.throws(
    () => smtpMessageId(`${REQUEST_ID}\r\nBcc: attacker@example.org`),
    /invalid_request_id/u,
  );
});

test("SMTP config is Yandex-only and rejects address/header injection", () => {
  const base = {
    RFQ_DATABASE_URL: "postgresql://rfq:secret@127.0.0.1:5432/cybermedica_rfq",
    RFQ_INTAKE_HOST: "127.0.0.1",
    RFQ_SMTP_HOST: "smtp.yandex.ru",
    RFQ_SMTP_PORT: "465",
    RFQ_SMTP_SECURE: "true",
    RFQ_SMTP_USER: "rfq@cyber-medica.ru",
    RFQ_SMTP_PASSWORD: "test-only-password",
    RFQ_SMTP_FROM: "rfq@cyber-medica.ru",
    RFQ_SMTP_TO: "info@cyber-medica.ru",
    RFQ_RATE_LIMIT_SECRET: "z".repeat(32),
  };
  assert.equal(readRfqIntakeConfig(base).smtp.host, "smtp.yandex.ru");
  assert.equal(readRfqIntakeConfig({
    ...base,
    RFQ_SMTP_PORT: "587",
    RFQ_SMTP_SECURE: "false",
  }).smtp.secure, false);
  assert.throws(() => readRfqIntakeConfig({
    ...base,
    RFQ_SMTP_HOST: "smtp.foreign.invalid",
  }), /smtp\.yandex\.ru/u);
  for (const name of ["RFQ_SMTP_USER", "RFQ_SMTP_FROM", "RFQ_SMTP_TO"] as const) {
    assert.throws(() => readRfqIntakeConfig({
      ...base,
      [name]: `info@cyber-medica.ru\r\nBcc: attacker@example.org`,
    }), /plain email address/u);
  }
  assert.throws(() => readRfqIntakeConfig({
    ...base,
    RFQ_SMTP_REPLY_TO: `info@cyber-medica.ru\nBcc: attacker@example.org`,
  }), /plain email address/u);
});

test("worker logs expose no RFQ contact data or SMTP envelope", async () => {
  const repository = new MemoryRepository();
  const delivery = new RecordingDelivery(repository.order);
  delivery.failuresRemaining = 1;
  await submit(repository);
  const records: Array<Record<string, unknown>> = [];
  const logger: SafeLogger = {
    info(event, fields) { records.push({ event, ...fields }); },
    error(event, fields) { records.push({ event, ...fields }); },
  };
  await runDeliveryCycle({
    repository,
    deliveryClient: delivery,
    logger,
    maxAttempts: 12,
    leaseSeconds: 60,
    now: () => NOW,
    createLockToken: () => "22222222-2222-4222-8222-222222222222",
  });
  const serialized = JSON.stringify(records);
  assert.doesNotMatch(serialized, /PRE-CUTOVER|Тестовый пользователь|900 000|example\.invalid|локальной первичной записи/iu);
  assert.doesNotMatch(serialized, /rfq@example\.test|qa@example\.test|test-only-password/iu);
  assert.match(serialized, /smtp_transport_error/u);
});

test("analytics parameter allowlist rejects all contact PII", () => {
  assert.deepEqual(sanitizeRfqEventParameters({
    requestId: REQUEST_ID,
    sourcePage: "/request",
    company: "Secret clinic",
    name: "Secret name",
    phone: "+7 900 000-00-00",
    email: "secret@example.org",
    message: "Secret message",
  }), { requestId: REQUEST_ID, sourcePage: "/request" });
});

test("requestId contract is UUID and honeypot is a no-write success", async () => {
  const repository = new MemoryRepository();
  const response = await submit(repository);
  assert.match(response.body.requestId ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);

  const honeypotRepository = new MemoryRepository();
  const honeypot = await submit(honeypotRepository, validForm({ website: "bot" }));
  assert.deepEqual(honeypot.body, { ok: true });
  assert.equal(honeypotRepository.leads.size, 0);
});

test("hashed rate limiter preserves the five-request boundary", async () => {
  const repository = new MemoryRepository();
  const limiter = new HashedRateLimiter("y".repeat(32), 60_000, 1);
  const deps = dependencies(repository, limiter);
  const metadata = { ip: "198.51.100.12", userAgent: "RFQ rate test" };
  assert.equal((await handleRfqIntake(validForm(), metadata, deps)).status, 200);
  assert.equal((await handleRfqIntake(validForm(), metadata, deps)).status, 429);
  assert.equal(repository.leads.size, 1);
});

test("target Nginx contract bypasses the Vercel RFQ route without deleting rollback", async () => {
  const [nginx, localServer, vercelRoute] = await Promise.all([
    readFile("infra/nginx/rfq-ru-first-intake.conf.example", "utf8"),
    readFile("services/rfq-intake/server.ts", "utf8"),
    readFile("app/api/request/route.ts", "utf8"),
  ]);
  assert.match(nginx, /location = \/api\/request/u);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:8787/u);
  assert.match(nginx, /access_log off/u);
  assert.doesNotMatch(nginx, /proxy_pass https:\/\/medgraph-three\.vercel\.app;[\s\S]*location = \/api\/request/u);
  assert.match(localServer, /handleRfqIntake/u);
  assert.match(vercelRoute, /export async function POST/u);
});

test("target runtime has no Make, Resend, webhook, or Vercel RFQ delivery transport", async () => {
  const runtime = (await Promise.all([
    readFile("services/rfq-intake/delivery.ts", "utf8"),
    readFile("services/rfq-intake/config.ts", "utf8"),
    readFile("services/rfq-intake/server.ts", "utf8"),
    readFile("services/rfq-intake/.env.example", "utf8"),
  ])).join("\n");
  assert.doesNotMatch(runtime, /MakeDelivery|buildMakePayload|RFQ_MAKE|Resend|webhook/iu);
  assert.doesNotMatch(runtime, /vercel\.app|api\.resend\.com|hook\.[a-z]/iu);
  assert.match(runtime, /YandexSmtpDeliveryClient/u);
  assert.match(runtime, /smtp\.yandex\.ru/u);
});

test("SMTP environment contract contains placeholders and no committed credentials", async () => {
  const environmentExample = await readFile("services/rfq-intake/.env.example", "utf8");
  assert.match(environmentExample, /RFQ_SMTP_PASSWORD=SET_MANUALLY/u);
  assert.match(environmentExample, /RFQ_SMTP_USER=SET_MANUALLY/u);
  assert.match(environmentExample, /RFQ_SMTP_FROM=SET_MANUALLY/u);
  assert.match(environmentExample, /RFQ_SMTP_TO=SET_MANUALLY/u);
  assert.doesNotMatch(environmentExample, /RFQ_MAKE|RFQ_RESEND/u);
});

test("SQL contract is local-primary, status-aware, consent-evidenced and least-privilege", async () => {
  const sql = await readFile("services/rfq-intake/sql/001_rfq_leads.sql", "utf8");
  assert.match(sql, /id uuid PRIMARY KEY/u);
  assert.match(sql, /consent_text_sha256/u);
  assert.match(sql, /delivery_status IN \('pending', 'delivered', 'failed'\)/u);
  assert.match(sql, /REVOKE ALL ON TABLE public\.rfq_leads FROM PUBLIC/u);
  assert.doesNotMatch(sql, /raw_ip|user_agent|full_url|query_string/iu);
});

test("runtime config refuses remote database and public service bindings", () => {
  const base = {
    RFQ_DATABASE_URL: "postgresql://rfq:secret@127.0.0.1:5432/cybermedica_rfq",
    RFQ_INTAKE_HOST: "127.0.0.1",
    RFQ_SMTP_HOST: "smtp.yandex.ru",
    RFQ_SMTP_PORT: "465",
    RFQ_SMTP_SECURE: "true",
    RFQ_SMTP_USER: "rfq@cyber-medica.ru",
    RFQ_SMTP_PASSWORD: "test-only-password",
    RFQ_SMTP_FROM: "rfq@cyber-medica.ru",
    RFQ_SMTP_TO: "info@cyber-medica.ru",
    RFQ_RATE_LIMIT_SECRET: "z".repeat(32),
  };
  assert.equal(readRfqIntakeConfig(base).host, "127.0.0.1");
  assert.throws(() => readRfqIntakeConfig({
    ...base,
    RFQ_DATABASE_URL: "postgresql://rfq:secret@db.example.org:5432/cybermedica_rfq",
  }), /localhost/u);
  assert.throws(() => readRfqIntakeConfig({
    ...base,
    RFQ_INTAKE_HOST: "0.0.0.0",
  }), /loopback/u);
});

test("Product context uses the checksum-validated published snapshot", async () => {
  const resolver = await SnapshotProductContextResolver.fromFile(
    "data/published-catalog-last-known-good.json",
  );
  const context = await resolver.resolve({
    id: "767632362-116854129531-fetalnii-monitor-comen-star5000c",
    slug: "767632362-116854129531-fetalnii-monitor-comen-star5000c",
  });
  assert.equal(context?.model, "STAR5000C");
  assert.equal(await resolver.resolve({
    id: "tampered-product",
    slug: "767632362-116854129531-fetalnii-monitor-comen-star5000c",
  }), null);
});
