# CyberMedica master catalog corrective v7 — Stage evidence

Date: 2026-08-09

Branch: `codex/endomarket-catalog-integration-stage-v1`

Acceptance endpoint: `https://stage.cyber-medica.ru`
Execution identity: `cybermedica <cybermedicaooo@gmail.com>`

## Result

The global Stage catalog now contains 114 unique Products:

- 71 captured published Products;
- 42 direct EndoMarket Product drafts;
- 1 restored, separate Stage-only SonoScape HD-550 draft;
- 0 duplicate Product IDs;
- 0 duplicate canonical slugs.

The immutable machine audit is
[`data/import/catalog-master-corrective-v7-audit.json`](../../data/import/catalog-master-corrective-v7-audit.json),
SHA-256 `9fb80e1e870dabb82d3a528f71ab8d2a49cd948a68b1a24a083e3e4be624019c`.

## Root cause and global legacy audit

The invalid values `$21`, `$22` and `$23` were unresolved React Flight
references captured as Product descriptions. They affected Hamilton-T1,
Mindray SV300 and Fresenius Kabi Agilia SP MC. The capture boundary now:

1. detects unresolved Flight reference tokens;
2. repairs only from the same Product's valid captured `shortDescription`;
3. validates the full public catalog again;
4. fails closed if any unresolved token remains.

All 71 legacy Products were audited. Invalid descriptions found/fixed/remaining:
`3 / 3 / 0`.

## Imported source integrity

All 42 direct EndoMarket records preserve their exact source description,
raw source feature list and clean source media as audit data. A distinct
presentation layer supplies concise, evidence-traced public feature cards.

- valid descriptions: 42/42;
- visible `Ключевые особенности`: 42/42;
- complete authoritative specification packages: 42/42;
- clean media packages: 42/42;
- source capabilities lost: 0;
- authoritative specifications lost: 0;
- watermark runtime assets: 0;
- duplicate media within a Product: 0;
- fallback hero media: 0.

Hard references:

- iLivTouch: 4/4 presentation features;
- SonoScape EB-500: 6 features, 7 specifications, 3 clean media assets;
- BR-1231/1242/1249/1259: exact model-specific distal diameter, channel and
  bend values plus secondary HV-3101 compatibility;
- HD-350 and HD-500: existing published identities with authoritative Stage
  content overlays;
- HD-550: exactly one separate Stage-only draft, never represented as a
  published binding.

## Product Detail UX

- the thumbnail strip is removed;
- the main media area is a previous/next carousel with swipe, keyboard support
  and `1 / N` counter;
- controls are omitted for a single-image Product;
- hero content uses natural height and no stretched right-hand panel;
- the content order is Description, Key Features, Specifications,
  Application Areas, then Manufacturer;
- all Product Detail application tags are shown independently;
- ProductCard continues to show at most two tags plus `+N` and no technical
  specification rows.

## QA

- targeted v7 tests: PASS;
- complete test suite: 620/620 PASS;
- ESLint: PASS;
- TypeScript: PASS;
- Turbopack production build: PASS;
- Webpack production build: PASS;
- Chromium/WebKit Stage smoke: PASS across 11 profiles;
- imported Product Detail checks: 42/42;
- key Product Detail route set: 47/47;
- desktop/tablet/mobile horizontal overflow: none;
- browser runtime/hydration errors in immutable build: none;
- `GET /api/request`: 405.

Visual evidence is stored in
[`docs/reports/evidence/catalog-master-corrective-v7-2026-08-09`](evidence/catalog-master-corrective-v7-2026-08-09/),
including desktop 1440/1280, tablet/WebKit, iPhone SE/13 mini/14 Pro Max,
390×844, landscape, catalog, search, manufacturer and representative Product
Detail captures.

## Safety

- Production writes: 0;
- lifecycle writes: 0;
- Production deployment changed: no;
- `main` push: no;
- `production` push: no;
- Product publication: none;
- migration: none.

The immutable Vercel Preview deployment ID and final Stage alias verification
are reported in the task handoff after deployment.
