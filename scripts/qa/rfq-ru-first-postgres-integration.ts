import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import pg from "pg";

import { RFQ_CONSENT_TEXT_SHA256 } from "../../lib/privacy/legal-document-hash.ts";
import {
  RFQ_CONSENT_VERSION,
  RFQ_POLICY_VERSION,
} from "../../lib/privacy/legal-documents.ts";
import { PostgresRfqRepository } from "../../services/rfq-intake/repository.ts";

const { Pool } = pg;
const databaseUrl = process.env.RFQ_DATABASE_URL?.trim();
if (process.env.RFQ_POSTGRES_INTEGRATION !== "1" || !databaseUrl) {
  throw new Error("Set RFQ_POSTGRES_INTEGRATION=1 and RFQ_DATABASE_URL for the isolated test DB.");
}
const parsed = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname)
  || !parsed.pathname.endsWith("_test")
) {
  throw new Error("PostgreSQL integration is restricted to a loopback database ending in _test.");
}

const admin = new Pool({ connectionString: databaseUrl, max: 1, ssl: false });
const migration = await readFile(
  new URL("../../services/rfq-intake/sql/001_rfq_leads.sql", import.meta.url),
  "utf8",
);
await admin.query(migration);

const repository = new PostgresRfqRepository(databaseUrl);
const id = randomUUID();
const createdAt = new Date("2026-09-16T12:00:00.000Z");
const lead = {
  id,
  company: "RU-FIRST POSTGRES CONTRACT TEST",
  contactName: "Test only",
  phone: null,
  email: "test@example.invalid",
  message: "Do not process",
  product: null,
  sourcePath: "/request",
  attribution: { landingPath: "/request", utm_source: "contract-test" },
  consentVersion: RFQ_CONSENT_VERSION,
  consentTextSha256: RFQ_CONSENT_TEXT_SHA256,
  policyVersion: RFQ_POLICY_VERSION,
  consentAt: createdAt,
  createdAt,
};

let duplicateRolledBack = false;
try {
  const persisted = await repository.insertLead(lead);
  if (persisted.id !== id || persisted.deliveryStatus !== "pending") {
    throw new Error("Committed RFQ row does not match the intake contract.");
  }
  try {
    await repository.insertLead(lead);
  } catch {
    duplicateRolledBack = true;
  }
  const count = await admin.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.rfq_leads WHERE id = $1",
    [id],
  );
  if (!duplicateRolledBack || count.rows[0]?.count !== "1") {
    throw new Error("Failed transaction did not roll back atomically.");
  }

  const claim = await repository.claimNextDelivery({
    lockToken: randomUUID(),
    now: new Date(Date.now() + 60_000),
    leaseSeconds: 60,
    maxAttempts: 12,
  });
  if (!claim || claim.id !== id || claim.deliveryAttempts !== 1) {
    throw new Error("Delivery claim contract failed.");
  }
  if (!await repository.markDelivered({
    id,
    lockToken: claim.deliveryLockToken,
    deliveredAt: new Date(Date.now() + 61_000),
  })) {
    throw new Error("Delivery state update failed.");
  }
  const result = await admin.query<{ delivery_status: string }>(
    "SELECT delivery_status FROM public.rfq_leads WHERE id = $1",
    [id],
  );
  if (result.rows[0]?.delivery_status !== "delivered") {
    throw new Error("Delivered state was not committed.");
  }
  process.stdout.write(`${JSON.stringify({
    event: "rfq_postgres_contract_passed",
    persisted: true,
    duplicateRollback: true,
    deliveryStatus: "delivered",
  })}\n`);
} finally {
  await repository.close();
  await admin.query("DELETE FROM public.rfq_leads WHERE id = $1", [id]);
  await admin.end();
}
