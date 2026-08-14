# Manufacturer typography and Medinova logo corrective — 2026-08-14

## Scope and safety

- Branch: `codex/product-structured-data-gsc-corrective-v1`
- Runtime corrective commit: `cdd878107b1c60709b0bb238ddb0cb8bcbff4abb`
- Stage deployment: `dpl_6xxnjPzUvpiXN2T6y5tminKaFbAq`
- Stage URL: `https://medgraph-2uhz6p7pd-medgraph.vercel.app`
- Production deployment changed: no
- Product/Supabase writes: 0
- Migrations: 0
- Product, SEO, R9, Metrica and RFQ changes: 0

## Typography corrective

Root cause: manufacturer utility labels used the global mono `cm-label` treatment while canonical breadcrumbs inherited the sans family. Product-count metadata also used route-local `font-mono` classes.

Corrective:

- added the shared `cm-eyebrow` design token using `var(--font-sans)`;
- standardized uppercase labels at weight `700`, letter spacing `0.08em`, and a fixed 1.25rem line height;
- made the shared breadcrumb font family and normal tracking explicit;
- removed mono overrides from manufacturer listing/detail metadata;
- preserved the existing hierarchy, layout and routes.

Computed Stage results on `/manufacturers` plus Medinova, Mindray, Hamilton Medical, SonoScape and B. Braun detail routes:

- breadcrumb and eyebrow font family: canonical `Onest / Inter / system sans` on every route;
- eyebrow weight: `700` on every route;
- eyebrow letter spacing: `0.8px` on every route;
- desktop overflow: 0;
- mobile 390×844 overflow: 0;
- WebKit CLS: 0 on all 12 desktop/mobile route-profile combinations.

## Medinova official asset audit

Authoritative source: `https://medinova.ru/`.

Inspected official assets:

1. Header inline SVG at `.logo_wrapper .logo > svg`: white wordmark, viewBox `0 0 1722.32 477.31`. Rejected for the light CyberMedica surface because a neutral plate is unnecessary once the official colored variant is available.
2. Standalone inline SVG at `.logo_medinova > svg`: cyan wordmark, DOM dimensions `215×60`, viewBox `0 0 1722.32 477.31`. Accepted.
3. `/images/logo.svg`: footer asset with official-page alt `ENDOMARKET DISINFECTION`. Rejected because it is not the standalone Medinova manufacturer identity.
4. `/images/` raster Product/gallery assets and computed CSS background assets: none are standalone Medinova wordmarks.
5. `/css/styles.css`: confirms the official `.logo_medinova` selector and inline SVG rendering; no higher-quality dark or colored external logo file is referenced.

Accepted local asset:

- official location: `https://medinova.ru/`, selector `.logo_medinova > svg`;
- local path: `/manufacturers/medinova/logo.svg`;
- format: SVG;
- intrinsic viewBox: `1722.32×477.31`;
- visual variant: official cyan `#28b9e1` on transparent background;
- bytes: 3,486;
- SHA-256: `08464e96c62e0f1ab8713239b50b98875528b3ab6fe0035c0c8b8272a53ad476`;
- path data equality with the official inline SVG: 2/2 exact;
- external runtime references: 0;
- productionReady: true.

The asset is locally pinned, keeps the exact official geometry/colors, contains no scripts or external references, and is rendered through the existing `ManufacturerMark` sizing contract. No redraw, recolor or screenshot crop was used.

Final logo inventory after the Stage corrective: 22 graphic / 3 polished fallback. Medinova is graphic; iLivTouch, Longfian and UNIKOS remain fail-closed fallbacks.

## Validation

- targeted manufacturer tests: 12/12 PASS;
- full tests: 699/699 PASS;
- TypeScript: PASS;
- ESLint: PASS (CSS ignored by the existing ESLint configuration; no errors);
- Next.js 16.2.9 production build: PASS;
- catalog reliability prebuild: 8/8 PASS;
- Chrome computed-style desktop/mobile audit: PASS;
- WebKit desktop/mobile CLS, overflow and broken-logo audit: PASS;
- broken graphic images across audited routes: 0;
- external runtime logo URLs: 0;
- `git diff --check`: PASS.
