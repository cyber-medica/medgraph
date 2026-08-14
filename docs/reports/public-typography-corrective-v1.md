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

Stage deployment and final responsive/browser evidence are recorded after the
feature deployment. Production promotion remains intentionally blocked pending
visual review.
