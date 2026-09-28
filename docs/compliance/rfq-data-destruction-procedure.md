# RFQ data deletion and destruction procedure v1

**Status:** internal draft; documentation only. This procedure does not enable
automatic deletion and does not authorize a Production run.

**Operator:** Общество с ограниченной ответственностью «Кибермедика»
(ООО «КИМ»).

**Retention rule:** personal data for an RFQ that has not led to contractual
relations is retained for no more than 365 calendar days from the last
substantive interaction concerning that RFQ. If the RFQ has led to contractual
relations, this RFQ rule is not the sole storage basis; applicable contractual,
accounting, tax and other lawful bases determine further processing and
retention.

This is an operational control document, not legal advice. Every run requires
an authorized owner/operator decision. `RFQ RETENTION ENFORCEMENT v1` remains a
separate future implementation and release task.

## 1. Scope

The procedure applies to every copy of RFQ personal data controlled by ООО
«КИМ», including:

- the primary PostgreSQL `public.rfq_leads` rows on the approved Russian VPS;
- encrypted PostgreSQL backups, snapshots and backup manifests;
- operational RFQ email copies in the approved Yandex 360 corporate mailbox,
  including Sent, Inbox, Trash/Deleted and provider-retained copies where the
  provider exposes or documents them;
- authorized exports, support copies, administrator downloads, temporary
  maintenance files and other operational copies, if any exist.

Application analytics, delivery counters and non-PII destruction evidence are
not RFQ copies, provided they cannot identify or be linked to a data subject.
If an operational inventory discovers personal data in logs or analytics, that
copy enters this procedure and is treated as an incident/gap rather than as
expected processing.

## 2. Definitions

### Last substantive interaction

The latest meaningful contact about the specific RFQ: a reply, clarification
of the technical specification, delivery of a quotation, discussion of terms,
or another substantive action concerning the request.

The following do **not** extend the retention period:

- automatic notifications;
- technical retries;
- email delivery status;
- page views;
- analytics events.

The current `rfq_leads.updated_at`, delivery timestamps and delivery status
cannot be used as the retention clock because worker retries and delivery state
changes are technical events. Until an approved implementation records
`last_substantive_interaction_at`, the operator must establish the date for
each exact RFQ from verified business correspondence and record it in the
restricted approval manifest.

### Contractual carve-out

An RFQ that has led to contractual relations is excluded from deletion under
the standalone 365-day RFQ rule while contractual, accounting, tax or another
documented lawful basis requires further processing. The applicable basis,
scope and expiry must be confirmed for the exact RFQ; the carve-out is not a
blanket indefinite-retention flag.

### Legal hold or other lawful basis

A documented, owner-approved reason that temporarily prevents deletion or
requires limited continued processing, including an active dispute, binding
authority request or another applicable lawful basis. The record must identify
the responsible decision maker, scope, start date and review/expiry date.

### Due for deletion

An exact RFQ is due for deletion only when all of the following are true:

1. 365 calendar days have elapsed since its verified last substantive
   interaction;
2. it has not led to contractual relations, or every applicable further basis
   has expired;
3. no active legal hold or other lawful basis applies;
4. the owner/operator has approved deletion of the exact lead ID and all known
   operational copies.

## 3. Roles and access

- The runtime application account must not have `DELETE` on `rfq_leads`.
- Deletion is performed only by a separately authorized maintenance/admin role
  under an approved change window. Its credential must not be placed in the
  repository, application environment or destruction evidence.
- One authorized operator prepares the dry run. The owner or a separately
  authorized approver reviews the exact candidate set, exclusions and lawful
  bases before execution.
- Mailbox and backup actions are performed only by roles authorized for those
  systems. Access is limited to the duration and scope of the run.

## 4. Pre-run inventory and approval

Before any deletion:

1. Assign a unique procedure run ID and freeze the evaluation timestamp.
2. Record the applied rule/version, cutoff date and current approved backup
   retention policy.
3. Inventory the primary row, mailbox copies, backups and any known operational
   copies for each candidate.
4. Establish the last substantive interaction from verified business evidence.
5. Check the contractual carve-out, legal hold and every other lawful basis.
6. Produce a restricted, RU-hosted approval manifest containing the exact lead
   IDs and copy locations. Do not put names, phone numbers, email addresses,
   message text or other RFQ content in the manifest.
7. Have the authorized approver sign off the exact manifest, candidate count,
   exclusions and run window.

An RFQ identifier can still be linkable data. The exact-ID approval manifest
is therefore access-restricted, encrypted at rest, retained only for the
minimum approved operational period and never copied into the permanent
non-PII destruction log.

