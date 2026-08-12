# CyberMedica — Final Stage Acceptance Corrective v2

Date: 2026-08-12

Scope: Stage only

Branch: `codex/final-stage-acceptance-corrective-v2`

Base: `1a469322c701a2fe0f8ebb569b40f93e16c459c9`

Target: `https://stage.cyber-medica.ru`

## Outcome

The four P0 acceptance defects were corrected without changing the accepted ProductCard, Product Detail hero/gallery, manufacturer mark policy, public brand, R9/RFQ contracts, canonical URLs, Product SEO metadata, Production catalog data, or Production deployment.

## Zero-product public entities

- Manufacturer records audited: 31.
- Public Product-backed manufacturers: 19.
- Zero-product manufacturers removed from discovery: 12 — Ambu, AOHUA, Биотех-М, Dräger, HUGER, Philips, BOWA, ERBE, iLivTouch, Medinova, MET and ZERTS.
- Supplier records audited: 0; no public supplier model exists in this Stage dataset.
- Zero-product entities are excluded from manufacturer discovery, filters, search/autocomplete entity results, recommendations, crawlable links and sitemap output.
- A request-time fail-closed guard returns an actual HTTP 404 before App Router streaming for a missing public manufacturer. Transport failure is treated as `unavailable`, not as evidence of absence.
- Direct HTTP verification: all 12 hidden manufacturer routes returned 404; all 19 public manufacturer routes returned 200. Unknown supplier route returned 404.

Entity rows and Stage draft Product bindings remain present in the Stage catalog; only their public discovery eligibility changed.

## Product content integrity

- Products audited: 114/114.
- Canonical source: `data/published-catalog-last-known-good.json`, projection version 75, checksum `a3c933eb1bf485c923ad1c0467ec214aa7b3b9e12575541f32e367c0bf99dc5a`.
- Hamilton-T1 canonical body fingerprint: `a313f8213963e59aaaf2a2b2b30e2b8e8dadaa3b3dfed0543221fbc0cb583d39`.
- Unintended canonical drift found: 1.
- Unintended canonical drift fixed: 1 (Hamilton-T1 description/short description restored from the tracked canonical projection package).
- Remaining unintended body regressions: 0.
- Product specifications, application areas, SEO title, SEO description, slug and identity stayed unchanged for all 114 Products.

## Semantic key-feature completeness

- Products audited: 114/114.
- Products with meaningful, source-backed features: 79.
- Feature sections added or restored: 32.
- Hidden sections where meaningful features exist: 0.
- Invented claims: 0.
- Existing approved feature packages were retained. Restored legacy summaries are short transformations of exact accepted description fragments; every new row records its source type and evidence fragment in the machine artifact.
- Comen CM1200B now exposes four exact source-derived summaries: automatic/manual/rhythm ECG modes, memory for 300 ECG records, 5.6-inch display and USB data transfer.

## SEO FAQ

- Routes audited: 6/6.
- Questions/answers: 18/18 non-empty.
- Root cause: the approved answers were present in the data contract, but all native disclosure widgets initially rendered closed and did not provide a clear visible affordance, so users perceived the answers as absent.
- Correction: the first approved answer is visible server-side; native `details/summary` keeps all approved answer text in rendered HTML/DOM; explicit plus/close affordance and 44px summary target were added.
- Chromium and WebKit verified open/close, keyboard `Enter`, rendered answer text and mobile layout.

## Machine-readable evidence

- Artifact: `data/import/final-stage-acceptance-v2-audit.json`.
- Temporary mirror: `/tmp/final-stage-acceptance-v2-audit.json`.
- SHA-256: `a403e1adea87106a90f920b140729c6b37bf2e7896cd967a4bef77034fd49f0d`.
- The artifact contains all 114 semantic feature audit rows, content fingerprints, zero-product entity inventory, FAQ route counts and source evidence for restored feature summaries.

## Validation

- Targeted acceptance tests: PASS (5/5).
- Full repository test suite: PASS.
- TypeScript: PASS.
- ESLint: PASS.
- Turbopack production build: PASS (160 routes generated).
- Webpack production build: PASS (160 routes generated).
- Catalog resilience gate: PASS (8/8 in both build modes).
- SEO v3 smoke: PASS; 43 exact v3 Product metadata rows, 71 preserved v2 rows, 2 P1 landings, 3 public specific manufacturer pages.
- Stage acceptance browser smoke: PASS; 11 responsive profiles, Chromium and WebKit, 48 Product Detail routes, 114 visible Products.
- WebKit 390×844: PASS.
- Horizontal overflow: 0 in the required mobile profile.
- Public manufacturer HTTP contract: 19×200 and 12×404.
- FAQ interaction: 6/6 routes in desktop Chromium and mobile WebKit.

The first dev-server browser attempt exposed a local HMR origin/chunk mismatch. Final browser acceptance ran against an optimized `next start` build, eliminating the dev-only HMR path; no application runtime errors remained.

## Visual evidence

- `docs/reports/evidence/final-stage-acceptance-corrective-v2-2026-08-12/homepage-desktop-1440.png`
- `docs/reports/evidence/final-stage-acceptance-corrective-v2-2026-08-12/popular-equipment-desktop.png`
- `docs/reports/evidence/final-stage-acceptance-corrective-v2-2026-08-12/catalog-desktop-1440.png`
- `docs/reports/evidence/final-stage-acceptance-corrective-v2-2026-08-12/catalog-mobile-390x844.png`
- `docs/reports/evidence/final-stage-acceptance-corrective-v2-2026-08-12/product-detail-hamilton-t1.png`
- `docs/reports/evidence/final-stage-acceptance-corrective-v2-2026-08-12/manufacturer-sonoscape.png`
- `docs/reports/evidence/final-stage-acceptance-corrective-v2-2026-08-12/faq-chromium-desktop-1440.png`
- `docs/reports/evidence/final-stage-acceptance-corrective-v2-2026-08-12/faq-webkit-mobile-390.png`

## Stage deployment and invariance

- Accepted application commit: `5e4327a31ed30a1adbcedb52219d7fb9fc69695e`.
- Immutable Preview deployment: `dpl_ibjoAxoHA5hhnTWFVcF1297qr9SW` (`https://medgraph-r07j6ub2z-medgraph.vercel.app`), status `READY`.
- Stage alias verification: `https://stage.cyber-medica.ru` is assigned to the accepted Preview and passed the full external acceptance smoke.
- External Stage smoke: PASS — 11 responsive profiles, Chromium and WebKit, 48 Product Detail routes, 42/42 imported drafts, 114 visible Products, 19 public manufacturer routes, 12 hidden manufacturer routes, 6/6 FAQ routes and no horizontal overflow at 390×844.
- External SEO v3 smoke: PASS — 43 exact v3 rows, 71 preserved v2 rows, 2 P1 landings, 3 public manufacturer pages and no Stage sitemap exposure.
- Production writes: 0.
- Production deployment changed: No.
- Production deployment: `dpl_5ua6shdYvfC2cCAxk4h46kxVZ4pp`, status `READY`, source `380bb33a804c8dfc4f3333f8fb5acf211bd56c3b` (unchanged after Stage acceptance).
- Remote `main`: `380bb33a804c8dfc4f3333f8fb5acf211bd56c3b` (unchanged after Stage acceptance).
- Remote `production`: `380bb33a804c8dfc4f3333f8fb5acf211bd56c3b` (unchanged after Stage acceptance).
