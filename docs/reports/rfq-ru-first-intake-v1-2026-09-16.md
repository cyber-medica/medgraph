# RFQ RU-first intake v1 — implementation report

Date: 2026-09-16. Status: Draft PR preparation only; no deployment or
infrastructure mutation.

## Delivered target implementation

- Loopback-only Node intake retaining the current multipart
  `POST /api/request` contract and user-facing error messages.
- Transactional local PostgreSQL primary persistence with consent evidence and
  durable delivery state.
- Post-commit Make worker with retry, locking and stable request-ID idempotency
  headers.
- Snapshot-backed, fail-closed Product context resolution without a Vercel or
  Supabase contact-data hop.
- HMAC rate-limit keys; raw IP/User-Agent are neither logged nor persisted.
- Pathname-only source/landing fields and six-parameter commercial attribution
  allowlist.
- Exact Nginx and hardened systemd rollout artifacts, not applied.
- SQL table/least-privilege contract, backup/restore gate, retention and subject
  deletion designs.

## Schema summary

`rfq_leads` stores the UUID, RFQ contact/message fields, canonical Product
context, pathname-only source, sanitized JSON attribution, consent/policy
versions and consent text hash, timestamps, and retry/delivery state. It stores
no raw IP, User-Agent, body, full URL or arbitrary query.

The application role needs `SELECT`, `INSERT` and column-scoped `UPDATE` for
delivery state. `PUBLIC` receives no table privileges. PostgreSQL and the HTTP
service are loopback-only.

## Verification scope

Targeted tests cover consent, local-first order, insert/commit failures, Make
failure/retry, query PII stripping, analytics allowlist, UUID response, rate
limit, honeypot, Nginx local routing and SQL safety. Full test/lint/typecheck/
build results are recorded after final execution below.

The retry mechanism is intentionally at-least-once. Production acceptance must
verify Make-side deduplication by `requestId`; headers alone are not evidence of
exactly-once email delivery.

## Validation results

- Targeted RFQ contract: PASS, 13/13.
- Full tests: PASS, 735/735. The first sandboxed run had one environment-only
  `listen EPERM`; the same suite passed outside the restricted network sandbox.
- ESLint: PASS.
- TypeScript (`tsc --noEmit`): PASS.
- Production build (Next.js 16.2.9, Turbopack): PASS. The sandboxed attempt could
  not reach Google Fonts; the same build passed with network access.
- PostgreSQL 17 integration: PASS against an ephemeral local container. The
  migration applied, committed row persisted, duplicate transaction rolled
  back to one row, and delivery state committed as `delivered`; the container
  was removed afterward.
- Catalog reliability prebuild gate: PASS, 8/8.
- Secret/privacy scan: PASS, 0 credential patterns in the new artifacts.
- `git diff --check`: PASS.
- Production dependency audit: the added `pg@8.23.0` path has no reported
  advisory. The root application baseline still reports five existing
  advisories (including the unchanged `next@16.2.9` chain); remediation is a
  separate dependency-upgrade decision and was not mixed into this P0 design.

## Production invariance

- Production/VPS/Nginx/DNS/Vercel/Supabase writes: 0.
- Product/catalog/lifecycle writes: 0.
- RFQ submissions: 0.
- PR #5 changes: 0.
- Merge/deploy: not performed.

## Decision

- Vercel receives RFQ PII in target design: **NO**.
- Russian DB write happens before Make: **YES**.
- Primary persistence defined: **YES**.
- LOCALIZATION P0 REMEDIATED IN TARGET DESIGN: **YES**, subject to the rollout
  gates (Russian provider-location evidence, verified backup restore,
  Make idempotency and controlled RFQ E2E) before Production cutover.
