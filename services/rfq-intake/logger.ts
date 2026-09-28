import type { SafeLogger } from "./types.ts";

const ALLOWED_FIELDS = new Set([
  "requestId",
  "status",
  "latencyMs",
  "deliveryStatus",
  "errorClass",
  "attempt",
]);

function safeFields(fields: Record<string, string | number | boolean | null> = {}) {
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => ALLOWED_FIELDS.has(key)),
  );
}

function write(
  level: "info" | "error",
  event: string,
  fields?: Record<string, string | number | boolean | null>,
) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeFields(fields),
  });
  (level === "error" ? process.stderr : process.stdout).write(`${record}\n`);
}

export const safeLogger: SafeLogger = {
  info: (event, fields) => write("info", event, fields),
  error: (event, fields) => write("error", event, fields),
};
