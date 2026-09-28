# RFQ RU-first intake + SMTP exit — implementation report

Date: 2026-09-17. Status: Draft implementation only; not deployed.

## Architecture delta

Draft PR #6 already provides loopback intake, transactional PostgreSQL primary
persistence, claim/lease/retry state, snapshot-backed Product resolution,
safe logging and an exact Nginx route plan. This child revision changes only the
post-commit notification transport:

```text
Before (Draft, never deployed): local worker → Make → Resend → mailbox
Target:                         local worker → Yandex 360 SMTP → mailbox
```

No fallback webhook transport remains selectable in target runtime. Vercel is
not involved in target `POST /api/request`; PostgreSQL remains the sole system
of record.

## SMTP implementation

- Added pinned `nodemailer@10.0.10` as the only new runtime dependency.
- Host is restricted to `smtp.yandex.ru`.
- Supports port 465 implicit TLS and port 587 mandatory STARTTLS.
- Credentials, sender, recipient and optional reply-to are environment-only.
- Plain and escaped HTML alternatives are rendered locally after commit.
- No remote assets, file loading, URL loading, tracking pixel or attachment.
- SMTP debug logging is disabled and error output is reduced to a safe class or
  numeric SMTP response code.
- Addresses are strict single-mailbox values; CR/LF and lists are rejected.
- The subject and Message-ID derive only from a validated request UUID.

Message-ID contract:

```text
<rfq-{requestId}@cyber-medica.ru>
```

Delivery remains **at-least-once with duplicate mitigation**. The row lease,
delivered-state exclusion and stable Message-ID reduce duplicates but SMTP is
not represented as exactly-once.

## Data minimization

The email contains the operational RFQ fields, validated Product context,
pathname-only source, allowlisted UTM/yclid, request ID and timestamp. It does
not add raw IP, User-Agent, full source URL, query string or arbitrary query
parameters. Logs contain no contact fields, message, mail body, envelope or
credentials.

## Validation results

Results from the isolated child branch:

- Targeted RFQ/SMTP tests: PASS, 20/20.
- Full tests: PASS, 742/742. The first sandboxed run had one environment-only
  `listen EPERM`; the identical suite passed outside the restricted listener
  sandbox.
- PostgreSQL 17 integration: PASS against an ephemeral loopback-only local
  container. Commit, duplicate rollback, claim and `delivered` state passed;
  the synthetic row and container were removed afterward.
- ESLint: PASS.
- TypeScript (`tsc --noEmit`): PASS.
- Production build: PASS with Next.js 16.2.9/Turbopack; the catalog reliability
  prebuild gate also passed 8/8.
- Secret/privacy signature scan: PASS, 0 credential/private-key signatures in
  added content.
- Target runtime scan: PASS; no Make client, Resend endpoint, webhook ENV or
  Vercel delivery endpoint remains in `services/rfq-intake`.
- `git diff --check`: PASS.
- Dependency audit: `nodemailer@10.0.10` has no runtime dependencies and was
  not reported by `npm audit`. The root tree retains five pre-existing findings
  in the unchanged Next.js build chain; no dependency upgrade was mixed into
  this scoped change.

No SMTP authentication or email send is part of branch validation.

## Rollout and rollback

The controlled rollout remains gated on Yandex 360 account/contract evidence
for ООО «КИМ», DPA retention, Timeweb VPS/backup Russian-location evidence,
manual VPS-only SMTP credentials, verified database restore, TLS preflight and
one separately authorized synthetic E2E.

Rollback restores only the previous Nginx `/api/request` route, stops the local
worker and retains the local database. It does not automatically re-enable the
historical foreign PII path.

## Production invariance

- Production/VPS/Nginx/DNS/Vercel/Supabase writes: 0.
- PostgreSQL installation or migration execution: 0.
- SMTP credentials created: 0.
- Email/RFQ test submissions: 0.
- Make/Resend scenario changes: 0.
- Product/catalog/lifecycle writes: 0.
- PR #5 changes: 0.
- Merge/deploy: not performed.

## Target decision

- Vercel receives RFQ PII: **NO**.
- Make receives RFQ PII: **NO**.
- Resend receives RFQ PII: **NO**.
- Yandex SMTP is the only email transport: **YES**.
- Russian PostgreSQL write occurs before email: **YES**.
- Primary persistence is local Russian PostgreSQL: **YES**.
- Cross-border RFQ PII is removed from target design: **YES**.
