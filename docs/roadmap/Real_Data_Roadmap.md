# Real Data Roadmap

**Status:** MVP-018 planning baseline  
**Scope:** staged enrichment of real medical device data

## Purpose

This roadmap describes how CyberMedica can grow from a small verified catalog to
a large real-data knowledge base without allowing unverified enrichment output
to become public truth.

The numbers below are planning targets. Each wave depends on review capacity,
document quality and safety checks.

## Production Launch Status — 2026-07-29

The first public launch is complete for the approved one-Product scope. The
roadmap below separates completed launch work from post-launch work. Every item
has an explicit launch-blocking flag.

| Roadmap item | Status | Блокирует запуск |
| --- | --- | --- |
| Supabase Production foundation | completed | Нет |
| ACL hardening | completed | Нет |
| RFQ foundation | completed | Нет |
| Catalog Admin concurrency | completed | Нет |
| Import baseline — 79 Products | completed | Нет |
| Hamilton-T1 curated content | completed | Нет |
| Revision / Human Review / Approval / Publication | completed for Hamilton-T1 | Нет |
| Published storefront projection | completed | Нет |
| Production ENV binding | completed | Нет |
| Production deployment | completed | Нет |
| DNS/TLS cutover | completed | Нет |
| Public launch | completed — Hamilton-T1 scope | Нет |
| Fresh post-launch backup after `202607290003` | completed — verified restore | Нет |
| Search-engine indexing setup | completed — controlled Production contract | Нет |
| Production monitoring and error review | completed — baseline recorded | Нет |
| Published Catalog LKG, WebKit gate and synthetic monitoring | completed — 2026-08-02 | Нет |
| Clickable featured Products carousel | completed — 8 Published Products, responsive WebKit PASS | Нет |
| Homepage visual and conversion polish | completed — responsive WebKit, category and RFQ flow PASS | Нет |
| EndoMarket equipment catalog Stage integration | Stage-ready — 42/42 direct-source reconciliation, 42 drafts and 9 existing bindings; Production review deferred | Нет |
| Final eight Product correctives | отложено по решению Product Owner | Нет |
| RFQ POST verification on canonical domain | completed — test-only | Нет |
| Mail delivery confirmation after DNS cutover | completed in pre-launch downstream gate | Нет |
| Merge/reconcile deployed launch commits into canonical branch | completed — fast-forward | Нет |
| Canonical Thank You reconciliation | completed — `main` and `production` aligned at `a697473e` | Нет |
| Read-only audit of remaining 78 Products | completed — closed shortlist recorded | Нет |
| Second Product content preparation — Mindray SV300 | completed | Нет |
| Mindray SV300 immutable revision, Human Review, Approval and Publication | completed — Production Published count 2 | Нет |
| Third Product content preparation — Fresenius Kabi Agilia SP MC | completed — model/content/SEO patch | Нет |
| Agilia SP MC immutable revision, Human Review, Approval and Publication | completed — Production Published count 3 | Нет |
| Remaining catalog batch audit | completed — 76 Products inventoried; model evidence pending; no lifecycle writes | Нет |
| Catalog Publication Wave 1 | not executed — Group A has 33 model-resolved candidates; content/media preparation pending | Нет |
| Authoritative model resolution — remaining 76 Products | completed — 33 High, 7 Product Owner decisions, 36 unresolved; content preparation next | Нет |
| Group A media/claims validation | in progress — 33 candidates require visual media and claim review; no patches | Нет |
| Group A revised minimal content batch | completed — 33 canonical patches and 33 immutable revisions; no Human Review or Publication | Нет |
| Generic Publication Review Queue | implemented — `/internal/review` and `/internal/review/[revisionId]`; deployment pending | Нет |
| Group A Human Review | ready — Product Owner decision required; no automatic Review | Нет |
| Internal Auth/RBAC corrective | backlog | Нет |
| Review Workspace | backlog | Нет |
| Catalog Admin evolution | backlog | Нет |
| Targeted Product Import Contract | backlog | Нет |
| Publication of remaining 78 Products | backlog | Нет |
| Richer technical characteristics | backlog | Нет |
| Thank You Page polish | completed — compact accessible confirmation | Нет |
| Hide Knowledge Base | completed on RFQ confirmation only | Нет |
| General responsive/UI polish | backlog | Нет |

The `Блокирует запуск` value describes the already-completed 2026-07-29 launch;
post-launch work must not be retroactively treated as a launch blocker.

## Wave 1: 50 Products

Goal: prove the enrichment pipeline on high-value categories.

Focus:

- ИВЛ;
- мониторы пациента;
- наркозные станции;
- HME / breathing circuit consumables;
- one or two representative devices from adjacent categories.

Manufacturer focus:

- Hamilton Medical;
- Mindray;
- Dräger;
- GE HealthCare;
- Philips;
- Ambu.

Exit criteria:

- every product has a stable identity candidate;
- official sources are ranked;
- documents are normalized;
- candidate characteristics have provenance;
- conflicts and missing data are visible;
- no compatibility claim is published without review;
- reviewers can move selected claims into the Verification workflow.

## Wave 2: 250 Products

Goal: expand category breadth while keeping document quality high.

Focus:

- more ИВЛ and monitoring lines;
- эндоскопия;
- УЗИ;
- инкубаторы;
- infusion and syringe pumps;
- aspirators and neonatal devices.

Manufacturer focus:

