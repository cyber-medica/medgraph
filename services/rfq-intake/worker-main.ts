import { readRfqWorkerConfig } from "./config.ts";
import { YandexSmtpDeliveryClient } from "./delivery.ts";
import { safeLogger } from "./logger.ts";
import { PostgresRfqRepository } from "./repository.ts";
import { startDeliveryWorker } from "./worker.ts";

async function main() {
  const config = readRfqWorkerConfig();
  const repository = new PostgresRfqRepository(
    config.databaseUrl,
    "cybermedica-rfq-worker",
  );
  await repository.healthCheck();

  const stopWorker = startDeliveryWorker({
    repository,
    deliveryClient: new YandexSmtpDeliveryClient(config.smtp),
    logger: safeLogger,
    maxAttempts: config.deliveryMaxAttempts,
    leaseSeconds: config.deliveryLeaseSeconds,
    pollMs: config.deliveryPollMs,
  });
  safeLogger.info("rfq_delivery_worker_started", { status: 200 });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await stopWorker();
    await repository.close();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch(() => {
  safeLogger.error("rfq_delivery_worker_startup_failed", {
    errorClass: "startup_error",
  });
  process.exitCode = 1;
});
