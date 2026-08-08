# EndoMarket direct source reconciliation v5

Date: 2026-08-09

Branch: `codex/endomarket-catalog-integration-stage-v1`

Authority: direct EndoMarket Product pages

Dataset: `data/import/endomarket-source-truth-reconciliation-v5.json`

Dataset SHA-256: `02db95f0a46d5dd03fcc5ee1c7fb033aafc9eec3fe9ec6f397411b70687c3157`

## Result

The direct source audit is complete for **42/42** new EndoMarket Products. The
dataset preserves the exact source description, every source feature, every
source specification and every clean source-gallery media binding. Previous
generic corrective packages are retained only as history and are not used as
content authority.

| Measure | Source truth | Current Stage exact |
|---|---:|---:|
| Descriptions | 42 | 42/42 |
| Feature rows | 160 | 42/42 Product sets |
| Specification rows | 260 | 42/42 Product sets |
| Clean media assignments | 151 | 42/42 Product sets |
| Unique direct pages | 38 | — |
| Missing direct media | 0 | — |
| Pending media bindings | 0 | — |

SonoScape EB-500 remains the Product Owner-approved normalization reference:
description exact, features 6/6, specifications 7/7 and media 3/3. No isolated
EB-500 patch was performed; it participated only in the single 42-Product
corrective.

The supplied EC-430T URL ending in `ec-430t` returned 404. The direct Product
page that resolves the same exact model is
`https://endomarket.ru/products/videokolonoskop-sonoscape-es-430t`; this URL is
recorded explicitly in the reconciliation dataset. No Product identity was
changed.

## Product-level reconciliation

The comparison format is `description / features / specifications / media`.
`false`/`true` refers to the exact description match. Full descriptions,
feature arrays, specification arrays and media `role/path/checksum` values are
in the machine-readable dataset; they are not abbreviated in that artifact.

