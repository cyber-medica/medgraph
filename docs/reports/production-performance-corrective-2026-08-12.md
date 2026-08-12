# Кибермедика — Production Performance Corrective v1

Статус: Stage PASS. Production не изменялся.

## Release

- Branch: `codex/production-performance-corrective-v1`
- Base: `d6369e656aedf86a62bc089781f761cb76b65850`
- Performance runtime commit: `e42b1e195b746171c610b82fa6f874d48bce640f`
- Measured final runtime deployment: `dpl_8f2hoDFmYgKmySQ8zrhRnagYWJBC`
- Stage: <https://stage.cyber-medica.ru>
- Machine-readable evidence: `docs/reports/production-performance-corrective-2026-08-12.json`

The complete performance run set was captured on runtime-equivalent deployment
`dpl_5wDEH94xRe97Ja2Koc12kmmfP5zU`. Later runtime changes only corrected
foreground contrast, a stale responsive-image test expectation and an
accessible-name advisory. The resulting runtime was rebuilt and rerun through
the route, WebKit and accessibility gates.

## Proven root causes

### Initial document / SSR

Anonymous server-rendered routes repeated the complete published-projection
transport read. Production logs showed successful reads at 1.45–3.57 seconds;
transient retry/fallback paths took about 10.7 seconds. Metadata and page reads
could also repeat the work inside one request family.

Corrective: a checksum-validated 60-second `unstable_cache` now serves public
read-model requests, with React request memoization on top. The catalog health
endpoint calls the fresh loader explicitly, so the cache cannot misreport live
transport health. No mutation or RFQ response is cached.

### Mobile LCP

The measured LCP was the Hamilton-T1 hero image. It was discovered only after
catalog resolution, used a wider-than-rendered responsive candidate and spent
about 3.24 seconds in resource-load delay in the old trace.

Corrective: the server emits an early responsive LCP hint from the validated
bundled snapshot, while the rendered Product still comes from the active
catalog source. The actual image retains `next/image`, exact `sizes`, preload
and high fetch priority. The measured transferred candidate fell from about
37 KiB to 12.3 KiB; remaining image-waste guidance is about 8.7 KiB rather than
the supplied 188 KiB opportunity.

### Desktop CLS

Trace evidence identified the footer moving when the short global streaming
shell (`70vh`) was replaced by full page content. The shell now reserves a full
viewport. Median desktop CLS is 0.

### Console and contrast

First-party browser console errors are zero. The only Lighthouse console/Issues
entry on Preview is Vercel's injected feedback toolbar being blocked by the
canonical CSP. CSP was not weakened for preview-only tooling. Two low-contrast
foregrounds were darkened without changing layout; final accessibility is
100/100.

## Homepage before / after

Three cold Lighthouse 13.4.1 runs were collected per route and form factor.
Tables use medians, not best runs.

| Mobile | Before PSI | Stage median |
|---|---:|---:|
| Performance | 83 | 96 |
| FCP | 0.9 s | 1.098 s |
| LCP | 3.9 s | 2.778 s |
| TBT | 70 ms | 21 ms |
| CLS | 0 | 0 |
| Speed Index | 5.6 s | 1.833 s |
| Server response | — | 34 ms |

The simulated mobile median LCP remains 278 ms above the requested 2.5-second
line, while the primary Performance target, CLS and TBT are green. Individual
runs were 2.551–3.263 seconds and the observed median trace painted the selected
12.3 KiB image at about 1.2 seconds. The remaining variance is network/simulator
latency, not main-thread work; further preloading or weakening catalog safety
would be a riskier tradeoff.

| Desktop | Before PSI | Stage median |
|---|---:|---:|
| Performance | 84 | 99 |
| FCP | 0.3 s | 0.438 s |
| LCP | 1.0 s | 0.828 s |
| TBT | 40 ms | 0 ms |
| CLS | 0.25 | 0 |
| Speed Index | 1.5 s | 0.655 s |
| Server response | — | 36 ms |

## Other mandatory routes

