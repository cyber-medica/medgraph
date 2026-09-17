import { resolve } from "node:path";

import type { YandexSmtpConfig } from "./types.ts";

export interface RfqIntakeConfig {
  databaseUrl: string;
  host: "127.0.0.1" | "::1";
  port: number;
  smtp: YandexSmtpConfig;
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

function boolean(environment: Environment, name: string) {
  const raw = required(environment, name).toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function mailbox(environment: Environment, name: string) {
  const value = required(environment, name);
  if (
    /[\r\n]/u.test(value)
    || !/^[^\s@<>(),;:"\\[\]]+@[^\s@<>(),;:"\\[\]]+\.[^\s@<>(),;:"\\[\]]+$/u.test(value)
  ) {
    throw new Error(`${name} must be one plain email address without a display name.`);
  }
  return value;
}

function smtpConfig(environment: Environment): YandexSmtpConfig {
  const host = required(environment, "RFQ_SMTP_HOST").toLowerCase();
  if (host !== "smtp.yandex.ru") {
    throw new Error("RFQ_SMTP_HOST must be smtp.yandex.ru.");
  }
  const port = integer(environment, "RFQ_SMTP_PORT", 465, 465, 587);
  if (port !== 465 && port !== 587) {
    throw new Error("RFQ_SMTP_PORT must be 465 or 587.");
  }
  const secure = boolean(environment, "RFQ_SMTP_SECURE");
  if ((port === 465 && !secure) || (port === 587 && secure)) {
    throw new Error("RFQ_SMTP_SECURE must be true for 465 and false for 587 STARTTLS.");
  }
  const password = required(environment, "RFQ_SMTP_PASSWORD");
  if (/[\r\n]/u.test(password)) {
    throw new Error("RFQ_SMTP_PASSWORD must not contain line breaks.");
  }
  const replyTo = environment.RFQ_SMTP_REPLY_TO?.trim()
    ? mailbox(environment, "RFQ_SMTP_REPLY_TO")
    : null;
  return {
    host,
    port,
    secure,
    user: mailbox(environment, "RFQ_SMTP_USER"),
    password,
    from: mailbox(environment, "RFQ_SMTP_FROM"),
    to: mailbox(environment, "RFQ_SMTP_TO"),
    replyTo,
  };
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
    smtp: smtpConfig(environment),
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