| Model | Direct source | Source F | Source S | Source M | Before | Current |
|---|---|---:|---:|---:|---|---|
| `HV-3101` | [source](https://endomarket.ru/products/videoprotsessor-hv-3101-medinova) | 4 | 7 | 3 | false / 3/4 / 3/7 / 4/3 | true / 4/4 / 7/7 / 3/3 |
| `AF` | [source](https://endomarket.ru/products/gibkij-videobronhoskop-medinova-af) | 6 | 0 | 6 | false / 0/6 / 0/0 / 6/6 | true / 6/6 / 0/0 / 6/6 |
| `BR-1231` | [source](https://endomarket.ru/products/gibkij-videobronhoskop-medinova) | 1 | 0 | 4 | false / 7/1 / 9/0 / 4/4 | true / 1/1 / 0/0 / 4/4 |
| `BR-1242` | [source](https://endomarket.ru/products/gibkij-videobronhoskop-medinova) | 1 | 0 | 4 | false / 7/1 / 9/0 / 4/4 | true / 1/1 / 0/0 / 4/4 |
| `BR-1249` | [source](https://endomarket.ru/products/gibkij-videobronhoskop-medinova) | 1 | 0 | 4 | false / 7/1 / 9/0 / 4/4 | true / 1/1 / 0/0 / 4/4 |
| `BR-1259` | [source](https://endomarket.ru/products/gibkij-videobronhoskop-medinova) | 1 | 0 | 4 | false / 7/1 / 9/0 / 4/4 | true / 1/1 / 0/0 / 4/4 |
| `UR-1328` | [source](https://endomarket.ru/products/gibkij-videouretroskop-medinova) | 1 | 6 | 4 | false / 5/1 / 7/6 / 4/4 | true / 1/1 / 6/6 / 4/4 |
| `CY-1355` | [source](https://endomarket.ru/products/gibkij-videotsistonefroskop-medinova) | 1 | 6 | 3 | false / 4/1 / 7/6 / 3/3 | true / 1/1 / 6/6 / 3/3 |
| `CY-1356` | [source](https://endomarket.ru/products/gibkij-videotsistonefroskop-medinova) | 1 | 6 | 3 | false / 4/1 / 7/6 / 3/3 | true / 1/1 / 6/6 / 3/3 |
| `19 HD` | [source](https://endomarket.ru/products/meditsinskij-monitor-medinova-19-hd) | 4 | 12 | 6 | false / 3/4 / 2/12 / 6/6 | true / 4/4 / 12/12 / 6/6 |
| `24 Full HD` | [source](https://endomarket.ru/products/meditsinskij-monitor-medinova-24-full-hd) | 4 | 12 | 6 | false / 3/4 / 2/12 / 6/6 | true / 4/4 / 12/12 / 6/6 |
| `27 Full HD` | [source](https://endomarket.ru/products/meditsinskij-monitor-medinova-27-full-hd) | 4 | 12 | 4 | false / 3/4 / 2/12 / 4/4 | true / 4/4 / 12/12 / 4/4 |
| `32 4K` | [source](https://endomarket.ru/products/meditsinskij-monitor-medinova-32-4k) | 4 | 12 | 6 | false / 3/4 / 2/12 / 6/6 | true / 4/4 / 12/12 / 6/6 |
| `55 4K` | [source](https://endomarket.ru/products/meditsinskij-monitor-medinova-55-4k) | 4 | 12 | 2 | false / 3/4 / 2/12 / 2/2 | true / 4/4 / 12/12 / 2/2 |
| `EG-UR5` | [source](https://endomarket.ru/products/videogastroskop-sonoscape-eg-ur5) | 0 | 0 | 5 | false / 0/0 / 0/0 / 5/5 | true / 0/0 / 0/0 / 5/5 |
| `EG-UC5T` | [source](https://endomarket.ru/products/videogastroskop-sonoscape-eg-uc5t) | 7 | 0 | 4 | false / 0/7 / 0/0 / 4/4 | true / 7/7 / 0/0 / 4/4 |
| `EG-500` | [source](https://endomarket.ru/products/videogastroskop-sonoscape-eg-500) | 8 | 8 | 2 | false / 4/8 / 5/8 / 2/2 | true / 8/8 / 8/8 / 2/2 |
| `EG-500L` | [source](https://endomarket.ru/products/videogastroskop-sonoscape-eg-500l) | 8 | 8 | 2 | false / 0/8 / 0/8 / 2/2 | true / 8/8 / 8/8 / 2/2 |
| `EG-430` | [source](https://endomarket.ru/products/videogastroskop-sonoscape-eg-430) | 8 | 7 | 3 | false / 8/8 / 10/7 / 3/3 | true / 8/8 / 7/7 / 3/3 |
| `EG-430L` | [source](https://endomarket.ru/products/videogastroskop-sonoscape-eg-430l) | 8 | 8 | 3 | false / 0/8 / 0/8 / 3/3 | true / 8/8 / 8/8 / 3/3 |
| `EC-500T` | [source](https://endomarket.ru/products/videokolonoskop-sonoscape-es-500t) | 8 | 8 | 3 | false / 4/8 / 5/8 / 3/3 | true / 8/8 / 8/8 / 3/3 |
| `EC-500L/T` | [source](https://endomarket.ru/products/videokolonoskop-sonoscape-es-500lt) | 8 | 8 | 2 | false / 4/8 / 5/8 / 2/2 | true / 8/8 / 8/8 / 2/2 |
| `EC-430T` | [source](https://endomarket.ru/products/videokolonoskop-sonoscape-es-430t) | 8 | 8 | 3 | false / 7/8 / 10/8 / 3/3 | true / 8/8 / 8/8 / 3/3 |
| `EC-430L/T` | [source](https://endomarket.ru/products/videokolonoskop-sonoscape-ec-430lt) | 8 | 8 | 3 | false / 0/8 / 0/8 / 3/3 | true / 8/8 / 8/8 / 3/3 |
| `EB-5H20` | [source](https://endomarket.ru/products/videobronhoskop-sonoscape-eb-5h20) | 0 | 0 | 4 | false / 4/0 / 5/0 / 4/4 | true / 0/0 / 0/0 / 4/4 |
| `EB-5T28` | [source](https://endomarket.ru/products/videobronhoskop-sonoscape-eb-5t28) | 2 | 0 | 4 | false / 1/2 / 0/0 / 4/4 | true / 2/2 / 0/0 / 4/4 |
| `EB-500` | [source](https://endomarket.ru/products/videobronhoskop-sonoscape-eb-500) | 6 | 7 | 3 | false / 4/6 / 5/7 / 3/3 | true / 6/6 / 7/7 / 3/3 |
| `ED-5GT` | [source](https://endomarket.ru/products/videoduodenoskop-sonoscape-ed-5gt) | 4 | 0 | 3 | false / 0/4 / 0/0 / 3/3 | true / 4/4 / 0/0 / 3/3 |
| `ENDO CLEAN-1000` | [source](https://endomarket.ru/products/ustanovka-dlya-mojki-i-dezinfektsii-endo-clean-1000-medinova) | 13 | 0 | 4 | false / 5/13 / 3/0 / 4/4 | true / 13/13 / 0/0 / 4/4 |
| `ENDO CLEAN-2000` | [source](https://endomarket.ru/products/ustanovka-dlya-mojki-i-dezinfektsii-endo-clean-2000-medinova) | 8 | 0 | 7 | false / 4/8 / 3/0 / 7/7 | true / 8/8 / 0/0 / 7/7 |
| `EC-5BD` | [source](https://endomarket.ru/products/shkaf-dlya-sushki-i-hraneniya-endoskopov-ec-5bd) | 0 | 6 | 8 | false / 8/0 / 5/6 / 8/8 | true / 0/0 / 6/6 / 8/8 |
| `EC-10BD` | [source](https://endomarket.ru/products/shkaf-dlya-sushki-i-hraneniya-endoskopov-ec-10bd) | 0 | 6 | 8 | false / 4/0 / 2/6 / 8/8 | true / 0/0 / 6/6 / 8/8 |
| `VIO + APC 2` | [source](https://endomarket.ru/products/rabochaya-stantsiya-erbe-vio-s-argonovym-modulem-apc-2) | 5 | 0 | 2 | false / 1/5 / 0/0 / 2/2 | true / 5/5 / 0/0 / 2/2 |
| `VIO 200 S` | [source](https://endomarket.ru/products/koagulyator-erbe-vio-200-s) | 0 | 9 | 1 | false / 1/0 / 0/9 / 1/1 | true / 0/0 / 9/9 / 1/1 |
| `VIO 200 D` | [source](https://endomarket.ru/products/koagulyator-erbe-vio-200-d) | 0 | 10 | 1 | false / 1/0 / 0/10 / 1/1 | true / 0/0 / 10/10 / 1/1 |
| `VIO 3` | [source](https://endomarket.ru/products/koagulyator-erbe-vio-3) | 0 | 11 | 2 | false / 1/0 / 0/11 / 2/2 | true / 0/0 / 11/11 / 2/2 |
| `ARC 303` | [source](https://endomarket.ru/products/elektrohirurgicheskij-apparat-arc-303) | 0 | 15 | 2 | false / 1/0 / 0/15 / 2/2 | true / 0/0 / 15/15 / 2/2 |
| `ARC 350` | [source](https://endomarket.ru/products/elektrohirurgicheskij-apparat-arc-350) | 0 | 15 | 2 | false / 1/0 / 0/15 / 2/2 | true / 0/0 / 15/15 / 2/2 |
| `ARC 400` | [source](https://endomarket.ru/products/elektrohirurgicheskij-apparat-arc-400) | 0 | 13 | 3 | false / 1/0 / 0/13 / 3/3 | true / 0/0 / 13/13 / 3/3 |
| `iLivTouch` | [source](https://endomarket.ru/products/apparat-dlya-diagnostiki-pecheni-ilivtouch) | 0 | 0 | 2 | false / 0/0 / 0/0 / 2/2 | true / 0/0 / 0/0 / 2/2 |
| `KS-350` | [source](https://endomarket.ru/products/smotrovoj-stol-met-ks-350) | 4 | 14 | 4 | false / 0/4 / 0/14 / 4/4 | true / 4/4 / 14/14 / 4/4 |
| `1 электропривод` | [source](https://endomarket.ru/products/kushetka-elektromehanicheskaya-zerts) | 10 | 6 | 2 | false / 0/10 / 0/6 / 2/2 | true / 10/10 / 6/6 / 2/2 |

## Invariance

- Product IDs, source UIDs and canonical slugs: unchanged.
- Existing nine bindings: unchanged.
- Production writes: 0.
- Lifecycle writes: 0.
- Migrations: 0.
- Production deployment: unchanged.