| Route | Form | Perf | FCP | LCP | TBT | CLS | SI | Server response |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `/catalog` | Mobile | 94 | 1.234 s | 3.062 s | 20 ms | 0 | 2.514 s | 52 ms |
| `/catalog` | Desktop | 82 | 1.222 s | 1.642 s | 0 ms | 0 | 3.768 s | 510 ms |
| `/manufacturers` | Mobile | 96 | 1.060 s | 2.851 s | 1 ms | 0 | 1.398 s | 39 ms |
| `/manufacturers` | Desktop | 97 | 0.781 s | 0.821 s | 0 ms | 0 | 1.678 s | 65 ms |
| Hamilton-T1 | Mobile | 85 | 1.365 s | 3.284 s | 16 ms | 0 | 8.501 s | 128 ms |
| Hamilton-T1 | Desktop | 84 | 1.195 s | 1.528 s | 0 ms | 0 | 3.725 s | 96 ms |
| SonoScape heavy gallery | Mobile | 95 | 1.024 s | 3.004 s | 0 ms | 0 | 2.054 s | 28 ms |
| SonoScape heavy gallery | Desktop | 100 | 0.343 s | 0.733 s | 0 ms | 0 | 0.756 s | 30 ms |
| `/catalog/endoskopiya` | Mobile | 94 | 1.025 s | 3.080 s | 12 ms | 0 | 1.743 s | 32 ms |
| `/catalog/endoskopiya` | Desktop | 100 | 0.360 s | 0.730 s | 0 ms | 0 | 0.629 s | 36 ms |

The below-90 Product/desktop catalog scores retain green LCP, TBT and CLS where
applicable. Variance came from Chrome trace/network scheduling and image edge
delivery rather than long main-thread work. No risky global preload was added.

## Optimization inventory

- Catalog reads: shared validated 60-second server cache; per-request memoization;
  separate fresh health read.
- Images: exact homepage LCP priority; early responsive hint; narrower hero,
  card and gallery `sizes`; below-fold carousel lazy loading; smaller logo
  intrinsic sizes.
- Layout: full-height streaming shell removes the proven footer shift.
- JavaScript: immediate R9/Metrica command queue retained; external Metrica
  network load delayed for five seconds or first pointer/keyboard intent.
- Fonts: system typography only; no custom-font requests or swap-induced shift,
  so no font change was justified.
- Cache headers: hashed Next assets retain immutable caching; optimized images
  retain the existing 60-day revalidation policy. Mutable HTML/API responses
  remain non-immutable.
- Render blocking: no large inline CSS or new dependency. The material work was
  the early LCP hint and third-party script deferral.

## Safety and invariance

- Production health: `healthy`; `liveTransport=healthy`;
  `fallbackActive=false`; projection `75` / `a3c933eb1bf4`.
- Production published snapshot: 114 Products; sitemap: 114 unique Product URLs.
- Stage health is deliberately honest: `degraded`, `fallbackActive=true`
  because Preview does not receive or impersonate the Production service
  boundary. Its approved Cloud Preview catalog remains isolated. This state is
  not presented as healthy and does not affect the Production health result.
- R9 and Metrica `98376495`: PASS through exact contract tests.
- SEO, canonical, JSON-LD, sitemap, redirects and Product integrity: PASS.
- Production deployment remains `dpl_3jdAxhmrergpjzw8qbC9N7GtxWvX`.
- Remote `main` and `production` remain
  `d6369e656aedf86a62bc089781f761cb76b65850`.
- Product/lifecycle writes: 0. Production deployment changes: 0.

The live manufacturer directory currently exposes 25 non-empty manufacturer
routes on the canonical deployment. This is unchanged by the corrective; the
task's earlier reference to 19 was stale relative to the supplied canonical
SHA and live sitemap.

## QA

- Full tests: 680/680.
- Targeted performance/resilience/R9/SEO/release tests: 47/47.
- Catalog reliability fault-injection gate: 8/8.
- ESLint: PASS.
- TypeScript: PASS.
- Local Webpack production build: PASS.
- Vercel Turbopack build: PASS.
- Stage HTTP/security smoke: 28/28.
- WebKit: 3 isolated profiles × 5 routes = 15/15.
- Chromium visual/mobile QA: PASS; no horizontal overflow or first-party errors.
- Accessibility: 100/100.
- `GET /api/request`: 405.

## Evidence

- `docs/reports/evidence/production-performance-corrective-2026-08-12/stage-home-desktop.png`
- `docs/reports/evidence/production-performance-corrective-2026-08-12/stage-home-mobile-390x844.png`
- `docs/reports/evidence/production-performance-corrective-2026-08-12/stage-hamilton-mobile-390x844.png`

Advisory backlog only: strict HSTS and Trusted Types need a separate security
rollout, and the Preview-toolbar CSP diagnostic must not be addressed by
weakening the production CSP.
