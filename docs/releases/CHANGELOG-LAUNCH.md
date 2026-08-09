# CyberMedica Launch Changelog

## 2026-08-09 — EndoMarket direct-source reconciliation v5 on Stage

- Audited all 42 new Product drafts against 38 direct EndoMarket Product pages
  and preserved 42 descriptions, 160 feature rows, 260 specification rows and
  151 clean media assignments in one machine-readable source-truth dataset.
- Applied one Stage-only bulk corrective with exact 42/42 content/media
  comparison and no use of previous generic corrective copy as authority.
- Bounded the Product Detail hero while keeping full descriptions below it and
  rendered complete EndoMarket feature sets without changing other Products.
- Passed 42/42 Product Detail Chromium coverage and responsive WebKit/iPhone
  checks without Production, lifecycle, migration, ENV or DNS changes.

## 2026-08-08 — EndoMarket Business/Content Corrective v2 on Stage

- Applied the supplied corrective JSON/CSV to all 42 Stage drafts without
  generated marketing copy or Production writes.
- Removed 67 EM/EndoMarket-watermarked files, retained 65 unique clean assets
  and excluded unsafe fallback cards from the homepage featured selection.
- Made catalog cards compact, split application tags, hid 12 empty Product
  Detail feature sections and preserved the approved commercial badges.
- Verified the exact eight featured Products and approved homepage/service copy
  across Chromium and WebKit, including 390×844 mobile evidence.
- Kept `main`, `production` and the Production deployment unchanged.

## 2026-08-05 — EndoMarket equipment catalog Stage integration

- Added 42 Preview drafts and nine existing Product bindings through the
  existing Cloud Preview repository; excluded 76 instruments and three chemical
  consumables.
- Added typed availability/installment presentation, 132 content-addressed
  source media files and the approved homepage partner-service benefit.
- Preserved Production Products, lifecycle, deployment, aliases and DNS.

## 2026-08-02 — Homepage visual and conversion polish

- Reframed Hero around medical-equipment selection and supply for healthcare
  organizations, with direct Catalog and Request actions.
- Added eight exact published-category deep links, four neutral trust points,
  a compact company block and one focused final RFQ action.
- Preserved the exact eight-Product carousel and resilient `cloud_published`
  transport without adding client dependencies or public data fetches.
- Passed five responsive homepage WebKit profiles, the three-profile carousel
  regression and the general three-profile/five-route iOS smoke.
- Preserved 79 Products, 71 Published, eight Unpublished, lifecycle
  `71/71/71/71`, projection 73 and 71 sitemap Product URLs.

## 2026-08-02 — Clickable featured Products carousel

- Replaced the static four-Product homepage grid with an accessible responsive
  carousel for eight exact Published Products.
- Kept selection on the existing resilient `cloud_published` data path; missing
  or non-public entries fail closed without substitution.
- Added native swipe/scroll snap, 44 px controls, keyboard navigation,
  reduced-motion support, whole-card canonical links and missing-image fallback.
- Added a responsive WebKit Production gate and before/after visual evidence.
- Preserved Production at 79 Products, 71 Published, eight Unpublished,
  lifecycle `71/71/71/71`, projection 73 and 71 sitemap Product URLs.

## 2026-08-02 — Group C Batch 3 content preparation

- Prepared and atomically patched seven exact draft Products through the
  approved Catalog Admin boundary.
- Deferred three Product-specific identity/media/manufacturer correctives and
  preserved all six prior special exclusions.
- Kept Production publication/lifecycle totals at `63/63/63/63` with no new
  public URL.

## Corporate Auth/RBAC — 2026-08-01

- `cybermedicaooo@gmail.com` закреплена как единственная default identity для
  новых Auth, Review, Git и deployment operations.
- Corporate Auth UUID получил exact Production profile role `admin`.
- Runtime login/SSR callback теперь fail-closed требует corporate identity и
  live `admin`/`reviewer` profile через `auth.uid()` read contract.
