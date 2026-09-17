import pg from "pg";

import type {
  DeliveryClaim,
  NewRfqLead,
  PersistedRfqLead,
  RfqRepository,
  SanitizedAttribution,
} from "./types.ts";

const { Pool } = pg;

interface RfqLeadRow {
  id: string;
  company: string;
  contact_name: string;
  phone: string | null;
  email: string | null;
  message: string;
  product_id: string | null;
  product_slug: string | null;
  product_title: string | null;
  product_model: string | null;
  product_manufacturer: string | null;
  source_path: string;
  attribution: SanitizedAttribution;
  consent_version: string;
  consent_text_sha256: string;
  policy_version: string;
  consent_at: Date;
  created_at: Date;
  delivery_status: "pending" | "delivered" | "failed";
  delivery_attempts: number;
  last_delivery_error: string | null;
  delivery_lock_token?: string;
}

function mapRow(row: RfqLeadRow): PersistedRfqLead {
  return {
    id: row.id,
    company: row.company,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    product: row.product_id && row.product_slug && row.product_title && row.product_model
      ? {
          id: row.product_id,
          slug: row.product_slug,
          title: row.product_title,
          model: row.product_model,
          manufacturer: row.product_manufacturer,
        }
      : null,
    sourcePath: row.source_path,
    attribution: row.attribution,
    consentVersion: row.consent_version,
    consentTextSha256: row.consent_text_sha256,
    policyVersion: row.policy_version,
    consentAt: new Date(row.consent_at),
    createdAt: new Date(row.created_at),
    deliveryStatus: row.delivery_status,
    deliveryAttempts: row.delivery_attempts,
    lastDeliveryError: row.last_delivery_error,
  };
}

const RETURNING_COLUMNS = `
  id, company, contact_name, phone, email, message,
  product_id, product_slug, product_title, product_model, product_manufacturer,
  source_path, attribution, consent_version, consent_text_sha256,
  policy_version, consent_at, created_at, delivery_status,
  delivery_attempts, last_delivery_error, delivery_lock_token
`;

export class PostgresRfqRepository implements RfqRepository {
  private readonly pool: InstanceType<typeof Pool>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 5_000,
      application_name: "cybermedica-rfq-intake",
      ssl: false,
      allowExitOnIdle: true,
    });
  }

  async insertLead(lead: NewRfqLead) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<RfqLeadRow>(
        `INSERT INTO rfq_leads (
          id, company, contact_name, phone, email, message,
          product_id, product_slug, product_title, product_model, product_manufacturer,
          source_path, attribution, consent_version, consent_text_sha256,
          policy_version, consent_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13::jsonb, $14, $15,
          $16, $17, $18
        )
        RETURNING ${RETURNING_COLUMNS}`,
        [
          lead.id,
          lead.company,
          lead.contactName,
          lead.phone,
          lead.email,
          lead.message,
          lead.product?.id ?? null,
          lead.product?.slug ?? null,
          lead.product?.title ?? null,
          lead.product?.model ?? null,
          lead.product?.manufacturer ?? null,
          lead.sourcePath,
          JSON.stringify(lead.attribution),
          lead.consentVersion,
          lead.consentTextSha256,
          lead.policyVersion,
          lead.consentAt,
          lead.createdAt,
        ],
      );
      await client.query("COMMIT");
      const row = result.rows[0];
      if (!row) throw new Error("RFQ insert returned no row.");
      return mapRow(row);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async claimNextDelivery(input: {
    lockToken: string;
    now: Date;
    leaseSeconds: number;
    maxAttempts: number;
  }): Promise<DeliveryClaim | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const candidate = await client.query<{ id: string }>(
        `SELECT id
         FROM rfq_leads
         WHERE delivery_status IN ('pending', 'failed')
           AND delivery_attempts < $1
           AND delivery_next_attempt_at <= $2
           AND (
             delivery_locked_at IS NULL
             OR delivery_locked_at < $2 - ($3 * INTERVAL '1 second')
           )
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [input.maxAttempts, input.now, input.leaseSeconds],
      );
      const id = candidate.rows[0]?.id;
      if (!id) {
        await client.query("COMMIT");
        return null;
      }
      const claimed = await client.query<RfqLeadRow>(
        `UPDATE rfq_leads
         SET delivery_status = 'pending',
             delivery_attempts = delivery_attempts + 1,
             delivery_locked_at = $2,
             delivery_lock_token = $3,
             updated_at = $2
         WHERE id = $1
         RETURNING ${RETURNING_COLUMNS}`,
        [id, input.now, input.lockToken],
      );
      await client.query("COMMIT");
      const row = claimed.rows[0];
      if (!row?.delivery_lock_token) return null;
      return {
        ...mapRow(row),
        deliveryLockToken: row.delivery_lock_token,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async markDelivered(input: { id: string; lockToken: string; deliveredAt: Date }) {
    const result = await this.pool.query(
      `UPDATE rfq_leads
       SET delivery_status = 'delivered',
           delivered_at = $3,
           last_delivery_error = NULL,
           delivery_locked_at = NULL,
           delivery_lock_token = NULL,
           updated_at = $3
       WHERE id = $1 AND delivery_lock_token = $2`,
      [input.id, input.lockToken, input.deliveredAt],
    );
    return result.rowCount === 1;
  }

  async markFailed(input: {
    id: string;
    lockToken: string;
    errorClass: string;
    nextAttemptAt: Date;
  }) {
    const result = await this.pool.query(
      `UPDATE rfq_leads
       SET delivery_status = 'failed',
           last_delivery_error = $3,
           delivery_next_attempt_at = $4,
           delivery_locked_at = NULL,
           delivery_lock_token = NULL,
           updated_at = NOW()
       WHERE id = $1 AND delivery_lock_token = $2`,
      [input.id, input.lockToken, input.errorClass.slice(0, 100), input.nextAttemptAt],
    );
    return result.rowCount === 1;
  }

  async healthCheck() {
    await this.pool.query("SELECT 1");
  }

  async close() {
    await this.pool.end();
  }
}
