# RFQ RU-first intake rollout and rollback

This runbook is a plan. Do not execute it from the Draft PR. Each Production
step requires explicit approval, a maintenance owner and evidence capture that
contains no contact data.

## 1. Preflight

1. Record current Nginx config checksum and Vercel `/api/request` rollback path.
2. Confirm the Timeweb VPS/datacenter and planned backup destination are in
   Russia using provider account/contract evidence.
3. Measure free RAM/disk/load and confirm at least 25% post-install headroom.
   Confirm the service host uses Node.js 24.x, matching the tested native
   type-stripping runtime used by the systemd unit.
4. Confirm `data/published-catalog-last-known-good.json` has 114 active Products
   and is deployed with its repository checksum.
5. Confirm the Make scenario will deduplicate the stable `requestId` before
   sending Resend/email. Do not cut over with only header acceptance assumed.
6. Take and verify a restorable VPS configuration backup.

## 2. PostgreSQL and least-privilege roles

Install the distribution-supported PostgreSQL package without opening its port.
Set `listen_addresses = 'localhost'`, require SCRAM for the application login,
and verify `ss -lntp` shows no public `:5432` listener.

As the PostgreSQL administrator, substitute freshly generated secrets only in
the interactive session (never in shell history or repository):

```sql
CREATE ROLE cybermedica_rfq_owner NOLOGIN;
CREATE ROLE cybermedica_rfq_app LOGIN PASSWORD '<SET INTERACTIVELY>';
CREATE DATABASE cybermedica_rfq OWNER cybermedica_rfq_owner TEMPLATE template0;
REVOKE ALL ON DATABASE cybermedica_rfq FROM PUBLIC;
GRANT CONNECT ON DATABASE cybermedica_rfq TO cybermedica_rfq_app;
```

Connect to the new database as an administrative/migration role, set the table
owner context, apply `services/rfq-intake/sql/001_rfq_leads.sql`, then grant:

```sql
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cybermedica_rfq_app;
GRANT SELECT, INSERT ON TABLE public.rfq_leads TO cybermedica_rfq_app;
GRANT UPDATE (
  delivery_status, delivery_attempts, last_delivery_error,
  delivery_next_attempt_at, delivery_locked_at, delivery_lock_token,
  delivered_at, updated_at
) ON TABLE public.rfq_leads TO cybermedica_rfq_app;
```

Verify the app role cannot create/drop tables or delete rows. Save migration and
privilege output without connection strings or row contents.

## 3. Service files and manual environment

Create system user/group `cybermedica-rfq`, deploy the exact accepted commit to
`/opt/cybermedica-rfq/releases/<SHA>`, install with `npm ci --omit=dev`, point
`current` atomically to it, and install the reviewed systemd unit.

The owner must create `/etc/cybermedica/rfq-intake.env` mode `0600`, root-owned,
with these manually sourced values:

| Variable | Source/constraint |
| --- | --- |
| `RFQ_DATABASE_URL` | Dedicated local app role; host `127.0.0.1` only |
| `RFQ_INTAKE_HOST` | `127.0.0.1` |
| `RFQ_INTAKE_PORT` | `8787` |
| `RFQ_MAKE_WEBHOOK_URL` | Current approved HTTPS Make hook |
| `RFQ_MAKE_WEBHOOK_TOKEN` | Existing token if required; never Git/Vercel |
| `RFQ_RATE_LIMIT_SECRET` | New random value, at least 32 characters |
| `RFQ_CATALOG_SNAPSHOT_PATH` | Absolute path in the accepted release |
| `RFQ_DELIVERY_POLL_MS` | Default `5000` unless load test justifies change |
| `RFQ_DELIVERY_MAX_ATTEMPTS` | Default `12` |
| `RFQ_DELIVERY_LEASE_SECONDS` | Default `60` |
| `RFQ_RETENTION_DAYS` | **Unset** pending owner/legal decision |

Start and enable the service. From the VPS only, require `GET
http://127.0.0.1:8787/healthz` to return 200 and verify its journal contains no
contact fields, bodies or full URLs.

## 4. Database backup/restore gate

1. Run an encrypted `pg_dump --format=custom` to the approved Russian backup
   volume without exposing its password on the command line.
2. Record checksum, PostgreSQL version and schema migration ID.
3. Restore into an isolated loopback-only database.
4. Validate table/checks/privileges; drop the isolated restore.
5. Keep retention disabled until the owner gives a period covering primary and
   backup copies.

No Nginx cutover is allowed before a verified restore.

## 5. Nginx cutover

Insert the exact block from
`infra/nginx/rfq-ru-first-intake.conf.example` before the existing generic
Vercel location. Do not modify TLS, DNS, static routing, upstream host or other
locations.

Run `nginx -t`, capture the sanitized diff, then reload. Confirm externally that
`GET /api/request` is 405 from the local service and all normal pages/assets are
unchanged. Confirm Nginx and service logs have no bodies, contact fields or full
queries.

## 6. Controlled smoke and one tagged RFQ

With separate authorization for exactly one test write:

1. Load `/request` and a Product-bound request on desktop/mobile.
2. Submit data clearly marked `RU-FIRST TEST — НЕ ОБРАБАТЫВАТЬ`, with consent,
   approved UTM fields, `yclid`, and one arbitrary query containing synthetic
   email/token data.
3. Require API 200 and a UUID; require `/thanks` and one `rfq_success` only.
4. Query by request ID locally and prove `created_at`, consent evidence,
   pathname-only source, allowlisted attribution and initial `pending`/final
   `delivered` status. Never copy the PII row into evidence.
5. Prove the local commit timestamp precedes the first Make execution.
6. Prove Make deduplication, one Resend/email delivery, and no arbitrary-query
   value in Make, email, analytics or logs.
7. Simulate Make unavailability: accept one separately authorized synthetic
   lead after local commit, prove retry and final single downstream outcome.

## 7. Rollback

Rollback changes routing only:

1. Restore the recorded Nginx config so exact `/api/request` again reaches the
   current Vercel upstream.
2. Run `nginx -t` and reload.
3. Confirm `/request`, a Product-bound form, current email pipeline and R9 event.
4. Keep PostgreSQL/service stopped but preserve accepted local leads and backup;
   do not delete or replay without an incident decision.

Rollback does not change DNS, TLS, Vercel deployment, Supabase or Product data.

## Stop conditions

- Database is remotely reachable or restore is unverified.
- Nginx diff touches anything outside exact `/api/request`.
- Any contact PII reaches Vercel or logs.
- API reports success before commit.
- Make runs before commit or does not deduplicate request ID.
- Product binding is stale/invalid, analytics contains PII, or `rfq_success`
  fires without a valid accepted request ID.
- Email, current public RFQ UX or rollback path fails.