## 5. PostgreSQL process

### 5.1 Dry run

The dry run is read-only and must:

- select only the exact `rfq_leads.id` values evaluated under the frozen run
  timestamp;
- calculate eligibility from the verified substantive-interaction date, not
  from `updated_at`, delivery retries, `delivered_at` or analytics;
- exclude every RFQ with a contractual carve-out, active legal hold or other
  continuing lawful basis;
- report candidate and excluded counts without printing contact fields,
  message, Product text, attribution or consent payloads;
- generate a query/configuration fingerprint so the approved selection can be
  matched to the execution.

The current schema does not contain an authoritative
`last_substantive_interaction_at`, contractual-basis flag or legal-hold field.
Therefore an automated database-only selection is not authorized by this
document. Before automation, `RFQ RETENTION ENFORCEMENT v1` must introduce an
approved, auditable representation of those decisions.

### 5.2 Approval gate

The approver checks:

- every exact lead ID in the restricted manifest;
- the verified last substantive interaction and 365-day calculation;
- contractual/accounting/tax status;
- legal holds and subject-request status;
- mailbox and operational-copy inventory;
- the applied rule version and query/configuration fingerprint.

Any ambiguity removes that RFQ from the run. Approval must not be inferred from
silence or from a previous run.

### 5.3 Deletion transaction

The authorized maintenance role performs one controlled transaction:

1. lock and re-read only the approved exact IDs;
2. revalidate eligibility and abort the whole transaction on count, state or
   exclusion drift;
3. delete only the approved rows;
4. compare the affected-row count with the approved count;
5. roll back on any mismatch; otherwise commit once.

No broad date-only `DELETE`, wildcard selection or partial best-effort run is
permitted. The deletion command and terminal output must not return or log RFQ
content. A schema or maintenance change that requires a backup may use only an
approved encrypted backup located in Russia and governed by the backup rules
below. Do not create an indefinite special backup merely to precede deletion.

### 5.4 Verification

After commit, a read-only exact-ID check must confirm that zero approved IDs
remain in `rfq_leads`. Verification records only counts and success/failure.
The operator also confirms that runtime grants still exclude `DELETE` and that
no unrelated rows changed.

## 6. Encrypted backup process

- Every PostgreSQL backup must have a documented creation time, encrypted
  storage location in Russia, finite owner-approved retention window and
  deterministic expiry time.
- Indefinite backup retention is prohibited. The exact backup window and
  deletion mechanism must be approved before controlled rollout.
- An RFQ deleted from the live database may remain only in already-existing
  encrypted backups until those backups reach their approved expiry. Access
  remains restricted and restoration is allowed only for an authorized
  recovery purpose.
- Expired backup objects, replicas and associated recoverable copies must be
  removed according to the storage provider's verified deletion semantics.
  The run log records only the number of expired backup objects and result, not
  filenames that expose RFQ identifiers.
- Any restored backup must be isolated from Production access, and the current
  deletion rules and completed-deletion register must be reapplied before the
  restored data becomes operational. A deleted RFQ must not be resurrected by
  restore.
- Backup expiry evidence must distinguish logical deletion from provider-level
  physical destruction when the provider does not confirm immediate physical
  erasure.

## 7. Yandex 360 mailbox process

1. Locate the corresponding operational message copies using the deterministic
   RFQ identifier where possible. The target SMTP design uses the stable
   Message-ID `<rfq-{requestId}@cyber-medica.ru>`; use it before searching by
   personal-data fields.
2. Confirm that the message belongs to an approved exact RFQ and is not needed
   under a contractual carve-out or legal hold.
3. Delete applicable Inbox, Sent, forwarded and other operational copies in
   mailboxes controlled by ООО «КИМ».
4. Empty or process Trash/Deleted according to the approved mailbox procedure.
5. Record the action as counts only. Do not copy subject, sender, recipient,
   body, attachment or search result into the destruction log.
6. Verify the provider's documented Trash, recovery and backup-retention
   behavior. Do not claim immediate physical destruction unless Yandex
   contract/documentation confirms it. If residual provider retention cannot
   be verified, record an owner-check exception and the expected expiry.

Automatic notification and delivery timestamps do not extend RFQ retention.
Mailbox deletion failure does not justify marking the entire run successful;
it is recorded as a scoped failure requiring remediation.

## 8. Other operational copies

The operator inventories and removes due RFQ copies from authorized exports,
temporary maintenance files, administrator downloads and other controlled
working locations. If a copy is found on an unapproved system, stop that part
of the run, preserve non-PII incident evidence and escalate it under the
personal-data incident procedure. Do not move the PII into another system for
diagnosis.

