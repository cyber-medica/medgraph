# CyberMedica Production Launch Release v1 — 2026-08-11

Status: **PASS — Production release completed; canonical Git/CI reconciliation
in progress**.

This report is the sanitized evidence record for the accepted Stage →
Production release. It contains no credentials, session material, webhook
destination, private lead payload, database connection string, or service-role
value.

## Release integration

| Component | Accepted source | Integrated state |
| --- | --- | --- |
| Catalog Master Corrective v7 | `cd674cc629947632833b8fe99751b55d797b3747` | exact accepted Stage catalog and media lineage present |
| SEO Implementation v2 | `050108ef6395546f72d20ee3f2b3c041d90e245e` | present |
| Catalog production synthetic corrective | `d21eedf5d5c3c0fe99834415845996fcc7a649b3` | exact one-line patch present as integrated commit `e199a574fa5a40b9ee1d4ecb16e3d2cb3a17207d` |
| R9 attribution | authoritative tracked JSON contract | present with 30-day first/last-touch and fail-closed `rfq_success` |
| Public brand normalization | `CyberMedica` → `Кибермедика` | public rendered-copy gate present |
| Projection isolation | `aa0129d4113fc842d8a28d3bb6c1c8c5abf5507c` | present |

The scheduled workflow invokes the lockfile dependency exactly as
`npx --no-install playwright-core install --with-deps webkit`; dependency
versions were not changed.

## Candidate reconciliation

| Check | Result |
| --- | --- |
| Existing Production Products | `79` |
| Existing published / unpublished | `71 / 8` |
| Exact new candidates | `43` (`42` EndoMarket + separate HD-550) |
| Candidate Product IDs / source UIDs / slugs | `43 / 43 / 43` unique |
| Duplicate identity conflicts | `0` |
| New / reused reference bindings | `6` manufacturers, `1` category, `13` application areas created; remaining bindings reused |
| Accepted key features | `255` |
| Accepted specifications | `294` |
| Accepted clean media assets | `155` |
| Expected final database Products | `122` (`114` published + `8` deferred drafts) |

Machine-readable manifest:
`data/operations/production-launch-release-v1-manifest.json`

Manifest SHA-256:
`aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309`

Candidate reconciliation artifact:
`/tmp/production-launch-candidate-reconciliation.json`

Candidate reconciliation SHA-256:
`dbe987e0427f7c18c017fd58be2628ee3d4372b4c825241b172faffcd853b005`

## Backup and migration gates

The separate containment report records the fresh post-containment backup and
network-isolated restore verification. The restore baseline is `79` Products,
`71 / 8` published/unpublished, lifecycle `71 / 71 / 71 / 71`, projection
version `73`, and `29` applied migrations through `202608030002`.

The additive release migration is:
`202608110001_production_launch_release_v1.sql`

Migration SHA-256:
`6143e71c390dff3b8f9c33fa2ffed74300433810cc5a52e67e0d20f0312534e5`

It exposes an exact hard-coded 43-Product scope. Service phases and corporate
authenticated review phases are separated by grants and runtime checks. Browser
requests contain only the operation key, manifest digest, and enumerated phase;
Product IDs cannot be supplied by the browser.

## Isolated lifecycle rehearsal

The release migration and manifest were executed against a fresh restored
Production backup in a PostgreSQL 17.6 container with `network=none`.

| Result | Value |
| --- | --- |
| Import | `43 / 43` |
| Structured revisions | `43 / 43` |
| Structured decisions / approvals | `549 / 43` |
| Structured publications | `43 / 43` |
| Product revisions / decisions / approvals / batches | `114 / 114 / 114 / 114` total |
| Products total | `122` |
| Published / unpublished | `114 / 8` |
| Projection version | `75` in the isolated rehearsal; Production must be read durably |
| Exact replay | `already_complete` |
| Wrong digest | rejected |
| Non-service service phase | rejected |
| Non-corporate reviewer | rejected |

The accepted ERBE value `< 30 Ватт` is treated as mathematical plain text;
HTML-like tags remain rejected in both TypeScript and SQL validators.

## Application and R9 preflight

| Gate | Result |
| --- | --- |
| Full tests | `649 / 649` PASS |
| ESLint | PASS |
| TypeScript | PASS |
| Turbopack production build | PASS |
| Webpack production build | PASS |
| R9 contract tests | PASS |
| Public brand gate | PASS |
| Production synthetic workflow patch | PASS in source; canonical workflow rerun pending final Git reconciliation |
| Yandex Metrica counter | not configured; no ID invented, integration point remains inactive |
| RFQ webhook variable | present in Production; one synthetic RFQ was accepted downstream |

## Production execution evidence

