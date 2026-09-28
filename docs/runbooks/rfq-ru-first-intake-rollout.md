# RFQ RU-first controlled VPS rollout

Status: prepared rollout plan for Draft PR #6. Nothing in this plan changes the
active Nginx configuration, DNS, Vercel, PostgreSQL, SMTP, Supabase, Make or
Resend. Every command in this document is operator-run only after an explicit
rollout authorization.

## 0. Release identity and stop gates

Record the accepted Git SHA, the active Nginx configuration checksum and the
current `/api/request` upstream before changing the VPS. Retain Timeweb evidence
that the VPS and backup location are in Russia and Yandex 360 evidence for ООО
«КИМ». Stop while legal acceptance, the RKN notification decision, destruction
procedure approval or backup-retention approval remains open.

Require at least 25% free RAM and disk headroom. Use Node 22.18+ LTS: the units
run repository TypeScript directly with Node's built-in type stripping. Confirm
that the accepted release contains the checksum-validated 114-Product catalog
snapshot.

## 1. PostgreSQL 17, loopback only

Install the OS-supported PostgreSQL **17** server/client packages. If the
Timeweb image does not offer version 17, stop; do not silently install another
major version or add a third-party package repository without review.

Before restart, merge only the reviewed values from
`infra/postgresql/postgresql-rfq.conf.example` and the local authentication
rules from `infra/postgresql/pg-hba-rfq.conf.example` into the version-17
configuration. Preserve backups of both original files.

Required verification:

```text
SHOW server_version;                         -> 17.x
SHOW listen_addresses;                       -> 127.0.0.1,::1
SHOW password_encryption;                    -> scram-sha-256
ss -ltnp '( sport = :5432 )'                 -> loopback sockets only
ufw status numbered                          -> no ALLOW rule for 5432
external TCP probe to <VPS_PUBLIC_IP>:5432   -> refused/timed out
```

If UFW is active, add an explicit inbound deny for TCP/5432 during the
authorized provisioning window. Never add a public, LAN, Docker bridge or
`0.0.0.0/0` PostgreSQL rule. A second-host external probe is mandatory because
a local socket listing alone does not prove the provider firewall state.

## 2. Database, owner and runtime role

Create the roles from an interactive local `psql` session so no password enters
Git, process arguments or shell history:

```sql
CREATE ROLE cybermedica_rfq_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE cybermedica_rfq_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS;
\password cybermedica_rfq_runtime
CREATE DATABASE cybermedica_rfq OWNER cybermedica_rfq_owner
  ENCODING 'UTF8' TEMPLATE template0;
```

As the local PostgreSQL administrator, apply
`infra/postgresql/apply-rfq-schema.sql`. It switches to the non-login owner for
`001_rfq_leads.sql`, then applies `rfq-runtime-grants.sql` as administrator.
The runtime role receives only database `CONNECT`, schema `USAGE`, table
`SELECT`/`INSERT`, and column-scoped delivery-state `UPDATE`.

Acceptance must prove all of the following:

- `cybermedica_rfq_runtime` owns no database, schema, table, sequence or index;
- it is not a member of `cybermedica_rfq_owner`;
- `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES` and schema `CREATE` are false;
- an actual `DELETE ... WHERE false` and `CREATE TABLE` under `SET ROLE
  cybermedica_rfq_runtime` fail with `permission denied`;
- intake insert/returning and worker select/claim/update still pass the isolated
  PostgreSQL 17 integration test.

The repository-level reproduction is `npm run qa:rfq-postgres17-provisioning`.
It requires an already present `postgres:17.6-alpine` image, never pulls an
image, creates only a disposable local test database/container, and verifies
the migration, ownership and positive/negative runtime grants. It is not a
substitute for the Timeweb listener/firewall/external-probe evidence.

## 3. Release and split services

