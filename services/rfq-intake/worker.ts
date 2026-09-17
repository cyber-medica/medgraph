import { randomUUID } from "node:crypto";

import { DeliveryError } from "./delivery.ts";
import type { RfqDeliveryClient, RfqRepository, SafeLogger } from "./types.ts";

interface WorkerDependencies {
  repository: RfqRepository;
  deliveryClient: RfqDeliveryClient;
  logger: SafeLogger;
  maxAttempts: number;
  leaseSeconds: number;
  now?: () => Date;
  createLockToken?: () => string;
}

export async function runDeliveryCycle(dependencies: WorkerDependencies) {
  const now = (dependencies.now ?? (() => new Date()))();
  const claim = await dependencies.repository.claimNextDelivery({
    lockToken: (dependencies.createLockToken ?? randomUUID)(),
    now,
    leaseSeconds: dependencies.leaseSeconds,
    maxAttempts: dependencies.maxAttempts,
  });
  if (!claim) return "idle" as const;

  try {
    await dependencies.deliveryClient.deliver(claim);
    const updated = await dependencies.repository.markDelivered({
      id: claim.id,
      lockToken: claim.deliveryLockToken,
      deliveredAt: (dependencies.now ?? (() => new Date()))(),
    });
    if (!updated) throw new Error("delivery_lock_lost");
    dependencies.logger.info("rfq_delivery_completed", {
      requestId: claim.id,
      status: 200,
      deliveryStatus: "delivered",
      attempt: claim.deliveryAttempts,
    });
    return "delivered" as const;
  } catch (error) {
    const errorClass = error instanceof DeliveryError
      ? error.errorClass
      : "delivery_internal_error";
    const retryDelaySeconds = Math.min(3_600, 15 * (2 ** Math.min(claim.deliveryAttempts - 1, 8)));
    const updated = await dependencies.repository.markFailed({
      id: claim.id,
      lockToken: claim.deliveryLockToken,
      errorClass,
      nextAttemptAt: new Date(now.getTime() + retryDelaySeconds * 1_000),
    });
    if (!updated) throw new Error("delivery_lock_lost");
    dependencies.logger.error("rfq_delivery_failed", {
      requestId: claim.id,
      deliveryStatus: "failed",
      errorClass,
      attempt: claim.deliveryAttempts,
    });
    return "failed" as const;
  }
}

export function startDeliveryWorker(
  dependencies: WorkerDependencies & { pollMs: number },
) {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(run, dependencies.pollMs);
    timer.unref();
  };
  const run = async () => {
    if (stopped) return;
    try {
      const result = await runDeliveryCycle(dependencies);
      if (result !== "idle") {
        queueMicrotask(() => void run());
        return;
      }
    } catch {
      dependencies.logger.error("rfq_delivery_worker_error", {
        errorClass: "worker_cycle_error",
      });
    }
    schedule();
  };

  void run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
