# CyberMedica Production Launch Release v1 — 2026-08-11

Status: **PREPARED — Production execution pending**.

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
| Full tests | `648 / 648` PASS |
| ESLint | PASS |
| TypeScript | PASS |
| Turbopack production build | PASS |
| Webpack production build | PASS |
| R9 contract tests | PASS |
| Public brand gate | PASS |
| Production synthetic workflow patch | PASS in source; canonical workflow rerun pending |
| Yandex Metrica counter | not configured; no ID invented, integration point remains inactive |
| RFQ webhook variable | present in Production; end-to-end delivery smoke pending |

## Production execution evidence

This section must be completed only from durable Production results.

| Evidence | Result |
| --- | --- |
| Migration apply | pending |
| Release deployment | pending |
| Import / lifecycle | pending |
| Published Products | pending (`71 → 114` expected) |
| Sitemap canonical URLs | pending (`152` expected from actual Product/manufacturer/static route arithmetic) |
| RFQ requestId / downstream acceptance | pending |
| Chromium / WebKit / mobile | pending |
| Canonical workflow run | pending |
| Final main / production SHA | pending |

## Rollback boundary

Previous Production deployment:
`dpl_FxukA7a4SzWyGmJPBG4FniS7E8AQ`.

Database rollback is not improvised. The exact pre-write verified backup is the
recovery boundary; application rollback may use the previous READY deployment
if a runtime P0 occurs. Lifecycle writes stop immediately on any partial or
ambiguous state.
