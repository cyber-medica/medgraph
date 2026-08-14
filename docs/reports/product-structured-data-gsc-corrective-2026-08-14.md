# Product structured data / Google Search Console corrective — 2026-08-14

## Scope and safety

- Source Production SHA: `946fce149f75d29449daf586ec1a8ca349c767d1`.
- Scope: JSON-LD on all 114 published Product Detail pages and two exact legacy URL assumptions.
- Product/content/lifecycle/Supabase writes: `0`.
- Migrations: `0`.
- Visible Product text, SEO metadata, sitemap generation, R9, Metrica and RFQ: unchanged.
- Production deployment: unchanged; this corrective is Stage-only.

## Root cause

The shared Product Detail generator emitted `@type: Product` without `offers`, `review` or `aggregateRating`. This was semantically conservative, but it made every Product graph ineligible for Google's Product snippet enhancement and produced the Search Console critical error. Three descriptions (Hamilton-T1, Mindray SV300 and Fresenius Kabi Agilia SP MC) also retained source HTML inside the JSON-LD string.

The model field was additionally emitted as `mpn` even though the catalog only establishes a model identifier, not a manufacturer part number. The corrective does not preserve that unsupported equivalence.

## Official Google requirement and decision

Google requires Product snippet markup to contain `name` and at least one of `offers`, `review` or `aggregateRating`. An `Offer` requires an actual active `price` (or `priceSpecification.price`) and the corresponding currency. CyberMedica exposes an RFQ workflow, not a public checkout price, and has no visible review or rating dataset.

Decision:

- no `Offer`, fake price, review or rating is added;
- the Google Product rich-result declaration is removed;
- the page remains described with schema.org `ItemPage` and a `MedicalDevice` main entity, canonical URL, H1-aligned name, plain-text description and canonical-host image URLs;
- `manufacturer`, `brand`, `model`, `sku`, `mpn` and `category` are omitted from `MedicalDevice`: current schema.org domains do not support them on that type, and no substitute relationship is invented;
- the existing `BreadcrumbList` is preserved exactly once.

This intentionally gives up Product rich-result eligibility until truthful public price or review data exists. It removes the critical Product enhancement error without inventing commercial facts.

References:

