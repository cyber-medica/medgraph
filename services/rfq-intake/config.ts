import { resolve } from "node:path";

export interface RfqIntakeConfig {
  databaseUrl: string;
  host: "127.0.0.1" | "::1";
  port: number;
  makeWebhookUrl: string;
  makeWebhookToken: string | null;
  rateLimitSecret: string;
  catalogSnapshotPath: string;
  deliveryPollMs: number;
  deliveryMaxAttempts: number;
  deliveryLeaseSeconds: number;
  retentionDays: number | null;
}

type Environment = Readonly<Record<string, string | undefined>>;

function required(environment: Environment, name: string) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing required RFQ intake environment variable: ${name}`);
  return value;
}

function integer(
  environment: Environment,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = environment[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function optionalRetentionDays(environment: Environment) {
  const raw = environment.RFQ_RETENTION_DAYS?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 3_650) {
    throw new Error("RFQ_RETENTION_DAYS must be an integer from 1 to 3650.");
  }
  return value;
}

function localDatabaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("RFQ_DATABASE_URL must use postgres:// or postgresql://.");
  }
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error("RFQ_DATABASE_URL must target PostgreSQL on localhost.");
  }
  return value;
}

function httpsUrl(value: string, name: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS.`);
  return url.toString();
}

export function readRfqIntakeConfig(
  environment: Environment = process.env,
): RfqIntakeConfig {
  const host = environment.RFQ_INTAKE_HOST?.trim() || "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "::1") {
    throw new Error("RFQ_INTAKE_HOST must be a loopback address.");
  }

  const rateLimitSecret = required(environment, "RFQ_RATE_LIMIT_SECRET");
  if (rateLimitSecret.length < 32) {
    throw new Error("RFQ_RATE_LIMIT_SECRET must contain at least 32 characters.");
  }

  return {
    databaseUrl: localDatabaseUrl(required(environment, "RFQ_DATABASE_URL")),
    host,
    port: integer(environment, "RFQ_INTAKE_PORT", 8787, 1_024, 65_535),
    makeWebhookUrl: httpsUrl(
      required(environment, "RFQ_MAKE_WEBHOOK_URL"),
      "RFQ_MAKE_WEBHOOK_URL",
    ),
    makeWebhookToken: environment.RFQ_MAKE_WEBHOOK_TOKEN?.trim() || null,
    rateLimitSecret,
    catalogSnapshotPath: resolve(
      environment.RFQ_CATALOG_SNAPSHOT_PATH?.trim()
        || "data/published-catalog-last-known-good.json",
    ),
    deliveryPollMs: integer(environment, "RFQ_DELIVERY_POLL_MS", 5_000, 500, 60_000),
    deliveryMaxAttempts: integer(environment, "RFQ_DELIVERY_MAX_ATTEMPTS", 12, 1, 100),
    deliveryLeaseSeconds: integer(environment, "RFQ_DELIVERY_LEASE_SECONDS", 60, 10, 600),
    retentionDays: optionalRetentionDays(environment),
  };
}
