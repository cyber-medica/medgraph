# Synthetic / debug query URL indexing hygiene

Date: 2026-08-14  
Branch: `codex/synthetic-debug-query-indexing-hygiene-v1`  
Canonical base: `aad07eb6c15c079f8e6aaa4d776f9aa0c49fecdf`  
Runtime corrective commit: `c2f90bbabdeb032d36bb5454ee1f2c96e83c6d16`  
Accepted runtime Preview: `dpl_Bkw3y9MRjdqNozk2oQEgZNENQjY2`  
Preview URL: `https://medgraph-dhw8e6jen-medgraph.vercel.app`

## Audit result

The exact technical query families observed in the public crawl and current
QA history are:

- `lh` — Lighthouse/manual performance-run nonce;
- `mobile_synthetic` — canonical mobile synthetic cache isolation;
- `webkit_diagnostic` — WebKit diagnostic isolation;
- `r9_smoke` — R9 smoke isolation.

The current tracked scheduled/mobile synthetic uses `mobile_synthetic`.
Historic or externally generated diagnostic URLs account for the other three
families. No technical parameter changes Product, lifecycle, or public catalog
content.

The commercial attribution contract remains a separate exact allowlist:
`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, and
`yclid`.

## Corrective

Next.js response-header rules match each technical key independently and add:

- `X-Robots-Tag: noindex, follow` in Production;
- `X-CyberMedica-Query-Hygiene: synthetic-debug-noindex` for diagnostics.

The rules do not redirect, rewrite, or remove query parameters. Existing
route-level canonical metadata continues to point to the clean homepage,
catalog, Product, or RFQ URL. Preview keeps its stronger global
`noindex, nofollow` policy.

No robots.txt query blocking was added. UTM/`yclid` query strings remain in the
requested browser URL and continue through the existing R9 attribution
runtime.

## Stage evidence

Yandexbot-style response checks passed for:

- `/?lh=prod-mobile-debug` → canonical `/`;
- `/catalog?mobile_synthetic=stage-check` → canonical `/catalog`;
- Hamilton-T1 with `?webkit_diagnostic=1` → exact clean Product canonical;
- `/request?r9_smoke=query-hygiene` → canonical `/request`.

All technical requests returned HTTP 200, did not redirect, retained their
query string, and carried the query-hygiene marker. Browser rendering showed
the expected H1, non-empty content, and zero horizontal overflow on all four
routes.

The Preview sitemap is intentionally empty under the existing global Preview
indexing policy. The canonical Production sitemap remained 114 unique Product
URLs and contained no query string. This corrective does not change sitemap
generation.

## Validation

- targeted indexing/R9/SEO/routing tests: 29/29 PASS;
- full tests: 704/704 PASS;
- catalog resilience gate: 8/8 PASS;
- TypeScript: PASS;
- ESLint: PASS;
- Next.js 16.2.9 Turbopack production build: PASS;
- query-indexing-hygiene local production smoke: PASS;
- query-indexing-hygiene Preview smoke: PASS;
- WebKit: 3 profiles × 5 routes PASS;
- canonical mobile Production synthetic: PASS, 114 Product URLs;
- catalog Production synthetic: PASS, 114 Product URLs;
- R9 attribution contract: PASS;
- secret/privacy scan: PASS;
- `git diff --check`: PASS.

Production health was re-read after the synthetic run:
`liveTransport=healthy`, `fallbackActive=false`, projection version 75,
114 Products.

## Invariance

- Product writes: 0;
- lifecycle writes: 0;
- migrations: 0;
- Product/content/SEO payload changes: 0;
- dependencies and lockfile changes: 0;
- Production deployment changes: 0;
- `main` / `production` ref changes: 0.
