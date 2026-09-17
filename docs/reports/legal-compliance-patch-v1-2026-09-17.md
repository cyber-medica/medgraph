# Legal compliance patch v1 — Draft report

**Date:** 17 September 2026

**Base:** `d5e08a9982e44eefb0b7c4988f98b42029123c00`

**Branch:** `codex/legal-compliance-v1`

**Status:** Draft only; not legally accepted and not deployable.

## Scope

This patch separates RFQ consent from policy acknowledgement, creates a single
canonical consent source, records version/hash evidence, rejects stale client
versions, and aligns the draft public documents with the target RU-first RFQ
architecture. It does not change Production, VPS, Nginx, PostgreSQL, DNS,
Vercel Production, Supabase, Yandex settings or Product data.

## Consent evidence contract

- Consent version: `rfq-consent-2026-09-17-v2`
- Policy version: `privacy-policy-2026-09-17-v2`
- Canonical consent SHA-256:
  `36b1e42389edfaa29413d759c0a253ad8597a9a832d5fdc48f13ae55b2091f36`
- Canonical source: `lib/privacy/legal-documents.ts`
- Server-only hash derivation: `lib/privacy/legal-document-hash.ts`
- PostgreSQL evidence: `consent_version`, `consent_text_sha256`,
  `policy_version`, `consent_at`
- Stale-version response: HTTP 409 with a refresh-and-resubmit instruction;
  persistence and delivery are not invoked.

The checkbox confirms consent only. The policy notice is separate and does not
create a second required checkbox.

## Target RFQ architecture reflected by the draft

```text
Browser
→ Timeweb/Nginx
→ local RFQ intake
→ PostgreSQL in Russia
→ local worker
→ Yandex 360 SMTP
→ corporate mailbox
```

The draft states that the primary RFQ record is created in an information
system located in the Russian Federation. It describes corporate email
neutrally. It does not present Vercel as RFQ storage and does not identify Make
or Resend as active RFQ processors for this form.

## Retention owner decision

No retention term is selected by this patch. The source intentionally contains
`OWNER_RETENTION_DECISION_REQUIRED`, which is a merge/release blocker.

### OPTION A

365 дней с даты последнего содержательного взаимодействия для RFQ, не
перешедшего в договорные отношения.

### OPTION B

Another period established and documented by the owner after the applicable
legal, operational and backup requirements have been assessed.

After the purpose is achieved or the approved period expires, deletion or
destruction must follow the procedure and time limits required by applicable
law. This patch does not add an automatic deletion job.

## Owner checks

- Preserve the applicable ООО «КИМ» Yandex 360 agreement/invoice/offer and DPA.
- Preserve Russian-location evidence for Timeweb and the approved backup.
- Complete every action in
  `docs/compliance/personal-data-owner-checklist.md`.
- Confirm the final retention term and destruction procedure.
- Obtain legal/owner approval before release.

## RKN status

`RKN OPERATOR RECORD = UNKNOWN`

`RKN OWNER CHECK = BLOCKER`

`LEGAL ACCEPTANCE = BLOCKED`

The draft does not claim registration, a notification number or a confirmed
cross-border status.

## Validation results

| Gate | Result |
| --- | --- |
| Targeted legal/RFQ/trust tests | PASS — 40/40 |
| Complete test suite | PASS — 755/755; existing loopback redirect test was rerun outside the filesystem/network sandbox after an initial sandbox-only `listen EPERM` |
| ESLint | PASS |
| TypeScript | PASS — `tsc --noEmit` |
| Next.js production build | PASS — Next.js 16.2.9 / Turbopack, 36 static pages generated |
| Catalog reliability prebuild gate | PASS — 8/8 |
| Secret/privacy scan | PASS — no private-key, token or credential signature in the patch; no infrastructure-sensitive value rendered publicly |
| Diff whitespace | PASS — `git diff --check` |

## Decision

The code and documents may be reviewed in a Draft PR. They must not be merged
or deployed while either the RKN owner check or retention decision remains
open.
