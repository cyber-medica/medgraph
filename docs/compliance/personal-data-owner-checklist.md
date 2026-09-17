# Personal data owner checklist

Internal owner-only checklist for the CyberMedica RFQ flow. This document is
not public legal advice and must not be exposed as a storefront route.

## Regulatory record

- [ ] Verify the record for ООО «КИМ», ИНН 9102256625, in the official register
  of personal-data operators.
- [ ] Verify or update the operator notification so that its purposes, subject
  categories, personal-data categories, processing methods, database location
  and cross-border information match the approved operating model.
- [ ] Preserve official evidence of the record and any submitted updates.

## Governance

- [ ] Appoint, by a real signed internal order, the person responsible for
  organizing personal-data processing.
- [ ] Approve an internal local act for each processing purpose.
- [ ] Document the list of persons with RFQ access and review it periodically.
- [ ] Approve a process for answering data-subject requests and consent
  withdrawals.
- [ ] Approve and exercise an incident-response procedure.
- [ ] Do not create placeholder orders, signatures or responsible-person names.

## Retention and destruction

- [ ] Select and approve the final RFQ retention period.
- [ ] Define when the period starts and how the last substantive interaction is
  identified.
- [ ] Approve deletion and destruction procedures for the primary database,
  corporate mailbox and operational copies.
- [ ] Define how encrypted backups expire and how subject requests affect them.
- [ ] Record auditable, non-PII destruction evidence.

## Processors and location evidence

- [ ] Preserve evidence that the Timeweb VPS and any RFQ backup location are in
  the Russian Federation.
- [ ] Preserve the applicable Timeweb contract and data-processing terms.
- [ ] Preserve the ООО «КИМ» Yandex 360 agreement, invoice/offer and applicable
  data-processing terms or DPA.
- [ ] Confirm the legal entities, instructions, access scope and storage
  locations for every processor before legal acceptance.

## Release gate

- [ ] Replace `OWNER_RETENTION_DECISION_REQUIRED` with an owner-approved term.
- [ ] Assign a new consent/policy version and regenerate the consent SHA-256 if
  the approved legal text changes materially.
- [ ] Complete the official RKN owner check.
- [ ] Obtain owner/legal approval for the final public consent and policy.
- [ ] Verify that Production routing implements the documented RU-first RFQ
  flow before making these documents effective.