Deploy the accepted SHA to `/opt/cybermedica-rfq/releases/<SHA>`, run the
reviewed dependency install, and atomically point `/opt/cybermedica-rfq/current`
to that release. Do not enable either unit yet.

Install the reviewed units as exact names:

- `infra/systemd/rfq-intake.service` -> `rfq-intake.service`;
- `infra/systemd/rfq-worker.service` -> `rfq-worker.service`.

Run `systemd-analyze verify` against both installed copies. Both run as the
unprivileged `cybermedica-rfq` user with no capabilities and a read-only release.
The intake and SMTP worker are different processes and can be stopped
independently.

Create two root-owned mode `0600` environment files. Copy variable names only
from the repository examples; set values interactively on the VPS:

- `/etc/cybermedica/rfq-intake.env` from `intake.env.example`;
- `/etc/cybermedica/rfq-worker.env` from `worker.env.example`.

The intake environment contains no SMTP credential. The worker environment is
the only service environment containing `RFQ_SMTP_USER`,
`RFQ_SMTP_PASSWORD`, sender and recipient. Neither environment may be copied to
Git, GitHub, Vercel, Preview, a ticket, a report, systemd `Environment=`, CI,
shell history or a credential store.

## 4. Local intake and worker pre-cutover checks

The config rejects a non-loopback database URL and rejects an intake bind other
than `127.0.0.1` or `::1`. Before Nginx cutover:

1. Start `rfq-intake` only and require `127.0.0.1:8787` as its sole listener.
2. Require local `GET /healthz` -> 200 and `GET /api/request` -> 405.
3. Prove a request from a second host cannot connect to port 8787.
4. Keep `rfq-worker` stopped until the TLS preflight and controlled test are
   separately authorized; starting it can deliver any committed pending row.
5. Inspect the journal. Allowed fields are timestamp, level, event, request ID,
   HTTP status, latency, delivery state, attempt and sanitized error class only.

## 5. Yandex SMTP TLS preflight without mail

From the VPS release directory run `npm run qa:rfq-smtp-preflight`. The script
is fixed to `smtp.yandex.ru:465`, validates the certificate chain/SNI and TLS
1.2+, sends **zero SMTP application bytes**, does not read credentials and does
not issue `AUTH`, `MAIL FROM`, `RCPT TO` or `DATA`.

Pass requires the JSON event `rfq_smtp_tls_preflight_passed` with
`authorized:true` and `applicationDataSent:false`. This proves transport
reachability only; it does not validate authentication or send an email.

## 6. Encrypted backups and finite retention

Proposed operational boundary, pending owner approval:

- directory: `/var/backups/cybermedica-rfq/postgresql`, root-owned mode `0700`;
- one daily PostgreSQL custom-format dump, encrypted in the same pipeline with
  `age` to an approved recovery recipient; no plaintext dump on disk;
- recipient/private recovery material remains outside the repository and only
  in an approved Russian location;
- atomic `.tmp` -> `.dump.age` rename after encryption and checksum;
- rolling hard limit: **35 calendar days**, no unlimited weekly/monthly copy;
- restore drill into an isolated loopback database before cutover and at least
  quarterly thereafter;
- deletion job and restore evidence record only date, file ID, checksum,
  PostgreSQL version and result, never RFQ fields.

The 35-day backup limit is a proposed technical value, not an approved legal
decision. Do not schedule backups until the owner approves it and reconciles it
with the 365-day primary RFQ rule, subject requests and mailbox destruction.
Cutover is blocked until an encrypted backup/restore succeeds.

## 7. Exact Nginx cutover

Only after all gates pass, insert the exact-match block from
`infra/nginx/rfq-ru-first-intake.conf.example` before the generic Vercel
location. No other location, TLS, DNS or upstream setting changes.

```text
POST https://cyber-medica.ru/api/request
  -> Timeweb Nginx exact location
  -> http://127.0.0.1:8787/api/request
  -> local PostgreSQL commit

all other paths -> existing Vercel upstream unchanged
```

