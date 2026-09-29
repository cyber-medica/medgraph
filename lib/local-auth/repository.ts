import pg from "pg";

import type {
  LocalAuthAuditEvent,
  LocalAuthUser,
  LocalLoginChallenge,
  LocalRole,
  LocalSession,
  ValidatedLocalSession,
} from "./core.ts";

const { Pool } = pg;

export interface LocalAuthRepository {
  findUserByNormalizedEmail(normalizedEmail: string): Promise<LocalAuthUser | null>;
  createLoginChallenge(challenge: LocalLoginChallenge): Promise<void>;
  consumeLoginChallenge(tokenHash: string, now: Date): Promise<LocalAuthUser | null>;
  createSession(session: LocalSession): Promise<boolean>;
  findValidSession(tokenHash: string, now: Date): Promise<ValidatedLocalSession | null>;
  revokeSession(
    tokenHash: string,
    now: Date,
  ): Promise<Readonly<{ sessionId: string; userId: string }> | null>;
  revokeAllSessions(userId: string, now: Date): Promise<number>;
  recordAudit(event: LocalAuthAuditEvent): Promise<void>;
}

interface UserRow {
  id: string;
  normalized_email: string;
  role: LocalRole;
  display_name: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface SessionRow {
  session_id: string;
  user_id: string;
  token_hash: string;
  session_created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  normalized_email: string;
  role: LocalRole;
  display_name: string | null;
  active: boolean;
  user_created_at: Date;
  user_updated_at: Date;
}

function mapUser(row: UserRow): LocalAuthUser {
  return {
    id: row.id,
    normalizedEmail: row.normalized_email,
    role: row.role,
    displayName: row.display_name,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapSession(row: SessionRow): ValidatedLocalSession {
  return {
    id: row.session_id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: new Date(row.session_created_at),
    expiresAt: new Date(row.expires_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    user: {
      id: row.user_id,
      normalizedEmail: row.normalized_email,
      role: row.role,
      displayName: row.display_name,
      active: row.active,
      createdAt: new Date(row.user_created_at),
      updatedAt: new Date(row.user_updated_at),
    },
  };
}

export class PostgresLocalAuthRepository implements LocalAuthRepository {
  private readonly pool: InstanceType<typeof Pool>;

  constructor(databaseUrl: string, applicationName = "cybermedica-local-auth") {
    this.pool = new Pool({
      connectionString: databaseUrl,
      application_name: applicationName,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 5_000,
      allowExitOnIdle: true,
      ssl: false,
    });
  }

  async findUserByNormalizedEmail(normalizedEmail: string) {
    const result = await this.pool.query<UserRow>(
      `SELECT id, normalized_email, role, display_name, active, created_at, updated_at
       FROM public.internal_users
       WHERE normalized_email = $1 AND active = true
       LIMIT 1`,
      [normalizedEmail],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async createLoginChallenge(challenge: LocalLoginChallenge) {
    await this.pool.query(
      `INSERT INTO public.internal_login_challenges (
         id, user_id, token_hash, expires_at, used_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        challenge.id,
        challenge.userId,
        challenge.tokenHash,
        challenge.expiresAt,
        challenge.usedAt,
        challenge.createdAt,
      ],
    );
  }

  async consumeLoginChallenge(tokenHash: string, now: Date) {
    const result = await this.pool.query<UserRow>(
      `WITH consumed AS (
         UPDATE public.internal_login_challenges
         SET used_at = $2
         WHERE token_hash = $1
           AND used_at IS NULL
           AND expires_at > $2
         RETURNING user_id
       )
       SELECT u.id, u.normalized_email, u.role, u.display_name,
              u.active, u.created_at, u.updated_at
       FROM consumed c
       JOIN public.internal_users u ON u.id = c.user_id
       WHERE u.active = true`,
      [tokenHash, now],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async createSession(session: LocalSession) {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO public.internal_sessions (
         id, user_id, token_hash, created_at, expires_at, revoked_at
       )
       SELECT $1, u.id, $3, $4, $5, $6
       FROM public.internal_users u
       WHERE u.id = $2 AND u.active = true
       RETURNING id`,
      [
        session.id,
        session.userId,
        session.tokenHash,
        session.createdAt,
        session.expiresAt,
        session.revokedAt,
      ],
    );
    return result.rowCount === 1;
  }

  async findValidSession(tokenHash: string, now: Date) {
    const result = await this.pool.query<SessionRow>(
      `SELECT s.id AS session_id, s.user_id, s.token_hash,
              s.created_at AS session_created_at, s.expires_at, s.revoked_at,
              u.normalized_email, u.role, u.display_name, u.active,
              u.created_at AS user_created_at, u.updated_at AS user_updated_at
       FROM public.internal_sessions s
       JOIN public.internal_users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > $2
         AND u.active = true
       LIMIT 1`,
      [tokenHash, now],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async revokeSession(tokenHash: string, now: Date) {
    const result = await this.pool.query<{ id: string; user_id: string }>(
      `UPDATE public.internal_sessions
       SET revoked_at = $2
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING id, user_id`,
      [tokenHash, now],
    );
    const row = result.rows[0];
    return row ? { sessionId: row.id, userId: row.user_id } : null;
  }

  async revokeAllSessions(userId: string, now: Date) {
    const result = await this.pool.query(
      `UPDATE public.internal_sessions
       SET revoked_at = $2
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, now],
    );
    return result.rowCount ?? 0;
  }

  async recordAudit(event: LocalAuthAuditEvent) {
    await this.pool.query(
      `INSERT INTO public.internal_auth_audit (
         id, user_id, event_type, session_id, target, result, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.id,
        event.userId,
        event.eventType,
        event.sessionId,
        event.target,
        event.result,
        event.createdAt,
      ],
    );
  }

  async close() {
    await this.pool.end();
  }
}
