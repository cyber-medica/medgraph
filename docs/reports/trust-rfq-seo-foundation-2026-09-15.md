# Trust + RFQ Conversion + SEO Foundation v1.1

Date: 2026-09-15

Branch: `codex/trust-rfq-seo-foundation-v1-1`

Base: `99e00ee0b8c68a4ebf86b87d76da92c4bd7be639`

## Scope

This sprint adds a focused public trust and RFQ foundation without changing Product data, catalog publication, infrastructure, DNS, Nginx, Vercel, Supabase, analytics providers or advertising.

## Verified public company contract

| Field | Public value |
| --- | --- |
| Full legal name | Общество с ограниченной ответственностью «Кибермедика» |
| Short legal name | ООО «КИМ» |
| INN | 9102256625 |
| KPP | 910201001 |
| OGRN | 1199112011020 |
| Legal address | 295021, Республика Крым, г. Симферополь, ул. Данилова, д. 43, кабинет 32 |
| Phone | +7 (903) 947-72-47 |
| Email | info@cyber-medica.ru |
| Business hours | Пн–Пт, 09:00–18:00 |

Evidence used for this public contract:

- current corporate logistics document dated 2026-09-04 with the exact legal name, INN and KPP;
- public government contract record dated 2025-11-17 with the same legal name, INN, KPP, address and phone;
- current registry-derived OGRN/address record for INN 9102256625;
- current corporate operational email already fixed in the repository infrastructure inventory.

No bank details, directors, founders or personal email addresses are published.

## Implemented

- `/request` now explains its audience, accepted inputs and concrete outputs; it exposes corporate phone/email and exact trust details.
- The form has a required, unchecked consent control linking to the privacy policy and personal-data consent document.
- The backend rejects form submissions without explicit consent while preserving the R9 exact-once rule: `rfq_success` remains after backend success and a valid `requestId` only.
- `/about` and `/contacts` are canonical, indexable pages with one shared factual Organization JSON-LD model.
- `/privacy` and `/personal-data-consent` are linked, noindex-follow legal documents.
- The footer exposes company details, contacts, trust navigation and the RFQ entry point.
- Homepage trust content is normalized to “Что получает заказчик”.
- Product listing cards show factual request terms and Product/RFQ entry points. Registration-document language appears only when the Product already has registration evidence.
- Product Detail MedicalDevice JSON-LD now carries factual `brand`, `model` and `category`, with no invented price, availability or Offer.
- `/about` and `/contacts` are included in the sitemap.
- Catalog, Product Detail and RFQ query variants are noindex-follow when they contain non-attribution parameters. UTM and `yclid` remain available and do not cause noindex on their own.

## SEO route contract

| Route | Canonical | Robots | H1 | Schema | Sitemap |
| --- | --- | --- | --- | --- | --- |
| `/` | `/` | index/follow in exact Production binding | one | WebSite + Organization | yes |
| `/catalog` | `/catalog` | index/follow; filtered query views noindex/follow | one | CollectionPage + BreadcrumbList | yes |
| `/manufacturers` | `/manufacturers` | index/follow | one | CollectionPage + BreadcrumbList | yes |
| `/request` | `/request` | index/follow; prefilled/non-attribution query views noindex/follow | one | none | no |
| `/about` | `/about` | index/follow | one | Organization + BreadcrumbList | yes |
| `/contacts` | `/contacts` | index/follow | one | Organization + BreadcrumbList | yes |
| SEO category landing | exact landing path | index/follow | one | existing contract | yes |
| Product Detail | exact canonical Product path | index/follow; non-attribution query views noindex/follow | one | ItemPage + MedicalDevice + BreadcrumbList | yes |

`robots.txt` and sitemap remain generated from the existing exact Production indexing guard and published catalog snapshot.

## Query-parameter audit