- Legacy Product-specific review routes больше не могут создавать Decisions;
  исторические lifecycle records сохранены без перепривязки.

## CyberMedica Production Launch — 2026-07-29

- Launch scope: public Storefront with Hamilton-T1 as the only published Product.
- Deployed commit: `201845a3fe5caab23ab72d31ac70d5704c53e1e4`.
- Production deployment: `dpl_HVumG217appC2rJDbzoH4J5uJ43u`.
- Production database baseline: 26 migrations, latest `202607290003`, projection
  version 3; the live ledger and counts are preserved in the canonical launch
  baseline as prior controlled evidence.
- Hamilton-T1 revision, Human Review, approval, publication batch and checksum
  evidence are recorded in the launch baseline.
- Projection corrective work and Hamilton storefront projection completeness are
  part of the accepted launch chain.
- Production ENV binds the public source to `cloud_published`; service-role
  values remain server-only and are not documented.
- Canonical domain: `https://cyber-medica.ru`; `www` permanently redirects to
  the apex; TLS and mail records were retained through the DNS cutover.
- Public smoke: canonical HTTPS, Catalog, Hamilton Product Detail,
  characteristics, media and RFQ HTTP contract PASS.
- Post-launch operational baseline (2026-07-30): fresh backup and isolated
  restore PASS; one canonical-domain test RFQ reached the confirmation page
  and the configured webhook accepted it; read-only monitoring baseline PASS.
- Fresh backup: `production-postlaunch-clbzibuusyuajsylcbvl-20260729T212955Z`;
  artifact hashes and restore evidence are recorded in the post-launch
  operational report.
- The local publication-candidate QA runner now derives the terminal migration
  dynamically and recognizes `202607290003` without weakening its contract
  checks.
- Controlled indexing activation (2026-07-30): Production robots now allows
  public crawling while disallowing internal, Auth, API, admin, diagnostic and
  legacy knowledge surfaces. Sitemap is generated from the published
  projection only; Hamilton-T1 is the sole Product URL.
- RFQ confirmation polish (2026-07-30): `/thanks` now uses one compact,
  accessible confirmation state and one primary return-to-catalog action. The
  obsolete Knowledge Base action was removed from this page only; the RFQ API,
  Product binding and indexing contract remain unchanged.
- Canonical Thank You reconciliation (2026-07-30): the already-deployed
  `a697473e057a8ffe945c22fc364ca922bd1e13bb` was fast-forwarded into both
  `main` and `production`; no new deployment or database write was performed.
- Second-product curation (2026-07-30): all 78 unpublished Production
  Products were audited read-only. No Product was published; Mindray SV300 was
  selected for the next content-preparation pass.
- Mindray SV300 content preparation (2026-07-30): one authorized atomic
  Catalog Admin patch synchronized the Product and canonical Russian
  description, set the confirmed model, added source-grounded SEO, and removed
  unsupported active claims. The Product remains draft/unpublished; no
  revision, Review, Approval or Publication was executed. See [Mindray SV300
  Content Preparation](../reports/mindray-sv300-content-preparation-2026-07-30.md).
- Mindray SV300 publication (2026-07-30): one exact immutable revision passed
  Human Review, Approval and single-Product Publication. Production now has 2
  published Products and 77 unpublished Products; Hamilton-T1 and Mindray
  SV300 are the only public Products. See [Mindray SV300 Publication](../reports/mindray-sv300-publication-2026-07-30.md).
- Third-product selection (2026-07-30): all 77 unpublished Products were
  audited read-only. A five-Product shortlist was prepared, but every Product
  retains the structural `missing_model` blocker, so no third Product was
  selected and no lifecycle write was performed. See [Third Product
  Selection](../reports/third-product-selection-2026-07-30.md).