- SonoScape;
- Comen;
- SLE;
- Dixion;
- Fresenius Kabi;
- B. Braun;
- Intersurgical;
- Medtronic.

Exit criteria:

- category-specific critical fields are documented;
- Product Completeness Score is available for reviewer prioritization;
- source conflicts are grouped by product and characteristic;
- document discovery failures create retry tasks;
- publication remains a separate reviewer-approved action.

## Wave 3: 1000 Products

Goal: move from curated coverage to operational catalog scale.

Focus:

- complete key manufacturers within priority categories;
- add diagnostic systems, surgical equipment and accessories;
- improve analog and compatibility review workflows;
- introduce category-specific completeness thresholds.

Requirements before starting:

- stable artifact identity;
- reviewer queue capacity;
- conflict reporting;
- missing-field reporting;
- documented source policies per category;
- operational monitoring for enrichment failures.

Exit criteria:

- product families are consistently grouped;
- compatibility remains blocked until human review;
- analog suggestions are reviewer-authored or reviewer-approved;
- generated draft data remains clearly separated from published data.

## Wave 4: 5000+ Products

Goal: broad market coverage with mature governance.

Focus:

- large manufacturer catalogs;
- accessories and consumables;
- regional variants;
- historical product versions;
- tender-oriented search coverage.

Requirements before starting:

- scalable review operations;
- formal publication audit process;
- source re-check cadence;
- stale-document detection;
- duplicate and supersession workflows;
- legal review of public medical copy.

Exit criteria:

- publication pipeline can show provenance for all public facts;
- stale or superseded documents are visible to reviewers;
- public data can be rolled back or superseded safely;
- no generated candidate claim can reach public output without verification.

## Product Completeness Score

Use Product Completeness Score to prioritize reviewer work, not to publish.

Suggested weighting:

| Area | Weight |
| --- | ---: |
| Documents | 30% |
| Characteristics | 30% |
| Compatibility | 20% |
| Images | 10% |
| Sources | 10% |

The score answers: "Is this product ready for human review?" It does not answer:
"Is this product verified?"

## Product Priority Rules

Import first:

- products used in critical care;
- devices with frequent procurement demand;
- products where compatibility mistakes are costly;
- products with official documents available;
- categories already represented in CyberMedica;
- devices where a verified card would reduce engineer/procurement workload.

Defer:

- products without official documents;
- highly ambiguous distributor-only entries;
- products requiring new schema concepts;
- compatibility-heavy accessory sets until compatibility review is mature.

## Safety Gates

Every wave must preserve these gates:

1. Discovery can create candidates.
2. Extraction can create candidate characteristics.
3. Candidate claims remain unverified.
4. Human verification decides truth.
5. Publication decides public output.

If a wave cannot maintain these gates, the wave should stop before adding more
products.

## Post-launch execution queue — 2026-07-30

| Task | Блокирует запуск |
| --- | --- |
| Resolve `missing_model` for Agilia SP MC from an authoritative source | Нет |
| Generate Agilia SP MC SEO from confirmed facts | Нет |
| Create the Agilia SP MC immutable revision | Нет |
| Human Review, Approval and Publication of Agilia SP MC | Нет |

These tasks are post-launch work. They do not weaken structural invariants or
authorize automatic lifecycle writes.

## Post-launch catalog closure — 2026-07-31

| Task | Status | Блокирует запуск |
| --- | --- | --- |
| Publish 33 High-confidence Group A Products | Завершено | Нет |
| Resolve and publish six Product Owner-approved Group B Products | Завершено | Нет |
| Keep Instilar 1438 outside lifecycle pending dedup policy | В backlog | Нет |
| Remediate the remaining unresolved identities | Batches 1–3 published; nine special correctives remain | Нет |
| Complete corporate Human Review and publication for eight Group C Batch 1 revisions | Завершено — Production Published count 50 | Нет |
| Create 13 Group C Batch 2 immutable revisions | Завершено | Нет |
| Complete corporate Human Review and publication for Group C Batch 2 | Завершено — Production Published count 63 | Нет |
| Correct swapped Гемос / Гемос-ПФ type characteristics | Backlog, narrow data corrective required | Нет |
| Complete corporate Human Review and publication for seven Group C Batch 3 revisions | Завершено — Production Published count 70 | Нет |
| Complete corporate Human Review and later lifecycle for ИДН-03 | Завершено — Production Published count 71 | Нет |
| Resolve combined УНИКОС-02/03 execution | Product Owner decision required | Нет |
| Add narrow media/characteristic/reference correctives for six blocked rows | Backlog | Нет |
| Resolve Instilar 1438 regulatory mapping | Keep unpublished by policy | Нет |

Production contains 71 Published and 8 Unpublished Products. Further catalog
work is limited to the
[special correctives queue](../reports/group-c-special-correctives-queue-2026-08-02.md)
and remains post-launch.

The final-nine corrective pass made ИДН-03 revision-ready. Its subsequent exact
one-Product lifecycle completed corporate Human Review, Approval and
Publication. The remaining closure sequence is recorded in the
[final catalog closure plan](../reports/final-catalog-closure-plan-2026-08-02.md).

## Never Automatic

CyberMedica must never automatically:

- publish characteristics without documents;
- use LLM output as evidence;
- resolve conflicts;
- publish compatibility;
- publish analog equivalence;
- publish clinical recommendations;
- convert dealer catalog text into verified data;
- hide missing critical fields;
- write enrichment output into public projections;
- bypass Verification or Publication.
