# Manufacturer logos and canonical breadcrumbs — Stage v1

Дата: 2026-08-13
Режим: Stage-only
Base: `cd3b3a1b938af8d9516c525325e16a32704fe522`

## Результат

На Stage подготовлено 25 из 25 локальных графических логотипов публичных производителей и один server-rendered breadcrumb-компонент для публичных storefront-маршрутов. Product data, assignments, descriptions, specifications, lifecycle, SEO copy, sitemap, R9, Metrica, RFQ, Supabase, migrations и dependencies не менялись.

Для воспроизводимого визуального Stage-аудита exact feature-ветка читает уже tracked checksum-validated 114-Product last-known-good snapshot. Branch gate не действует в Production, не требует Production credentials и не изменяет общий Preview catalog.

## Логотипы

- Public manufacturers: 25.
- Graphic logos: 25.
- Existing graphic assets retained: 8.
- New local Stage assets: 17.
- Official-source records: 22.
- Secondary-source records: 3.
- Production-ready under the current evidence policy: 8.
- Require rights/brand review before Production: 17.
- External runtime logo URLs: 0.

Все знаки загружаются из `/public/manufacturers/<slug>/`, имеют intrinsic dimensions и checksum. Компонент использует `object-fit: contain`, bounded viewport и per-logo `opticalScale`. Для светлого official wordmark «Электрон» сохранена тёмная нейтральная подложка; цвета знаков не изменялись. У Hamilton Medical и Mindray обрезано только пустое поле SVG viewBox — пути и цветовые значения не редактировались.

Stage approval не означает автоматического Production rights approval. Hamilton Medical и Mindray используют архивные authentic vectors, сверенные с official brand evidence. УНИКОС использует reputable trademark-registry mirror. Эти три записи, а также остальные новые assets с незавершённым reuse record, имеют `productionReady: false`.

Полный provenance, hashes и policy status: `docs/reports/all-manufacturer-logos-stage-v1.json`.

## Breadcrumb contract

Canonical core: `components/navigation/Breadcrumbs.tsx`.

Контракт:

- homepage: breadcrumbs отсутствуют;
- catalog: `Главная / Каталог`;
- manufacturers: `Главная / Производители`;
- manufacturer detail: `Главная / Производители / [Производитель]`;
- Product Detail: `Главная / Каталог / [Primary category] / [Product H1]`;
- SEO category pages: только существующие crawlable parent levels;
- solution page: `Главная / Решения / [Текущая страница]`.

Primary category rule детерминирован: берётся единственный текущий `Product.categoryId` и соответствующая существующая catalog category. Категория не выводится из описания, application areas или SEO landing. Product visible current item и BreadcrumbList получают один `productH1`, поэтому иерархии совпадают.

Удалены:

- permanent standalone `Назад к каталогу`;
- standalone `← Все производители`;
- legacy `Кибермедика · Каталог`;
- route-specific visual breadcrumb variants;
- второй параллельный navigation row.

Сохранено внутреннее sessionStorage-состояние каталога, которое восстанавливает scroll при обычном browser Back, но оно больше не рендерит отдельный UI control.

Компонент использует semantic `nav`, ordered list, real `Link` parents, `aria-current="page"`, focus-visible и mobile-safe wrapping/truncation. Он не является Client Component и не добавляет blocking JavaScript.

Полный route audit: `docs/reports/navigation-breadcrumb-audit-v1.json`.

## QA contract

Targeted automated coverage проверяет:

- 25/25 local graphic assets и hashes;
- отсутствие SVG scripts, `foreignObject` и external runtime references;
- ровно один canonical breadcrumb на non-homepage routes;
- отсутствие breadcrumb на homepage;
- отсутствие legacy navigation markers;
- `aria-current`, focus-visible и mobile overflow;
- Chromium desktop/mobile и WebKit iPhone 390×844;
- all 25 manufacturer routes, five representative Product Detail routes и все six SEO/solution routes.

Runtime QA и Lighthouse evidence фиксируются после Stage deployment; Production deployment не меняется.

## Production disposition

Product Owner принял canonical breadcrumb contract полностью и разрешил для Production ровно 22 графических логотипа с `officialSource: true`. Три Stage-only secondary-source asset — Hamilton Medical, Mindray и УНИКОС — в Production policy остаются типографическими fallback; их файлы не входят в Production release. Это не возвращает прежний консервативный набор 8/17: остальные 22 official-source graphics сохраняются.