- Agilia SP MC content preparation (2026-07-30): Product Owner selected
  Fresenius Kabi Agilia SP MC as the third Product. One approved atomic Catalog
  Admin patch set the exact model, synchronized canonical Russian content and
  added source-grounded SEO. The Product remains draft/unpublished; no revision,
  Human Review, Approval or Publication was executed. See [Agilia SP MC Content
  Preparation](../reports/agilia-sp-mc-content-preparation-2026-07-30.md).
- Agilia SP MC publication (2026-07-30): exact immutable revision 1 passed one
  authenticated Human Review, Approval and single-Product Publication.
  Production now has 3 published Products and 76 unpublished Products; the
  public projection and sitemap contain only Hamilton-T1, Mindray SV300 and
  Agilia SP MC. See [Agilia SP MC Publication](../reports/agilia-sp-mc-publication-2026-07-30.md).
- Remaining catalog batch audit (2026-07-30): all 76 unpublished Products were
  inventoried read-only. No model was accepted without authoritative source
  evidence, so all remain Group C pending identity resolution; no patch,
  revision, review, approval or publication write was performed. See
  [Remaining Catalog Batch Preparation](../reports/remaining-catalog-batch-preparation-2026-07-30.md).
- Authoritative model resolution (2026-07-31): official manufacturer and
  documentation checks resolved 33 Products to High confidence, placed 7 in a
  short Product Owner decision queue and left 36 unresolved. No Product or
  lifecycle write was performed. See [Authoritative Model
  Resolution](../reports/remaining-catalog-authoritative-model-resolution-2026-07-31.md).
- Group A validation (2026-07-31): all 33 model-resolved candidates passed
  automated image URL checks, but exact visual model matching and claims review
  remain open. Final A1 is 0; no patch, revision, review, approval or
  publication write was performed. See [Group A Batch Content
  Preparation](../reports/group-a-batch-content-preparation-2026-07-31.md).
- Group A revised batch execution (2026-07-31): Product Owner policy accepted
  media without explicit contradiction, removed uncertain imported claims and
  treated missing registration as a warning. All 33 High-confidence Products
  received atomic Catalog Admin patches and immutable revision 1. No Human
  Review, Approval or Publication was performed. See [batch execution](../reports/group-a-minimal-batch-execution-2026-07-31.md)
  and [revision run](../reports/group-a-minimal-revision-run-2026-07-31.md).
- Generic Publication Review Queue (2026-07-31): added generic
  `/internal/review` and `/internal/review/[revisionId]` routes with existing
  authenticated access and cloud_api reads. The queue was deployed and used for
  the exact Group A Human Review decisions recorded by the lifecycle evidence.
- Resolved Group B six (2026-07-31): Product Owner accepted all seven closed
  decisions. Six exact Products received atomic canonical-content patches and
  immutable revision 1; all six await manual Human Review. Instilar 1438 was
  excluded as a likely duplicate of Instilar 1428 and remains lifecycle
  `0/0/0/0`. Published remains 36.
- Catalog Publication Wave 1 (2026-07-31): ten exact reviewed revisions were
  approved and published through a narrow server-only, service-role runner.
  Production now contains 13 Published and 66 Unpublished Products; projection
  version is 15 and sitemap contains exactly 13 Product URLs. The remaining 23
  reviewed revisions retain zero Approval and zero Publication Batch. See
  [Wave 1 closure](../reports/catalog-publication-wave-1-2026-07-30.md).
- Catalog Publication Wave 2 (2026-07-31): fifteen additional reviewed
  revisions were approved and published through a new immutable manifest and
  narrow server-only runner. Production now contains 28 Published and 51
  Unpublished Products; projection version and sitemap Product count are 30
  and 28. Replay returned already complete without duplicate writes. See
  [Wave 2 closure](../reports/catalog-publication-wave-2-2026-07-31.md).
