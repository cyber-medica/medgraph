# Catalog / Manufacturers / Suppliers UX v1

Дата проверки: 2026-08-12

Среда: Vercel Preview / Stage only

Base commit: `22899bed74c4761368c513ac073a5cf2437d3d3e`

## Safety boundary

- Product и lifecycle writes: 0.
- Production deploy, alias, ENV, DNS и Supabase не изменялись.
- Реализация использует существующий Storefront data layer и canonical `ProductCard`.
- Supplier-модель и supplier routes в текущем public runtime отсутствуют. Это сохранено как fail-closed состояние: supplier discovery равен 0, `/suppliers/*` возвращает 404, supplier URL отсутствуют в sitemap.

## Authoritative inputs

| Input | SHA-256 |
|---|---|
| `cybermedica_codex_catalog_manufacturers_suppliers_ux_only_v1.txt` | `48ed0443beb5adc94bafe434e04af35f21d7808af0ee431eea2f0aaa262e94df` |
| `cybermedica_catalog_manufacturer_supplier_ux_business_spec_v1.md` | `de86bca2baa4836e222e9c20158750e5524de65ebe40c56de0f55289d21ffc42` |
| `cybermedica_catalog_manufacturer_supplier_ux_contract_v1.json` | `3892ae614eb14d09441886de346c19d69eacef3865b92fbd2399128c14b573d3` |
| `cybermedica_manufacturer_logo_source_manifest_v1.csv` | `e8ed811cce45d5ffdd147cd4bdc8938e8f010e1d99fc7d9f24ef843808400076` |

Две приложенные UX-only копии имеют одинаковый SHA-256 и считаются одним входным контрактом.

## Implemented UX contract

- Большие статические KPI-сводки удалены из `/catalog` и `/manufacturers` без пустых колонок.
- Нефильтрованный каталог не показывает redundant result counter.
- Поиск и фильтры показывают компактное `Найдено: N`.
- Manufacturer detail использует logo slot максимум `200×56` на desktop и `150×40` на mobile, `object-fit: contain`, нейтральный фон и доступный alt/fallback.
- Большой Product count KPI удалён; количество осталось небольшим контекстом возле Product grid.
- Catalog, manufacturer detail и related listings используют один canonical `ProductCard`.
- Manufacturer canonical URLs и Product canonical URLs не менялись.

## Manufacturer logo reconciliation

Проверено: 31/31 canonical manufacturer slug.

Graphic assets опубликованы только для двух производителей:

| Manufacturer | Rights status | Local asset SHA-256 |
|---|---|---|
| Fresenius Kabi | `READY_WITH_TERMS` | `a6c339f1784f9df5f69fbc3d04fc0930eb425ea5aa854eb0062873b51600a883` |
| Olympus | `READY_WITH_GUIDELINES` | `24e0348689afdcaa18224f424145625ae3dddb4398f5a2f47f6aec9876d0a330` |

Runtime hotlinks отсутствуют. Оба assets хранятся локально, пропорции сохранены.

Typographic fallback используется для 29 производителей:

- `PERMISSION_REQUIRED` (2): Ambu, Philips.
- `RIGHTS_REVIEW` (26): AOHUA, B. Braun, Bionet, БИОТЕК / Biotech, BOWA MEDICAL, Canon Medical Systems, COMEN, DIXION, Dräger, Электрон, ERBE, GE HealthCare, Hamilton Medical, HUGER, Huntleigh Healthcare, iLivTouch, Longfian, Medinova, MET, Mindray, НПП «Монитор», PENTAX Medical, SonoScape, УНИКОС, УОМЗ, ZERTS.
- `ASSET_UNRESOLVED` (1): TRISMED.

## Verification

- Full Node test suite: 664/664 PASS.
- Targeted UX suite: 39/39 PASS.
- TypeScript: PASS.
- ESLint: PASS.
- `git diff --check`: PASS.
- Stage Turbopack production build: PASS; 172 static pages generated.
- Published catalog reliability gate: 8/8 PASS.
- Dedicated iOS WebKit smoke: 3 profiles × 5 routes PASS.
- Extended Stage browser smoke: Chromium + WebKit, 11 profiles, 47 Product Detail routes, 42/42 imported Products and 114 visible Stage Products PASS.
- Manufacturer browser audit: 31/31 routes PASS; graphic/fallback `2/29`; broken images 0; overflow 0.
- Supplier direct route probe: HTTP 404 PASS.
