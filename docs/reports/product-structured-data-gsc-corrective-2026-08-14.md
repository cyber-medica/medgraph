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

- Stage URL: `https://medgraph-ovoh20662-medgraph.vercel.app`.
- Deployment: `dpl_85w8AFitKSqp8W7pFu4Cazm3DE5F` (`READY`, Preview).
- Runtime commit: `6c8888676cd5e364f5cfd2e42cc6f45b8a506589`.
- After-audit artifact: `/tmp/product-structured-data-gsc-after-2026-08-14.json`.
- After-audit SHA-256: `49698440c3819b9f666c93e01efe8d7a8b7bf2bfad501dca3abffb3bb70a128a`.

| Check | Result |
|---|---:|
| Product Detail routes audited | 114 |
| HTTP 200 | 114 |
| `ItemPage` detected | 114 |
| Google `Product` detected | 0 |
| `BreadcrumbList` detected | 114 |
| Name equals visible H1 | 114 |
| Plain-text structured descriptions | 114 |
| Canonical-host structured images resolve | 114 |
| Google Product critical errors caused by our markup | 0 |
| Stage matrix PASS | 114/114 |

Representative Product Detail checks passed for Hamilton-T1, SonoScape HD-550, Medinova ENDO CLEAN-2000, Mindray SV300 and BOWA ARC 350. All render `ItemPage` plus one `BreadcrumbList`; none declares Product commerce, Offer, price, review or rating data.

The two expected SonoScape URLs return exact HTTP 301 responses and reach their canonical Product pages in one hop. Both canonical pages return HTTP 200 with the correct title and H1 and the new JSON-LD contract.

Preview indexing remains intentionally disabled, so its sitemap is empty by design. The unchanged Production sitemap contains 114 unique canonical Product URLs, includes both HD-500 and HD-350 canonical routes, and contains neither redirect alias.

WebKit smoke passed across iPhone Safari portrait, iPhone WebKit landscape and desktop Safari/WebKit for homepage, catalog, request, HD-500 Product Detail and internal login.

Production invariance after Preview deployment:

- deployment: `dpl_HZPTg2vU7Z3wbYg3W2iQfQx9qJ5e`;
- SHA: `f09fe0ea4b0e02679efd5a674ee15238f6b54098`;
- Products: `114`;
- projection version: `75`;
- `liveTransport`: `healthy`;
- `fallbackActive`: `false`;
- Product/lifecycle writes and migrations: `0`.