- Catalog Publication Wave 3 (2026-07-31): the final eight reviewed Group A
  revisions were approved and published through a separate immutable manifest
  and narrow server-only runner. Production now contains 36 Published and 43
  Unpublished Products; projection version and sitemap Product count are both
  38 and 36 respectively. Replay returned already complete. See
  [Wave 3 closure](../reports/catalog-publication-wave-3-2026-07-31.md).
- Resolved Group B publication (2026-07-31): six Product Owner-resolved
  Products completed manual Human Review and were approved and published through
  the immutable `group-b-six-publication-v1` manifest and narrow server-only
  runner. Production now contains 42 Published and 37 Unpublished Products;
  projection version and sitemap Product count are 44 and 42. Replay returned
  already complete. Instilar 1438 remains draft with lifecycle `0/0/0/0`. See
  [publication closure](../reports/group-b-six-publication-2026-07-31.md).
- Group C remediation Batch 1 revisions (2026-08-01): a narrow Production-only
  runner created and idempotency-verified immutable revision 1 for eight exact
  Products. The corporate Review Queue now contains eight pending items;
  Published remains 42 and no Review, Approval or Publication was performed.
  See [revision creation](../reports/group-c-remediation-batch-1-revision-creation-2026-08-01.md)
  and [queue checkpoint](../reports/group-c-remediation-batch-1-review-queue-2026-08-01.md).
- Group C remediation Batch 1 publication (2026-08-01): all eight exact
  revisions completed corporate Human Review, Approval and Publication through
  the immutable `group-c-batch-1-publication-v1` manifest. Production now has
  50 Published and 29 Unpublished Products; projection version and sitemap
  Product count are 52 and 50. Replay returned already complete and excluded
  Products remain unchanged. See [publication closure](../reports/group-c-remediation-batch-1-publication-2026-08-01.md).
- Group C remediation Batch 2 content preparation (2026-08-02): selected 15
  Low-risk, High-confidence Products and applied 13 exact atomic Catalog Admin
  patches. `Гемос` and `Гемос-ПФ` were stopped before write because their base
  type characteristics are cross-contaminated outside the approved patch
  contract. The 13 patched Products passed dependency and deterministic
  candidate preflight; no revision, Review, Approval or Publication was
  executed. Production remains 50 Published and 29 Unpublished Products. See
  [selection](../reports/group-c-remediation-batch-2-selection-2026-08-02.md)
  and [patch evidence](../reports/group-c-remediation-batch-2-patch-2026-08-02.md).
- Group C remediation Batch 2 revision creation (2026-08-02): the closed
  `group-c-batch-2-revision-creation-v1` manifest created and replay-verified
  13 immutable revision 1 records and matching Review Items. Production remains
  50 Published; new Decisions, Approvals and Publication Batches remain zero.
  `Гемос` and `Гемос-ПФ` remain excluded for a narrow characteristics
  corrective. See [revision evidence](../reports/group-c-remediation-batch-2-revision-creation-2026-08-02.md)
  and [Review Queue checkpoint](../reports/group-c-remediation-batch-2-review-queue-2026-08-02.md).
- Group C remediation Batch 2 publication (2026-08-02): all thirteen exact
  revisions completed corporate Human Review, Approval and Publication through
  the immutable `group-c-batch-2-publication-v1` manifest. Production now has
  63 Published and 16 Unpublished Products; projection version and sitemap
  Product count are 65 and 63. Replay returned `already_complete`; excluded
  corrective Products remain draft with lifecycle `0/0/0/0`. See
  [publication closure](../reports/group-c-remediation-batch-2-publication-2026-08-02.md).
- Group C remediation Batch 3 revision creation (2026-08-02): the closed
  `group-c-batch-3-revision-creation-v1` operation created and replay-verified
  seven immutable revision 1 records and Review Items. Published remains 63;
  Decisions, Approvals and Publication Batches remain 63. The corporate generic
  Review Queue contains the exact seven pending records. See
  [revision evidence](../reports/group-c-remediation-batch-3-revision-creation-2026-08-02.md)
  and [queue checkpoint](../reports/group-c-remediation-batch-3-review-queue-2026-08-02.md).