- [Google Product snippet requirements](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Google Product structured data overview](https://developers.google.com/search/docs/appearance/structured-data/product)
- [schema.org ItemPage](https://schema.org/ItemPage)
- [schema.org MedicalDevice](https://schema.org/MedicalDevice)
- [schema.org mainEntity](https://schema.org/mainEntity)

## 114-page evidence matrix — before

Machine-readable artifact: `/tmp/product-structured-data-gsc-before-2026-08-14.json`

SHA-256: `37413df69e03639fbaf8df2c75da725578f26ed63a612ddc09525c25bb149780`

| Check | Result |
|---|---:|
| Published Product routes audited | 114 |
| HTTP 200 | 114 |
| `Product` detected | 114 |
| `BreadcrumbList` detected | 114 |
| Name equals visible H1 | 114 |
| Plain-text structured descriptions | 111 |
| Primary structured images resolve | 114 |
| Product rich-result eligible | 0 |
| Missing `offers` / `review` / `aggregateRating` | 114 |

## HD-500 and HD-350 route reconciliation

| Product | Product ID | Current canonical slug | Publication state | Expected URL state before |
|---|---|---|---|---|
| SonoScape HD-500 | `767632362-697047413241-videoendoskopicheskaya-sistema-sonoscape` | `767632362-697047413241-videoendoskopicheskaya-sistema-sonoscape` | `active` / published | 404 |
| SonoScape HD-350 | `767632362-776712772161-videoendoskopicheskaya-sistema-sonoscape` | `767632362-776712772161-videoendoskopicheskaya-sistema-sonoscape` | `active` / published | 404 |

The Products already exist once in the published projection. Their imported canonical slugs predate the human-readable URL assumptions, and no matching redirects existed. The sitemap correctly contains only the two current canonical routes. There is no duplicate, unpublished state, projection mismatch or sitemap mismatch.

Corrective:

- `/catalog/videoendoskopicheskaya-sistema-sonoscape-hd-500` → HTTP 301 → exact HD-500 canonical Product;
- `/catalog/videoendoskopicheskaya-sistema-sonoscape-hd-350` → HTTP 301 → exact HD-350 canonical Product.

Both redirects are one hop and never target the homepage or generic catalog. The sitemap remains canonical-only; the broken aliases must not be submitted for indexing.

## Stage validation

- Branch: `codex/google-product-indexing-readiness-v1`.
- Stage URL: `https://medgraph-k04ec8phw-medgraph.vercel.app`.
- Deployment: `dpl_CrZKYUq7XVHisqL1tnXAEUqDYrjt` (`READY`, Preview).
- Runtime commit: `bc6b6b666569c91cf6b0e485e00fceb838cd5f05`.
- After-audit artifact: `/tmp/product-structured-data-gsc-after-2026-08-14.json`.
- After-audit SHA-256: `a6bfb2c52bbdede1b2faab51320cfc5c190651ee1ec860562422eecbc97761be`.

| Check | Result |
|---|---:|
| Product Detail routes audited | 114 |
| HTTP 200 | 114 |
| `ItemPage` detected | 114 |
| `MedicalDevice` main entities | 114 |
| Google `Product` detected | 0 |
| `BreadcrumbList` detected | 114 |
| Name equals visible H1 | 114 |
| Plain-text structured descriptions | 114 |
| Every structured image resolves | 114/114 Products |
| `offers` / `review` / `aggregateRating` present | 0 / 0 / 0 |
| Forbidden hosts | 0 |
| Google Product critical errors caused by our markup | 0 |
| Stage matrix PASS | 114/114 |

Representative Product Detail checks passed for Hamilton-T1, SonoScape HD-550, SonoScape HD-500, SonoScape HD-350, Medinova ENDO CLEAN-2000, Mindray SV300 and BOWA ARC 350. All render `ItemPage` → `MedicalDevice` plus one `BreadcrumbList`; none declares Product commerce, Offer, price, review or rating data. Chromium desktop and iPhone WebKit each returned HTTP 200, one H1, one visible canonical breadcrumb, zero horizontal overflow and measured CLS `0` on all seven routes.

The two expected SonoScape URLs return exact HTTP 301 responses and reach their canonical Product pages in one hop. Both canonical pages return HTTP 200 with the correct title and H1 and the new JSON-LD contract.

Preview indexing remains intentionally disabled, so its sitemap is empty by design. The unchanged Production sitemap contains 114 unique canonical Product URLs, includes both HD-500 and HD-350 canonical routes, and contains neither redirect alias.

The extended browser matrix passed 41 routes in Chromium desktop, Chromium mobile 390 px and iPhone WebKit 390 px. A second WebKit smoke passed across iPhone Safari portrait, iPhone WebKit landscape and desktop Safari/WebKit for homepage, catalog, request, HD-500 Product Detail and internal login. No first-party browser errors were observed.

Validation gates:

- targeted structured-data/redirect tests: `23/23` PASS;
- full test suite: `699/699` PASS;
- R9/SEO regression subset: `21/21` PASS;
- TypeScript: PASS;
- ESLint: PASS;
- Next.js 16.2.9 Turbopack production build: PASS;
- catalog reliability prebuild gate: `8/8` PASS.

The accepted Stage is deliberately backed by the checksum-validated 114-Product snapshot and receives no Production service credential. Its health endpoint therefore identifies the Preview source as degraded/fallback rather than falsely claiming a live Production transport. Canonical Production was checked separately after the Preview deployment and remained `liveTransport=healthy`, `fallbackActive=false`.

Production invariance after Preview deployment:

- deployment: `dpl_7HmHguJD2QMZKJ78xzakcAkpjdao`;
- SHA: `946fce149f75d29449daf586ec1a8ca349c767d1`;
- Products: `114`;
- projection version: `75`;
- `liveTransport`: `healthy`;
- `fallbackActive`: `false`;
- Product/lifecycle writes and migrations: `0`.
