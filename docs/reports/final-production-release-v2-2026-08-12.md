# Final Production Release v2 — 2026-08-12

## Scope

Controlled release of the accepted Stage lineage to the canonical CyberMedica
Production runtime. The release adds SEO v3, the accepted catalog/manufacturer
UX, Final Stage Acceptance Corrective v2, exact legacy URL migration, and R9
delivery to the approved Yandex Metrica counter.

## Release lineage

- Production base: `380bb33a804c8dfc4f3333f8fb5acf211bd56c3b`
- Accepted Stage tip: `a0506d59f723dcef7ac9c6bf0b85b1643cae1a53`
- Integration mode: linear fast-forward
- Machine-readable manifest:
  `data/releases/final-production-release-v2-manifest.json`
- Catalog production synthetic corrective source: `d21eedf5d5c3c0fe99834415845996fcc7a649b3`
- Canonical patch-equivalent already present: `e199a574fa5a40b9ee1d4ecb16e3d2cb3a17207d`
- Synthetic patch-id: `a562270718854ee5c033a9ae743676e7ba132a65`

No blind cherry-pick, merge commit, rebase, squash, or force push is used.

## Production-shaped catalog preflight

- Published Products: 114
- Accepted Product feature bindings: 114/114
- Products with meaningful feature sections: 79
- Product content regressions outside the accepted corrective: 0
- Manufacturer records: 31
- Product-backed public manufacturers in the current Production projection: 25
- Hidden zero-product manufacturers: 6
  (`Ambu`, `AOHUA`, `Биотех-М`, `Dräger`, `HUGER`, `Philips`)
- Public suppliers: 0
- Hidden/non-public suppliers: all supplier records

The accepted Stage expectation of 19 public and 12 hidden manufacturers was
derived while 43 imported Products were Preview drafts. Those Products are
already published in the current 114-Product Production projection, so six of
the former zero-product manufacturers now have public Products. The release
therefore derives the public graph from actual published Product bindings and
does not hardcode the Stage count.

Expected sitemap after release:

`114 Products + 25 manufacturers + 3 base routes + 6 SEO routes = 148 URLs`.

## R9 / Yandex Metrica

- Approved Production counter: `98376495`
- Runtime accepts exactly this counter and fails closed for an absent, malformed,
  or stale value.
- R9 event abstraction remains the only event path.
- `rfq_success` remains gated on backend acceptance plus a valid `requestId`.
- Analytics parameters exclude name, phone, email, and message.
- CSP permits only the required Yandex Metrica script, image, and connection
  origins added by this release.
- External Metrica Goals UI: user action required if the three goals are not
  already configured.

## Legacy migration

Three exact Tilda Product URLs return a real one-hop `301` to their exact
canonical Product routes. Recognized `tfc_brand` values normalize to existing
manufacturer routes; unsupported or compound `tfc_*` filters normalize to
`/catalog`. No blanket Product redirect or soft 404 is used.

## Safety and invariance

- Product/database writes required: no
- Lifecycle writes required: no
- Migration required: no
- Production backup gate: not applicable because there are no database writes
- Product scope change: no
- Dependency update: no
- DNS change: no
- MX change: no
- Existing LKG snapshot: 114 Products, checksum validated

## Pre-release validation

- Full tests: 675/675 PASS
- Targeted release/SEO/R9/acceptance tests: PASS
- TypeScript: PASS
- ESLint: PASS
- Turbopack Production build: PASS
- Webpack Production build: PASS
- Catalog transport fault-injection gate: 8/8 PASS
- `git diff --check`: PASS
- Secrets/privacy scan: PASS

## Production evidence

To be completed after canonical deployment and external smoke.
