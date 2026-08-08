# EndoMarket corrective v4 — Stage evidence

Date: 2026-08-08  
Branch: `codex/endomarket-catalog-integration-stage-v1`  
Base: `16281b3b3497565943aa2b39976d318ded003225`  
Runtime acceptance commit: `aaab84dbc9c9a785f55e5abcfb8b7f35c5992928`  
Runtime acceptance deployment: `dpl_13cRb4GjLgw9JiRQpq54W36N9Kh1`  
Runtime acceptance URL: `https://medgraph-56g92mb6t-medgraph.vercel.app`  
Vercel project/team: `medgraph` / `medgraph`  
Git/Vercel actor: `cybermedica <cybermedicaooo@gmail.com>`

## Result

R2–R5 corrective v4 is applied to the isolated Stage namespace. The Stage catalog contains exactly 113 unique visible Products: 71 sanitized public projection Products plus 42 EndoMarket preview drafts. Nine imported rows are classified as existing bindings and create no additional Product. Seven bind to visible published Products; HD-550 and EPK-i7010 remain hidden because their canonical slugs are absent from the authoritative 71-Product public projection. The canonical baseline of eight unpublished Products is not exposed.

The first Git-triggered Preview failed closed because Preview correctly had no Production Supabase credentials. The corrective captures only the public, lifecycle-free 71-Product projection as a tracked Stage baseline (projection version 73, checksum prefix `23f7f2b73d7c`) and composes it with the v4 Stage snapshot. No credential was used or copied and no remote write boundary was added.

## Source control

| Source | SHA-256 |
|---|---|
| Full R2–R5 task | `88a3d9c48e41890b34400cdbfa2e42f9544b9d515f870b9d95c1cc982e912058` |
| Corrective v4 JSON | `d2e92c83e7102e83b4be141184d72ec38e55225b779b74391a5b35bfcee34412` |
| Name/media audit v4 CSV | `ea1eb746e9d6d9678773e50b32e6cb39b91b6df3fb40a7e94712335e9df30d3e` |
| Business spec v4 | `3370b0423797089d4b8326c39eb94ad2ffa58d148deeb534f23b4fb57f63aff1` |
| Launch-to-ads roadmap | `a41567e45251bfe1c32bf8c161cd8b0f0f19a66ad42ddff3c9674570a82cbd68` |

The four Product Owner artifacts are preserved byte-for-byte under `data/import/source/`. No generated marketing text supplements the v4 package.

## Catalog and content

| Check | Result |
|---|---:|
| Visible Stage Products | 113 |
| Existing published Products preserved | 71 |
| New EndoMarket drafts | 42 |
| Existing bindings | 9 |
| Visible binding overlays | 7 |
| Hidden unpublished binding rows | 2 |
| Duplicate Product IDs/slugs | 0 / 0 |
| v4 descriptions | 42/42 |
| Products with source features | 32/42 |
| Hidden empty feature sections | 10 |
| Products with source specifications | 24/42 |
| Source-empty specification packages | 18 |
| Imported source specification rows | 128 |
| Separate application tags | 127 |

All six forbidden generic application tags and all generic pseudo-benefit phrases are absent from the 42 drafts. The catalog card contains no technical specification table and renders no more than two application tags plus `+N`. Product Detail renders Description → Key Features (when non-empty) → Technical Characteristics (when non-empty) → all Application Areas → the established supporting/RFQ sections → Manufacturer last. `Страна не указана` is suppressed.

The required 20-route Product Detail coverage contains all 18 new Products, Hamilton-T1 and Mindray SV300. The task called HD-550 an existing published route, but the authoritative 71-Product public projection does not contain it; exposing that binding would violate the stronger 71+42=113 and unpublished-hidden invariants. HD-550 and EPK-i7010 were therefore verified as safe `notFound` pages with no Product-specific RFQ action.

## Media

| Check | Result |
|---|---:|
| Products/source bindings audited | 51 |
| Clean hero | 51/51 |
| Products with gallery | 48/51 |
| Clean unique local assets | 148 |
| Product-media assignments | 193 |
| Draft assignments | 152 |
| Binding assignments | 41 |
| Watermarked source variants rejected | 174 |
| Runtime watermark references | 0 |
| Exact content duplicates rejected | 0 |
| Near duplicates rejected | 0 |
| Fallback media | 0 |
| EC-430T clean media | 3 |

All runtime EndoMarket images resolve to content-addressed files under `public/media/endomarket-wave1/`. A source-gallery image containing a watermark suffix is never selected as hero or gallery media. No remaining fallback Product exists.

## Homepage and UI

The homepage uses exactly the approved clean-image order: EG-500, EC-500T, EB-500, BR-1231, ENDO CLEAN-1000, ENDO CLEAN-2000, EC-5BD and iLivTouch. The approved subtitle and service-partner copy are exact. Cards have canonical `/catalog/<slug>` links and native scroll-snap controls; next/previous, keyboard and mobile swipe behavior are covered by the Stage gate.

The catalog is a single 113-Product namespace. Search finds new and existing products, and manufacturer routes use the same composed repository. Compare is disabled for preview draft data. RFQ links are Product-bound; the public smoke performs no external form submission and confirms `GET /api/request = 405`.

## QA

| Gate | Result |
|---|---|
| `npm ci` | PASS |
| Targeted corrective tests | PASS, 30/30 before baseline corrective; 17/17 final focused suite |
| `npm test` | PASS, 606/606 |
| `tsc --noEmit` | PASS |
| ESLint | PASS |
| Catalog resilience fault tests | PASS, 6/6 |
| Turbopack production build | PASS |
| Webpack production build | PASS |
| Preview security/routes smoke | PASS, 28/28 |
| EndoMarket Stage browser gate | PASS, 11 profiles / 44 Product Detail navigations |
| Additional iOS WebKit smoke | PASS, 3 profiles / 5 routes |
| Chromium desktop/tablet/mobile | PASS |
| WebKit desktop/tablet/iPhone | PASS |
| 390×844 iPhone profile | PASS |
| Horizontal overflow | 0 |
| Runtime browser errors | 0 |
| Search / manufacturer / RFQ | PASS |
| `git diff --check` | PASS |
| Secret/personal-email/legacy-copy scans | PASS |

Visual review covered desktop and mobile homepage, the full catalog, popular equipment, search, manufacturer, seven named Product Detail examples and responsive Product Detail captures. Evidence directory: `docs/reports/evidence/endomarket-corrective-v4-2026-08-08/` (31 PNG files).

## Safety and invariance

- Production writes: 0.
- Lifecycle writes: 0.
- Migrations: 0.
- Production deployment changed: No.
- Production deployment remains `dpl_FxukA7a4SzWyGmJPBG4FniS7E8AQ` (READY).
- `main` remains `19236f7cf18fa332fa58d023acd337908b1b89a9`.
- `production` remains `19236f7cf18fa332fa58d023acd337908b1b89a9`.
- Production projection remains 71 Products / version 73; the public health response was healthy with fallback inactive when the Stage baseline was captured.
- Stage is `noindex, nofollow`; Preview robots disallow crawling.
- No ENV, DNS, Supabase, Product or lifecycle mutation was performed.

## Self-audit closure

The self-audit found and closed three Stage-only issues: missing Preview Supabase configuration was replaced by the sanitized public snapshot; database UUID/public projection ID mismatch was reconciled through exact canonical slugs with model guards; and the conflicting HD-550 route expectation was resolved fail-closed in favor of the explicit unpublished-hidden invariant. The final acceptance found no remaining P0/P1 defect.