- Catalog filters: `q`, `category`, `manufacturer`, `applicationArea`, `sort` → clean `/catalog` canonical and noindex-follow.
- Product/RFQ context and unknown non-commercial public parameters → clean route canonical and noindex-follow.
- Technical QA families (`lh`, `mobile_synthetic`, `webkit_diagnostic`, `r9_smoke`) retain the existing header-level noindex contract.
- Commercial attribution (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `yclid`) remains intact for R9 and does not receive noindex solely because attribution exists.
- Sitemap generation has no query-string input and cannot emit parameter variants.

## Privacy boundary

- Consent is not preselected.
- The form links both legal documents directly.
- The backend requires `personalDataConsent=accepted` before creating or forwarding a lead.
- No PII is added to analytics. Existing event payload and webhook boundary remain unchanged.
- Legal copy should receive the organization’s normal legal review before merge; no speculative storage duration, certification, dealership or service-level claim was added.

## Validation evidence

| Check | Result |
| --- | --- |
| Targeted trust/RFQ/SEO contract | PASS, 7/7 |
| Full test suite | PASS, 722/722 |
| ESLint | PASS |
| TypeScript | PASS |
| Next.js 16.2.9 Turbopack production build | PASS, 36 static pages generated |
| Existing catalog reliability gate | PASS, 8/8 |
| Chromium desktop route smoke | PASS, 8/8 HTTP 200 |
| WebKit iPhone 390 × 844 route smoke | PASS, 6/6 HTTP 200 |
| H1 contract | PASS, 14/14 pages have one H1 |
| Horizontal overflow | 0 failures |
| First-party console errors | 0 |
| Consent control | present, required, unchecked |
| Missing-consent API guard | PASS, HTTP 400 before lead/webhook creation |
| `rfq_success` source contract | PASS, one call site after backend success and valid `requestId` |
| Sitemap | PASS, `/about` and `/contacts` present; query/debug URLs 0 |
| Organization schema | PASS on `/`, `/about`, `/contacts`; no LocalBusiness/MedicalBusiness |
| Product schema | PASS: ItemPage + MedicalDevice + brand/model/category + BreadcrumbList; offers absent |

The visual run used the bundled validated local catalog and did not submit an
external RFQ. The existing email/webhook boundary was unchanged and remained
covered by the full regression suite; a Preview email-delivery E2E requires an
explicitly approved test lead after the PR deployment.

Evidence:

- `docs/reports/evidence/trust-rfq-seo-foundation-2026-09-15/homepage-desktop-1440.png`
- `docs/reports/evidence/trust-rfq-seo-foundation-2026-09-15/request-desktop-1440.png`
- `docs/reports/evidence/trust-rfq-seo-foundation-2026-09-15/request-mobile-webkit-390.png`
- `docs/reports/evidence/trust-rfq-seo-foundation-2026-09-15/about-desktop-1440.png`
- `docs/reports/evidence/trust-rfq-seo-foundation-2026-09-15/contacts-mobile-webkit-390.png`
- `docs/reports/evidence/trust-rfq-seo-foundation-2026-09-15/product-mobile-webkit-390.png`
- `docs/reports/evidence/trust-rfq-seo-foundation-2026-09-15/visual-seo-rfq-qa.json`

## Rollout plan

1. Review this PR and visual evidence; do not merge automatically.
2. Confirm legal text and exact public corporate details with the responsible owner.
3. Use a Preview deployment with existing approved Preview configuration.
4. Run the full CI suite plus desktop/mobile smoke and an RFQ test against Preview only.
5. After explicit merge approval, use the canonical release process; do not create an independent Production deployment from this branch.
6. Post-release: verify the public routes, one real Product RFQ context, schema output, sitemap and the exact-once `rfq_success` contract.

## Invariants

- Product writes: 0
- Lifecycle writes: 0
- Migrations: 0
- Dependency changes: 0
- Production deployment changes: 0
- DNS/Nginx/Vercel/Supabase changes: 0
- Advertising changes: 0
