# EndoMarket source-truth corrective v5 — Stage evidence

Date: 2026-08-09

Branch: `codex/endomarket-catalog-integration-stage-v1`

Source audit: **42/42 complete**

Source-truth SHA-256: `02db95f0a46d5dd03fcc5ee1c7fb033aafc9eec3fe9ec6f397411b70687c3157`

## Controlled corrective

One deterministic Stage-only corrective updated the exact 42 EndoMarket draft
Products from the direct-source reconciliation dataset. It preserved Product
identity, the nine existing bindings, the 71-Product published Stage baseline
and every Production boundary.

| Check | Result |
|---|---:|
| Stage visible Products | 113 |
| Published baseline Products | 71 |
| New EndoMarket drafts | 42 |
| Existing bindings | 9 |
| Source descriptions applied | 42 |
| Source feature rows applied | 160 |
| Source specification rows applied | 260 |
| Feature sections hidden because source is empty | 11 |
| Draft media assignments | 151 |
| All Stage media assignments | 192 |
| Unique clean local assets | 148 |
| Watermark runtime assets | 0 |
| Fallback media | 0 |

HV-3101 was reconciled to the current three-image direct gallery. Two obsolete
HV-3101 bindings were removed and one clean current source image was recovered
through an already existing identical content-addressed asset. No duplicate
file was introduced.

The Product Detail hero now bounds optional summary copy to four lines and
centers the content column at desktop widths. The full source description
remains visible in the Description section. EndoMarket source features bypass
the generic six-item/160-character presentation truncation so every preserved
source feature is rendered; the compact limit remains unchanged for all other
Products. Plain technical values such as `< 30 Ватт` are accepted while real
HTML tags remain rejected.

## QA

| Gate | Result |
|---|---|
| Direct source/reconciliation tests | PASS, 42/42 |
| Focused importer/UI tests | PASS, 29/29 final focused run |
| Full test suite | PASS after sandbox listener rerun; 614 effective tests |
| ESLint | PASS, 0 errors / 0 warnings |
| TypeScript | PASS |
| Catalog transport resilience | PASS, 6/6 |
| Turbopack production build | PASS |
| Webpack production build | PASS |
| Browser Stage gate | PASS, 11 profiles / 68 Product Detail navigations |
| All new draft Product Detail routes | PASS, 42/42 |
| Separate iOS/WebKit smoke | PASS, 3 profiles / 5 routes |
| 390×844 mobile | PASS |
| Horizontal overflow | 0 |
| Browser runtime errors | 0 |
| Search / manufacturer / RFQ | PASS |
| Hero blank-space regression | NONE |

The initial full-suite run had one `EPERM` caused by the sandbox prohibiting a
test-local listener. That exact nine-test contract passed outside the sandbox;
no application assertion failed.

Local visual evidence is stored in
`docs/reports/evidence/endomarket-source-v5-2026-08-09/` (35 PNG files),
covering desktop and iPhone home/catalog views plus representative source-rich
Product Detail pages including EB-500, HV-3101, CY-1355 and KS-350.

## Safety

- Production writes: 0.
- Lifecycle writes: 0.
- Production deployment changed: No.
- `main` push: none.
- `production` push: none.
- Migrations, ENV and DNS: unchanged.
- Stage remains Preview-only and noindex.

Deployment URL, deployment ID, final commit and public Preview smoke are added
only after the feature-branch Preview reaches READY.