Temporary exact-ID manifests and maintenance artifacts are removed after
verification and expiry of their minimum approved operational period. Logs are
checked for accidental names, phone numbers, email addresses, message text and
other PII; expected application and proxy logging must remain PII-free.

## 9. Data-subject request flow

1. Register the request in the approved restricted channel without placing PII
   in general-purpose logs or issue trackers.
2. Verify identity proportionately and collect no more data than necessary.
   Do not disclose whether a record exists before verification.
3. Locate records across PostgreSQL, mailbox, backups and operational-copy
   inventory.
4. Determine the applicable purpose, consent status, contractual carve-out,
   legal hold and other lawful bases for each copy.
5. Delete or destroy data where applicable. Where continued storage is
   required, restrict/block processing to the permitted purpose and document
   the basis and review date.
6. Apply the backup rule: prevent operational restoration of deleted data and
   allow encrypted backups to expire under the approved finite window unless a
   stricter approved action is required.
7. Provide the response through the verified channel within the applicable
   owner/legal process.
8. Record only non-PII action evidence; do not reproduce the request or RFQ
   contents in the permanent destruction log.

Withdrawal of consent does not end processing that continues on another
documented lawful basis, but it must stop processing that relies only on the
withdrawn consent.

## 10. Contractual and legal-hold review

- Contract/accounting/tax records are excluded from the automatic RFQ deletion
  decision until each applicable basis expires.
- Only the data needed for the continuing basis may remain; unrelated RFQ data
  is not retained merely because some contract record exists.
- Each exclusion has a responsible owner and review/expiry date. Open-ended
  exclusions require periodic documented review.
- When the final basis expires, the RFQ re-enters the due-for-deletion process
  and requires a fresh dry run and approval.

## 11. Safety and rollback boundaries

- No mass deletion without a dry run and exact-ID approval.
- No `DELETE` privilege for the runtime application account.
- No manual Production deletion using an application or shared credential.
- No PII in console output, monitoring, tickets, pull requests, screenshots or
  permanent destruction evidence.
- No backup, export or rollback copy outside an approved Russian location.
- No retry after a mismatch until the candidate set is regenerated and
  reapproved.
- Database rollback is allowed only before transaction commit. After a valid
  committed destruction, restoring deleted PII solely to undo the deletion is
  prohibited unless an authorized lawful basis and incident decision require
  it.

## 12. Non-PII destruction evidence

Each run produces one append-only evidence record with exactly operational
metadata:

| Field | Requirement |
| --- | --- |
| `procedure_run_id` | unique non-customer run identifier |
| `executed_at` | timestamp with timezone |
| `operator_role_ref` | authorized role/reference, not credentials |
| `records_affected` | aggregate count only |
| `rule_version` | retention/destruction procedure version applied |
| `result` | success, partial or failed |

The permanent evidence record must contain no names, phone numbers, email
addresses, messages, Product text, UTM/yclid, mailbox content, request IDs,
lead IDs or other customer identifiers. A partial or failed result includes
only a non-PII error class and aggregate affected/pending counts. Exact-ID
approval manifests remain separate, restricted and temporary.

## 13. Completion checklist

A run is complete only when:

- PostgreSQL verification reports zero approved IDs remaining;
- mailbox and operational-copy actions have completed or are explicitly
  recorded as scoped failures;
- backup expiry controls and restore re-deletion obligations are recorded;
- temporary artifacts have been removed under their approved lifecycle;
- the non-PII destruction evidence is written and independently reviewed;
- no unrelated RFQ, runtime grant or Production component changed.

`success` is allowed only when all in-scope live and operational copies were
processed and every provider-retained copy is covered by a verified finite
expiry. Otherwise the result is `partial` or `failed`.

## 14. Future implementation gate

`RFQ RETENTION ENFORCEMENT v1` is a separate future task and requires explicit
approval. It must, at minimum:

- add an auditable `last_substantive_interaction_at` mechanism;
- represent contractual basis, legal hold and their review/expiry dates;
- implement deterministic dry-run selection and exact-ID revalidation;
- preserve runtime-role denial of `DELETE`;
- enforce the approved finite backup lifecycle and restore re-deletion;
- support mailbox and operational-copy reconciliation;
- create only the non-PII evidence defined above;
- test cutoff boundaries, exclusions, drift, partial failures, restore and
  idempotent reruns.

This document does not create a deletion job, change PostgreSQL, contact the
mail provider or authorize any Production write.
