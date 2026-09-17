# RFQ RU-first intake + Yandex SMTP rollout and rollback

This is a plan only. The Draft branch does not mutate Production, VPS, Nginx,
PostgreSQL, SMTP credentials or any external service.

## 1. Evidence and release preflight

1. Record the exact accepted commit and current Nginx checksum.
2. Retain official Timeweb evidence that the VPS and backup location are in
   Russia.
3. Retain the Yandex 360 agreement/account evidence for ООО «КИМ» and the
   applicable DPA.
4. Keep Roskomnadzor/operator status as a separate owner/legal gate.
5. Measure VPS RAM/disk/load and preserve at least 25% headroom.
6. Confirm the deployed Node version is at least 20 and matches the tested
   systemd runtime.
7. Confirm the published catalog snapshot contains the expected 114 Products
   and matches its recorded checksum.
8. Capture a restorable VPS configuration backup.

## 2. PostgreSQL and least-privilege roles

Install the distribution-supported PostgreSQL package without opening its
port. Require loopback-only listen addresses, SCRAM authentication and no public
firewall rule for 5432.

Create owner/app roles and the database using secrets entered interactively,
never via repository files or shell history. Apply
`services/rfq-intake/sql/001_rfq_leads.sql`, revoke `PUBLIC`, then grant the app
role only:

```sql
GRANT USAGE ON SCHEMA public TO cybermedica_rfq_app;
GRANT SELECT, INSERT ON TABLE public.rfq_leads TO cybermedica_rfq_app;
GRANT UPDATE (
  delivery_status, delivery_attempts, last_delivery_error,
  delivery_next_attempt_at, delivery_locked_at, delivery_lock_token,
  delivered_at, updated_at
) ON TABLE public.rfq_leads TO cybermedica_rfq_app;
```

Verify that the app role cannot create/drop tables or delete rows.

## 3. Service files and manual environment

Deploy the exact accepted commit to
`/opt/cybermedica-rfq/releases/<SHA>`, use `npm ci --omit=dev`, atomically update
`current`, and install the reviewed systemd unit.

The owner creates `/etc/cybermedica/rfq-intake.env` as root, mode `0600`:

| Variable | Source/constraint |
| --- | --- |
| `RFQ_DATABASE_URL` | Dedicated local app role; host `127.0.0.1` only |
| `RFQ_INTAKE_HOST` | `127.0.0.1` |
| `RFQ_INTAKE_PORT` | `8787` |
| `RFQ_SMTP_HOST` | Exact value `smtp.yandex.ru` |
| `RFQ_SMTP_PORT` | Preferred `465`; `587` only for STARTTLS |
| `RFQ_SMTP_SECURE` | `true` for 465; `false` for 587 |
| `RFQ_SMTP_USER` | Manually created Yandex 360 mailbox credential |
| `RFQ_SMTP_PASSWORD` | Manually created app password/credential |
| `RFQ_SMTP_FROM` | Approved single sender mailbox |
| `RFQ_SMTP_TO` | Approved single corporate recipient |
| `RFQ_SMTP_REPLY_TO` | Optional approved single mailbox |
| `RFQ_RATE_LIMIT_SECRET` | New random value of at least 32 characters |
| `RFQ_CATALOG_SNAPSHOT_PATH` | Absolute path in the accepted release |
| `RFQ_DELIVERY_POLL_MS` | Default `5000` unless load testing changes it |
| `RFQ_DELIVERY_MAX_ATTEMPTS` | Default `12` |
| `RFQ_DELIVERY_LEASE_SECONDS` | Default `60` |
| `RFQ_RETENTION_DAYS` | Reserved owner-approved value `365`; enforcement remains disabled until the separate cleanup/backups/mailbox implementation is accepted |

Credentials must not be copied to Git, GitHub, Vercel, Preview, reports or
command-line arguments. Confirm systemd/journal output does not expose the
environment.

## 4. Backup and restore gate

1. Create an encrypted custom-format `pg_dump` on the approved Russian backup
   volume without putting its password in process arguments.
2. Record checksum, PostgreSQL version and migration identity.
3. Restore into an isolated loopback database.
4. Validate schema, constraints and grants, then remove the isolated restore.
5. Do not continue without a verified restore.

## 5. SMTP TLS preflight without mail

From the VPS, verify DNS, TCP and TLS/SNI to `smtp.yandex.ru:465` (or STARTTLS
on 587) without authenticating, transmitting an envelope or sending customer
data. Require a valid certificate chain and TLS 1.2+.

Start the service and require local `/healthz` 200. The health endpoint checks
PostgreSQL only and must not send mail. Inspect the journal for safe structured
fields only.

## 6. Exact Nginx routing change

Only after all gates, insert the reviewed exact `/api/request` location from
`infra/nginx/rfq-ru-first-intake.conf.example` before the existing generic
Vercel location. Do not modify TLS, DNS, static routing, upstream host or any
other location.

Run `nginx -t`, capture a sanitized diff, reload, and verify:

- `GET /api/request` is 405 from the local service;
- normal pages/assets are unchanged;
- no request body reaches the Vercel upstream;
- access/error logs contain no body, PII or full query.

## 7. Controlled synthetic RFQ

With separate authorization for exactly one clearly tagged test write:

1. Submit through the canonical host with consent and synthetic contact data.
2. Require API 200, UUID, `/thanks` and exactly one `rfq_success`.
3. Prove the PostgreSQL commit precedes the first SMTP attempt.
4. Query by request ID and prove pathname-only source, allowlisted attribution,
   consent evidence and final `delivered`, without copying PII into evidence.
5. Require exactly one corporate mailbox message with deterministic
   `<rfq-{requestId}@cyber-medica.ru>` Message-ID.
6. Prove Vercel, Make, Resend and analytics received no RFQ PII.
7. With additional authorization, simulate a transient SMTP failure and prove
   durable lead retention, controlled retry and stable Message-ID.

Only after acceptance should the owner disable the historical Make RFQ
scenario. Do not delete rollback evidence or replay old webhook payloads.

## 8. Rollback

Rollback routing only:

1. Restore the recorded Nginx config so `/api/request` again uses the prior
   Vercel route.
2. Run `nginx -t`, reload and verify RFQ behavior.
3. Stop the local intake worker to prevent additional SMTP sends.
4. Retain local PostgreSQL rows and encrypted backups; do not delete or replay
   them without an incident decision.
5. Do **not** automatically re-enable the old Make/Resend PII path without
   explicit owner approval.

Rollback does not change DNS, TLS, Vercel deployment, Supabase or Product data.

## Stop conditions

- Account/DPA or Russian-location evidence is missing.
- Database or service is remotely reachable, or restore is unverified.
- Nginx diff touches anything outside exact `/api/request`.
- Any RFQ PII reaches Vercel, Make, Resend, analytics or logs.
- API success occurs before PostgreSQL commit.
- SMTP credentials appear outside the root-owned VPS environment.
- Header injection, unsafe HTML, non-deterministic Message-ID or duplicate
  delivered-row claims are observed.
- Current public RFQ UX, email delivery or rollback path fails.
