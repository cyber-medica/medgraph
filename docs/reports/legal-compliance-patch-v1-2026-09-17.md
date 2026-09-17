# Legal compliance patch v1 — Draft report

**Date:** 17 September 2026

**Base:** `d5e08a9982e44eefb0b7c4988f98b42029123c00`

**Branch:** `codex/legal-compliance-v1`

**Status:** Draft only; retention decision recorded, but not legally accepted
and not deployable while the RKN and remaining owner/legal gates are open.

## Scope

This patch separates RFQ consent from policy acknowledgement, creates a single
canonical consent source, records version/hash evidence, rejects stale client
versions, and aligns the draft public documents with the target RU-first RFQ
architecture. It does not change Production, VPS, Nginx, PostgreSQL, DNS,
Vercel Production, Supabase, Yandex settings or Product data.

## Consent evidence contract

- Consent version: `rfq-consent-2026-09-17-v3`
- Policy version: `privacy-policy-2026-09-17-v3`
- Canonical consent SHA-256:
  `64ee4e256c74b0e198a0dde95e3281172e46e8071ba787ddb57f1c81af49cb1d`
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

`RETENTION OWNER DECISION COMPLETE = YES`

For an RFQ that does not lead to contractual relations, personal data is kept
for no more than 365 calendar days from the last substantive interaction about
that RFQ. Once an RFQ leads to contractual relations, this RFQ rule is not the
sole storage basis; applicable contractual, accounting, tax and other lawful
bases determine further processing and retention.

«Последнее содержательное взаимодействие» means the latest meaningful contact
about the specific RFQ: a reply, clarification of the technical specification,
delivery of a quotation, discussion of terms, or another substantive action
concerning the request. Automated notifications, technical retries, email
delivery status, page views and analytics events do not extend the period.

After the applicable period expires, data must be deleted or destroyed unless
another lawful basis permits further processing. This patch deliberately does
not add an automatic deletion job. The implementation scope is documented as a
separate future task in `docs/roadmap/rfq-retention-enforcement-v1.md`.

## Owner checks

- Preserve the applicable ООО «КИМ» Yandex 360 agreement/invoice/offer and DPA.
- Preserve Russian-location evidence for Timeweb and the approved backup.
- Complete every action in
  `docs/compliance/personal-data-owner-checklist.md`.
- Approve and implement the separate destruction procedure for PostgreSQL,
  encrypted backups and corporate mailbox copies.
- Obtain legal/owner approval before release.

## RKN status

`RKN OPERATOR RECORD = UNKNOWN`

`RKN OWNER CHECK = BLOCKER`

`LEGAL ACCEPTANCE = BLOCKED`

The draft does not claim registration, a notification number or a confirmed
cross-border status.

`RKN OWNER CHECK COMPLETE = NO`

`LEGAL ACCEPTANCE READY = NO`

## Validation results

| Gate | Result |
| --- | --- |
| Targeted legal/RFQ/trust tests | PASS — 40/40 |
| Complete test suite | PASS — 755/755; existing loopback redirect test was rerun outside the filesystem/network sandbox after an initial sandbox-only `listen EPERM` |
| ESLint | PASS |
| TypeScript | PASS — `tsc --noEmit` |
| Next.js production build | PASS — Next.js 16.2.9 / Turbopack, 36 static pages generated; rerun outside the network sandbox after the initial sandbox-only Google Fonts fetch failure |
| Catalog reliability prebuild gate | PASS — 8/8 |
| Secret/privacy scan | PASS — no private-key, token or credential signature in the patch; no infrastructure-sensitive value rendered publicly |
| Diff whitespace | PASS — `git diff --check` |

## Decision

The code and documents may be reviewed in a Draft PR. They must not be merged
or deployed while the RKN owner check, owner/legal acceptance, production
architecture verification and retention-enforcement procedure remain open.
