import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { readRfqIntakeConfig } from "./config.ts";
import { MakeDeliveryClient } from "./delivery.ts";
import { handleRfqIntake, type IntakeResponse } from "./intake.ts";
import { safeLogger } from "./logger.ts";
import { SnapshotProductContextResolver } from "./product-catalog.ts";
import { HashedRateLimiter } from "./rate-limit.ts";
import { PostgresRfqRepository } from "./repository.ts";
import { startDeliveryWorker } from "./worker.ts";

const MAX_REQUEST_BYTES = 100_000;

class PayloadTooLargeError extends Error {}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_REQUEST_BYTES) throw new PayloadTooLargeError();
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function sendJson(response: ServerResponse, result: IntakeResponse) {
  const body = JSON.stringify(result.body);
  response.writeHead(result.status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "x-content-type-options": "nosniff",
    ...(result.retryAfterSeconds
      ? { "retry-after": String(result.retryAfterSeconds) }
      : {}),
  });
  response.end(body);
}

function clientIp(request: IncomingMessage) {
  const value = request.headers["x-real-ip"];
  return typeof value === "string" && value.trim() ? value.trim() : "unknown";
}

function contentType(request: IncomingMessage) {
  const value = request.headers["content-type"];
  return typeof value === "string" ? value : "";
}

async function parseFormData(request: IncomingMessage) {
  const body = await readBody(request);
  const type = contentType(request);
  if (
    !type.toLowerCase().startsWith("multipart/form-data;")
    && !type.toLowerCase().startsWith("application/x-www-form-urlencoded")
  ) {
    throw new TypeError("unsupported_content_type");
  }
  const webRequest = new Request("http://127.0.0.1/api/request", {
    method: "POST",
    headers: { "content-type": type },
    body: new Uint8Array(body),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return webRequest.formData();
}

async function main() {
  const config = readRfqIntakeConfig();
  const repository = new PostgresRfqRepository(config.databaseUrl);
  const productResolver = await SnapshotProductContextResolver.fromFile(
    config.catalogSnapshotPath,
  );
  const rateLimiter = new HashedRateLimiter(config.rateLimitSecret);
  const deliveryClient = new MakeDeliveryClient(
    config.makeWebhookUrl,
    config.makeWebhookToken,
  );
  await repository.healthCheck();

  const stopWorker = startDeliveryWorker({
    repository,
    deliveryClient,
    logger: safeLogger,
    maxAttempts: config.deliveryMaxAttempts,
    leaseSeconds: config.deliveryLeaseSeconds,
    pollMs: config.deliveryPollMs,
  });

  const server = createServer(async (request, response) => {
    const startedAt = Date.now();
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (requestUrl.pathname === "/healthz") {
      if (request.method !== "GET") {
        response.writeHead(405, { allow: "GET" }).end();
        return;
      }
      try {
        await repository.healthCheck();
        sendJson(response, { status: 200, body: { ok: true } });
      } catch {
        sendJson(response, { status: 503, body: { ok: false } });
      }
      return;
    }

    if (requestUrl.pathname !== "/api/request") {
      sendJson(response, { status: 404, body: { ok: false, error: "Not found" } });
      return;
    }
    if (request.method !== "POST") {
      response.setHeader("allow", "POST");
      sendJson(response, { status: 405, body: { ok: false, error: "Method not allowed" } });
      return;
    }

    try {
      const declaredLength = Number(request.headers["content-length"] ?? 0);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
        throw new PayloadTooLargeError();
      }
      const formData = await parseFormData(request);
      const result = await handleRfqIntake(
        formData,
        {
          ip: clientIp(request),
          userAgent: request.headers["user-agent"]?.trim() ?? "",
        },
        { repository, productResolver, rateLimiter },
      );
      sendJson(response, result);
      safeLogger.info("rfq_intake_completed", {
        requestId: result.body.requestId ?? null,
        status: result.status,
        latencyMs: Date.now() - startedAt,
        deliveryStatus: result.body.requestId ? "pending" : null,
      });
    } catch (error) {
      const tooLarge = error instanceof PayloadTooLargeError;
      const result: IntakeResponse = tooLarge
        ? {
            status: 413,
            body: {
              ok: false,
              error: "Описание получилось слишком длинным. Сократите текст и отправьте заявку ещё раз.",
            },
          }
        : {
            status: 400,
            body: {
              ok: false,
              error: "Форму не удалось обработать. Обновите страницу и попробуйте снова.",
            },
          };
      sendJson(response, result);
      safeLogger.error("rfq_intake_rejected", {
        status: result.status,
        latencyMs: Date.now() - startedAt,
        errorClass: tooLarge ? "payload_too_large" : "malformed_form",
      });
    }
  });

  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.listen(config.port, config.host, () => {
    safeLogger.info("rfq_intake_started", { status: 200 });
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopWorker();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await repository.close();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch(() => {
  safeLogger.error("rfq_intake_startup_failed", { errorClass: "startup_error" });
  process.exitCode = 1;
});