Run `nginx -t`, retain a sanitized one-location diff, reload and prove with
upstream evidence that the RFQ body did not reach Vercel. Access logging is off
and route error logging is suppressed because Nginx cannot reliably redact an
arbitrary query/body.

## 8. Route-only rollback without RFQ loss

1. Restore the recorded pre-cutover Nginx file so `/api/request` uses the prior
   upstream; run `nginx -t` and reload.
2. Leave PostgreSQL and its encrypted backups intact.
3. If SMTP/worker is healthy, leave `rfq-worker` running until every already
   committed row reaches `delivered`; the reverted browser route cannot create
   new local rows.
4. If worker/SMTP caused rollback, stop `rfq-worker`; pending/failed rows remain
   durable for an incident-approved retry. Never delete or replay them ad hoc.
5. Stop `rfq-intake` after the route is verified reverted.
6. Do not re-enable Make/Resend or copy local rows to Supabase without a
   separate explicit decision.

This rollback changes only the exact Nginx route and service state. It does not
change DNS, Vercel deployment, Product data or the committed local RFQs.

## 9. One synthetic E2E, separate authorization required

Do not execute this gate during preparation. After separate authorization,
submit exactly one browser-equivalent form through the canonical Production
host using the tag `RU-FIRST-E2E-<UTC timestamp> — НЕ ОБРАБАТЫВАТЬ`, a reserved
`.invalid` contact email, no real person, current consent
`rfq-consent-2026-09-17-v3`, current policy
`privacy-policy-2026-09-17-v3`, and `sourcePage=/request?token=must-not-persist`.

Acceptance, by returned UUID only:

1. API 200 occurs only after the local row is committed as `pending`.
2. Stored source is `/request`; raw IP, User-Agent, token, full URL and arbitrary
   query fields are absent.
3. Start/observe `rfq-worker`; exactly one message reaches the approved
   corporate mailbox through Yandex SMTP with deterministic
   `<rfq-{requestId}@cyber-medica.ru>` Message-ID.
4. Row becomes `delivered`; no chain, webhook or alternate transport runs.
5. Vercel request evidence contains no POST body/contact fields; Make, Resend,
   Supabase and analytics contain no test RFQ PII.
6. Journal and Nginx evidence contain none of the synthetic contact/message
   values. Store only UUID, timestamps, statuses and checksums in evidence.

No SMTP failure simulation, second RFQ or cleanup/deletion is authorized by
this single-test gate.

## 10. Target egress proof

The target runtime under `services/rfq-intake` imports PostgreSQL and
Nodemailer only. It contains no Vercel, Make, Resend, Supabase or webhook RFQ
transport. The exact Nginx route terminates before the generic Vercel upstream.

| Destination | RFQ PII in target | Proof boundary |
| --- | --- | --- |
| Local PostgreSQL RU | Yes, first write | transaction commits before HTTP 200 |
| Yandex 360 SMTP/mailbox | Yes, after commit | worker is the only delivery client |
| Vercel | No | exact Nginx bypass for `/api/request` |
| Make | No | no target transport/config/runtime import |
| Resend | No | no target transport/config/runtime import |
| Supabase | No | no RFQ runtime import/write |

## Final cutover stop conditions

- PostgreSQL is not exact major 17, not loopback-only, or externally reachable.
- Runtime role can delete, create schema objects, owns schema objects, or is a
  member of the owner role.
- Backup retention is unapproved or encrypted restore is unverified.
- `rfq-intake` or PostgreSQL is publicly reachable.
- TLS preflight fails or any preflight application data/email is sent.
- Nginx diff touches anything outside exact `/api/request`.
- Any RFQ PII reaches Vercel, Make, Resend, Supabase, analytics or logs.
- Legal/RKN/destruction approvals required by the owner remain open.
- The one-write synthetic E2E has not been separately authorized and passed.
