# Public typography system and homepage/RFQ micro-corrective v1

Date: 2026-08-14  
Baseline: `aad07eb6c15c079f8e6aaa4d776f9aa0c49fecdf`  
Branch: `codex/public-typography-micro-corrective-v1`

## Scope

This corrective normalizes public storefront typography and fixes two approved
presentation defects. It does not change layout, Product data, Product content,
SEO content, structured data, R9, Metrica, the RFQ backend, Supabase, migrations
or dependencies.

## Canonical public contract

- Font: self-hosted `Onest` variable font through `next/font`, with
  `Inter, system-ui, sans-serif` fallback.
- Headings: `cm-heading-1`, `cm-heading-2`, `cm-heading-3`; canonical sans,
  strong semantic weight, normal letter spacing.
- Eyebrow: `cm-eyebrow` (and the backward-compatible `cm-label` alias);
  Onest 700, uppercase, `0.08em` tracking.
- Breadcrumbs: `cm-breadcrumb`; Onest 600, normal tracking.
- Buttons: existing `cm-button-primary` and `cm-button-secondary`; Onest 600,
  normal tracking.
- Body and public utility values: Onest regular/inherited sans. Public
  `font-mono` utilities were removed.

## Micro-correctives

1. The featured-equipment subtitle preserves the exact approved copy and uses
   a non-breaking word space between `рассрочкой` and `0%`. The phrase may move
   naturally as a unit without a hard break or a wide nowrap container.
2. The `ДЕЛОВАЯ ЗАЯВКА` eyebrow was removed. `/request` begins directly with
   the `Запросить КП` H1; `RequestForm` and R9 event code remain unchanged.

## Source audit

Machine-readable evidence:
`docs/reports/public-typography-audit-v1.json`.

Audited public families include homepage, Catalog, manufacturer directory and
detail, Product Detail, Request, SEO landing, Solutions, Search, Compare,
header/footer, cards, CTA blocks, breadcrumbs and the public FS510 vertical.

## Safety

- Product changes: 0
- SEO content changes: 0
- Structured-data changes: 0
- R9/RFQ behavior changes: 0
- Migrations: 0
- Production writes: 0
- Production deployment: unchanged

## Stage validation

Final Stage:
`https://medgraph-4gbmcxcdt-medgraph.vercel.app`
(`dpl_Yx4CrYqnfbASYpB1tfmLqouekheD`). It was built from the feature commit
using the existing read-only EndoMarket Stage fixture so the complete
eight-card featured block could be reviewed without Production credentials or
writes. An attempted Production-shaped Preview correctly failed closed at the
Supabase Preview/Production project-binding guard; that guard was not changed.

Validation evidence:

- responsive homepage matrix: `1440 / 1280 / 1024 / 768 / 390`, all HTTP 200;
- exact featured subtitle present; `рассрочкой 0%` stayed on one rendered line
  at every audited width;
- computed public font family begins with `Onest` on all checked routes;
- computed public mono text: `0`;
- horizontal overflow: `0`;
- homepage CLS: `0` at all five widths; the maximum representative-route CLS
  was `0.00096` on `/manufacturers`, attributed exclusively to pre-existing
  lazy logo image decoding (Bionet, Fresenius Kabi, Mindray, PENTAX Medical,
  B. Braun and SonoScape), not to font or text nodes;
- external Google Fonts runtime requests: `0`;
- Chromium desktop and WebKit mobile route matrix: `20/20` PASS, including
  homepage, Catalog, manufacturer directory/detail, Hamilton-T1, Mindray SV300,
  Request and the Endoscopy SEO landing;
- Medinova ENDO CLEAN-2000: Chromium mobile PASS and the project WebKit smoke
  PASS in all three device profiles;
- project iOS WebKit smoke: `3 profiles × 5 routes` PASS for both Hamilton-T1
  and Medinova Product Detail runs;
- RFQ hierarchy: one `Запросить КП` H1; `ДЕЛОВАЯ ЗАЯВКА` absent;
- full test suite: `703/703` PASS;
- targeted typography/manufacturer/R9 suite: `12/12` PASS;
- ESLint: PASS;
- TypeScript: PASS;
- Vercel Turbopack build: PASS;
- Lighthouse Stage smoke: mobile `95` Performance / `96` Accessibility,
  desktop `100` Performance / `96` Accessibility; CLS `0` in both profiles,
  mobile TBT `51 ms`, desktop TBT `0 ms`. Against the accepted Production
  homepage baseline (`97 / 100`) the Preview delta is `-2 / 0`, within normal
  Preview variance and below the material-regression threshold. The two
  Lighthouse accessibility findings (existing color contrast and visible-label
  name mismatch) are outside the typography corrective; changed surfaces keep
  one H1, semantic links/buttons and valid focus behavior.

Screenshots and machine-readable runtime evidence were generated at:

- `/tmp/public-typography-stage-home-1440.png`;
- `/tmp/public-typography-stage-home-390.png`;
- `/tmp/public-typography-stage-qa-v1-result.json`.

Production promotion remains intentionally blocked pending visual review.
