# Manufacturer logo audit v2

Дата аудита: 2026-08-13
Canonical base: `00e691836dae5dffe80380336d9d0787364d0699`

## Результат

- Опубликованных Products: 114.
- Manufacturer records в published projection: 31.
- Публичных non-empty manufacturer routes: 25.
- Zero-product manufacturers вне UI scope: 6 (`ambu`, `aohua`, `biotech-m`, `drager`, `huger`, `philips`).
- Graphic logos до corrective: 2.
- Graphic logos после corrective: 8.
- Polished monogram fallbacks: 17.
- Graphic upgrades, оставленные на manual rights/asset review: 17; это не блокирует публичный fallback.
- External runtime logo URLs: 0.

Machine-readable source of truth: [`manufacturer-logo-manifest-v2.json`](./manufacturer-logo-manifest-v2.json).

## Принцип отбора

Graphic asset принят только с официального manufacturer/brand domain, сохранён локально, checksum-pinned и используется без изменения пропорций или цвета. Наличие логотипа на сайте само по себе не считалось достаточным: low-resolution icons, anniversary artwork, файлы с чрезмерным whitespace и assets без защищаемой public-brand-use основы отклонены. В таких случаях остаётся нейтральный monogram fallback.

Новые graphic assets используются исключительно для идентификации производителя рядом с его названием. Товарные знаки остаются собственностью соответствующих правообладателей.

## Fallback → graphic

| Manufacturer | Slug | Products | Official source | Confidence | Local asset |
|---|---|---:|---|---|---|
| B. Braun | `b-braun` | 1 | Official brand page | MEDIUM | `/manufacturers/b-braun/logo.svg` |
| Bionet | `bionet` | 5 | Official manufacturer site/CDN | MEDIUM | `/manufacturers/bionet/logo.svg` |
| Comen | `comen` | 4 | Official manufacturer site/CDN | MEDIUM | `/manufacturers/comen/logo.png` |
| GE HealthCare | `ge-healthcare` | 9 | Official brand hub | MEDIUM | `/manufacturers/ge-healthcare/logo.png` |
| Huntleigh | `huntleigh` | 2 | Official manufacturer website | MEDIUM | `/manufacturers/huntleigh/logo.png` |
| PENTAX Medical | `pentax-medical` | 5 | Official medical manufacturer website | MEDIUM | `/manufacturers/pentax-medical/logo.svg` |

## Existing approved graphics retained

| Manufacturer | Slug | Products | Confidence | Local asset |
|---|---|---:|---|---|
| Fresenius Kabi | `fresenius-kabi` | 1 | HIGH | `/manufacturers/fresenius-kabi/logo.png` |
| Olympus | `olympus` | 3 | HIGH | `/manufacturers/olympus/logo.png` |

## Intentionally retained fallbacks

| Manufacturer | Slug | Products | Причина |
|---|---|---:|---|
| BOWA | `bowa` | 3 | Clean official downloadable asset/use basis не подтверждены. |
| Canon Medical | `canon-medical-systems` | 3 | Official header wordmark слишком широкий для читаемого display; reuse terms не подтверждены. |
| DIXION | `dixion` | 10 | Не подтверждён isolated current rights-cleared asset. |
| Электрон | `electron` | 1 | Требуется ручная сверка current identity provenance. |
| ERBE | `erbe` | 4 | Доступные official raster assets имеют whitespace либо anniversary treatment. |
| Hamilton Medical | `hamilton-medical` | 3 | Доступен только 40×41 icon, не полный wordmark; raster enlargement запрещён. |
| iLivTouch | `ilivtouch` | 1 | Требуется ручная сверка manufacturer/distributor attribution и разрешения. |
| Longfian | `longfian` | 1 | Clean downloadable asset с reuse basis не подтверждён. |
| Medinova | `medinova` | 18 | Brand ownership и public artwork use требуют ручной проверки. |
| MET | `met` | 1 | Current official downloadable asset/use terms не подтверждены. |
| Mindray | `mindray` | 14 | Official new-logo raster имеет только 99×30 px; enlargement запрещён. |
| НПП «МОНИТОР» | `monitor` | 1 | Current wordmark asset/use basis требуют ручной проверки. |
| SonoScape | `sonoscape` | 17 | Current official page не выдаёт clean standalone asset. |
| TRISMED | `trismed` | 1 | Company подтверждена регулятором, current official logo asset не найден. |
| УНИКОС | `unicos` | 1 | Rights-cleared downloadable wordmark не подтверждён. |
| УОМЗ | `uomz` | 4 | Medical identity provenance/use basis требуют ручной проверки. |
| ZERTS | `zerts` | 1 | Current official downloadable asset/use basis не подтверждены. |

## Local asset integrity

| Slug | Format | Intrinsic dimensions | SHA-256 |
|---|---|---|---|
| `b-braun` | SVG | 172×42 | `daea6df088b4c38074d26867a17c5062b6b9702356d223e2116cdc333effdb9d` |
| `bionet` | SVG | viewBox 3831.64×1019.221 | `b42edc16fbbd143fa514afb57a5ec0cd69cd94ccb8df30ed5f760dca915156b5` |
| `comen` | PNG RGBA | 565×91 | `2e45b04e9a91d35770ab9c545f930fff989a4394b09b1c035bee4fe1479056e0` |
| `fresenius-kabi` | PNG RGBA | 1200×323 | `a6c339f1784f9df5f69fbc3d04fc0930eb425ea5aa854eb0062873b51600a883` |
| `ge-healthcare` | PNG RGBA | 332×72 | `24ba4080fa302c61bbe47a57edbbe2632152d6286c7e6d33c797fc099672d82a` |
| `huntleigh` | PNG RGBA | 392×91 | `0e6a721f3baebbc146b386c68804496363e2a7bf26e68d4f8a2110d2b4e79bc9` |
| `olympus` | PNG RGBA | 1470×282 | `24e0348689afdcaa18224f424145625ae3dddb4398f5a2f47f6aec9876d0a330` |
| `pentax-medical` | SVG | 226×84 | `30947445e14687837fe8391eaf9c762e780add6cb950ccdd97c5a86d55281307` |

SVG assets contain no scripts, external runtime references or embedded remote resources.

## UI and performance contract

- Hero graphic max: 200×56 px desktop, 150×40 px mobile.
- Rendering: intrinsic dimensions plus `object-fit: contain`; no raster enlargement or forced recoloring.
- GE HealthCare official white asset receives a local dark neutral surface instead of recoloring.
- Above-fold detail hero loads eagerly; listing graphics remain lazy.
- Fallback remains a neutral, explicitly typographic monogram and never imitates official artwork.
- Existing metadata/JSON-LD logo allowlist remains limited to the two previously approved assets; the six visual upgrades do not change SEO metadata.
- ProductCard, Product counts, Product assignments, SEO, R9, RFQ, sitemap and catalog data are unchanged.

## Validation

Stage evidence and route/browser results are recorded in the release handoff after the controlled Preview deployment. Production writes and Production deployment changes are prohibited for this task.
