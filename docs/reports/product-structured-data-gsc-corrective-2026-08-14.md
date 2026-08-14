# Product structured data / Google Search Console corrective — 2026-08-14

## Scope and safety

- Source Production SHA: `f09fe0ea4b0e02679efd5a674ee15238f6b54098`.
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
- the page remains described with schema.org `ItemPage`, a neutral `Thing` main entity, canonical URL, H1-aligned name, plain-text description, manufacturer `Organization`, model as a generic identifier and canonical-host image URLs;
- the existing `BreadcrumbList` is preserved exactly once.

This intentionally gives up Product rich-result eligibility until truthful public price or review data exists. It removes the critical Product enhancement error without inventing commercial facts.

References:

- [Google Product snippet requirements](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Google Product structured data overview](https://developers.google.com/search/docs/appearance/structured-data/product)
- [schema.org ItemPage](https://schema.org/ItemPage)

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

To be completed after the controlled Preview deployment:

- Stage URL: pending.
- After-audit artifact and SHA-256: pending.
- Product Detail audit: pending.
- Representative Google-compatible checks: pending.
- HD-500 / HD-350 redirects, title, H1, JSON-LD and sitemap: pending.