- Group C remediation Batch 3 publication (2026-08-02): all seven exact
  revisions completed corporate Human Review, Approval and Publication through
  the immutable `group-c-batch-3-publication-v1` manifest. Production now has
  70 Published and 9 Unpublished Products; projection version and sitemap
  Product count are 72 and 70. Replay returned `already_complete`; the nine
  special corrective Products remain draft with lifecycle `0/0/0/0`. See
  [publication closure](../reports/group-c-remediation-batch-3-publication-2026-08-02.md).
- Final-nine special correctives (2026-08-02): all nine remaining draft
  Products were re-audited. One stale-protected Catalog Admin patch resolved
  ИДН-03 from official Rostec/Shvabe/UOMZ evidence, synchronized canonical
  Russian content and added SEO. It remains draft with lifecycle `0/0/0/0` and
  deterministic revision preflight PASS. No other Product, media,
  characteristic, lifecycle record or public projection changed. See the
  [corrective audit](../reports/final-nine-special-correctives-2026-08-02.md).
- ИДН-03 immutable revision (2026-08-02): the corporate-only, digest-bound
  runner created and replay-verified revision
  `5801cde4-9341-4fe9-9e35-da47627754f9` and Review Item
  `a0654fd4-d65f-450d-b8ed-2270408fdcbe`. Production remains 70 Published;
  no Human Review, Approval or Publication was performed. See the
  [revision report](../reports/idn-03-revision-creation-2026-08-02.md).
- ИДН-03 publication and transport resilience (2026-08-02): exact corporate
  Decision `9b06ac1b-2108-40fa-96ac-ed7a8fc64fdb` was durably verified; the
  one-Product runner created Approval `bc04a144-b3e8-4eae-a7d8-b4281ec35bd2`
  and Publication Batch `99664f26-515b-40bc-90f0-f8d439fb33c4`. Production
  now has 71 Published and 8 Unpublished Products, projection version 73 and
  71 sitemap Product URLs. Public catalog reads now use bounded retry,
  validated last-known-good fallback, sanitized health diagnostics, corporate
  synthetic monitoring and mandatory WebKit fault-injection gates. See the
  [resilience and publication report](../reports/published-catalog-transport-resilience-2026-08-02.md).

See [Production Launch Baseline](../reports/production-launch-baseline-2026-07-29.md)
and [Production Launch Evidence Index](../reports/production-launch-evidence-index-2026-07-29.md).
See [Post-Launch Operational Baseline](../reports/post-launch-operational-baseline-2026-07-30.md).
See [Controlled Indexing Activation](../reports/controlled-indexing-activation-2026-07-30.md).
# 2026-08-02 — Published Catalog transport resilience

- Added bounded Published Catalog retry/timeout and validated LKG fallback.
- Added sanitized catalog health diagnostics and correlation logging.
- Added WebKit/iPhone transport-failure regression and Production synthetic
  monitoring under the corporate CyberMedica identity.
- Added exact corporate-only IDN-03 Approval/Publication runner; durable
  publication evidence is recorded after Production PASS.

# 2026-08-09 — Global catalog master corrective v7 (Stage only)

- Audited all 114 visible Stage Products and permanently rejected unresolved
  React Flight description tokens at the published-catalog capture boundary.
- Restored exactly one separate HD-550 Stage draft while preserving the 71
  published identities and the 42 direct EndoMarket drafts.
- Preserved complete raw source truth and added concise evidence-traced
  presentation features for all 42 imported Products.
- Replaced Product Detail thumbnails with a compact accessible carousel and
  verified desktop, responsive Chromium and WebKit/iPhone layouts.
- No Production, lifecycle, migration, `main` or `production` change was made.