| Evidence | Result |
| --- | --- |
| Migration apply | PASS; ledger contains `202608110001`, total applied migrations `30` |
| Release deployment | PASS; current READY runtime `dpl_816swcAZKarmfRcVheBkLvfmzUX8` |
| Import / lifecycle | exact `43 / 43` through import, structured lifecycle and Product lifecycle; replay `already_complete` |
| Published Products | `71 → 114`; Products total `79 → 122`; unpublished remains `8` |
| Product lifecycle totals | revisions / Decisions / Approvals / Publication Batches = `114 / 114 / 114 / 114` |
| Structured lifecycle for release scope | revisions / Decisions / Approvals / Batches = `43 / 549 / 43 / 43` |
| Projection | durable Production version `75`, checksum `a3c933eb1bf485c923ad1c0467ec214aa7b3b9e12575541f32e367c0bf99dc5a` |
| Sitemap canonical URLs | `152` unique = `114` Product + `31` manufacturer + `7` static/SEO; no Stage, Preview, internal or API URL |
| RFQ requestId / downstream acceptance | `75a1445e-8a41-4a00-9115-fe948d408a5a`; PASS / accepted |
| R9 analytics | attribution, first/last touch, Product context and exactly one `rfq_success` PASS; analytics PII leakage `0` |
| Chromium / WebKit / mobile | canonical mobile gate PASS on Chromium and iPhone WebKit `390×844`; full catalog audit recorded separately below |
| Canonical workflow run | pending final Git reconciliation |
| Final main / production SHA | pending final Git reconciliation |

## Durable lifecycle result

The exact scope stayed manifest-bound at 43 unique Product IDs, source UIDs and
slugs. Durable verification found no duplicate slug or source UID. Each new
Product has one current immutable revision, one corporate Review Decision, one
Approval and one Publication Batch. The separate HD-550 identity is published
at `/catalog/videoendoskopicheskaya-sistema-sonoscape-hd-550`.

The sanitized exact 43-entry lifecycle binding, including Product, revision,
Decision, Approval and Publication Batch IDs, was captured by the read-only
post-publication query in
`/tmp/production-launch-post-publication.json`. It contains no credential or
session material.

## Runtime corrective and resilience

The first release runtime exposed two launch-only scale findings without any
database ambiguity:

1. the exact new media uses canonical same-origin `/media/*` URLs, so the
   approved public media origin allowlist was extended only to
   `cyber-medica.ru`;
2. a complete 114-Product live projection can exceed the previous 2.5-second
   transport budget, so the bounded two-attempt policy is now 8 seconds then
   2.5 seconds with 250 ms backoff (less than 12 seconds total).

The validated 114-Product last-known-good snapshot remained available during
transient transport degradation. Invalid, empty or partial responses still
cannot replace it. The canonical sitemap/Product counters and scheduled
workflows now use `114`; the three SEO catalog landing paths are excluded from
Product counts. Production observation measured a complete fallback Product
Detail at up to 22.026 seconds under the exhaustive audit, so the external
synthetic response budget is calibrated to a still-bounded, fail-closed 30
seconds. No assertion, route or error was suppressed.

## Full Production catalog audit

All 114 Product Detail URLs were fetched from the canonical domain with
concurrency limited to two. Every page returned HTTP 200 and passed title,
description, one-H1, exact canonical, `index,follow`, Product JSON-LD,
BreadcrumbList JSON-LD, manufacturer, media, Product-aware RFQ and rendered
placeholder checks. Titles and canonical URLs are unique `114 / 114`.

The machine-readable result is
`/tmp/production-full-catalog-audit-result.json`, SHA-256
`5514d2c06871928f19377721a05b1c4540d4c261849ced824ef0b970b4261a0f`.
It also verifies homepage, Catalog, Search, Manufacturers, Request, all four P0
SEO routes, and `GET /api/request = 405`.

## R9 Production evidence

One explicit synthetic test lead was submitted with the authoritative R9 test
attribution contract. The landing attribution survived navigation through the
catalog and Hamilton-T1 context into RFQ. The server returned requestId
`75a1445e-8a41-4a00-9115-fe948d408a5a`; downstream delivery was accepted and
the browser emitted exactly one `rfq_success`, with no `rfq_error` and no PII
in analytics events. No second test lead was sent.

Yandex Metrica remains deliberately inactive because no approved counter ID is
configured. The vendor-neutral R9 event abstraction is deployed and tested;
no identifier was invented.

## SEO and search-engine readiness

The four P0 canonical URLs are ready to submit for re-crawl (this report does
not claim that external indexing has already occurred):

- `https://cyber-medica.ru/catalog/endoskopiya`
- `https://cyber-medica.ru/catalog/endoskopiya/videoendoskopicheskie-sistemy`
- `https://cyber-medica.ru/solutions/portativnaya-bronkhoskopiya`
- `https://cyber-medica.ru/catalog/endoskopiya/obrabotka-endoskopov`

Production uses canonical `index,follow` metadata. Stage retains
`noindex,nofollow` and an empty sitemap. Public rendered copy and structured
Organization identity use `Кибермедика`; technical asset names and internal
identifiers are not public brand copy.

## Rollback boundary

Previous Production deployment:
`dpl_FxukA7a4SzWyGmJPBG4FniS7E8AQ`.

Database rollback is not improvised. The exact pre-write verified backup is the
recovery boundary; application rollback may use the previous READY deployment
if a runtime P0 occurs. Lifecycle writes stop immediately on any partial or
ambiguous state.
