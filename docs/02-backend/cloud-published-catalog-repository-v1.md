# Cloud Published Catalog Repository v1

> Нормативная основа: [PROJECT_GUIDE.md](../00-project/PROJECT_GUIDE.md),
> [ADR-002](../00-project/ADR/ADR-002-storefront-repository-boundary.md) и
> [ADR-006](../00-project/ADR/ADR-006-product-publication-foundation.md).

**Статус:** corrective v3 реализован и проверен локально; ожидает targeted Independent Adapter Re-Review v4

**Версия:** 1.3

**Дата:** 27 июля 2026 года

**Scope:** published-only Storefront read adapter; без UI, Product Data и publication writes

## 1. Назначение

`CloudPublishedCatalogRepository` — Production-safe реализация существующего
`CatalogRepository`. Она не вводит новый service/domain contract и не меняет
`ProductService`:

    Public Server Route
      -> Storefront Service
      -> CatalogRepository
      -> CloudPublishedCatalogRepository
      -> cloud_api.cloud_published_storefront_catalog_v1()
      -> strict runtime validation
      -> Storefront Domain Model

Adapter находится в
`lib/storefront/cloud-published-catalog-repository.ts`. Mapper и безопасная
response boundary находятся рядом в `lib/storefront/`.

## 2. Data-source contract

| Source | Local/Preview | Vercel Production | Назначение |
| --- | --- | --- | --- |
| `static` | разрешён | разрешён | explicit filesystem fallback/local fixture |
| `cloud_preview` | разрешён | запрещён guard-ом | visual review draft-данных staging |
| `cloud_published` | разрешён явно | разрешён | published-only Cloud projection |

Значение по умолчанию остаётся `static`. Неизвестное значение отклоняется.
Ошибка `cloud_published` не переключает runtime на static или cloud_preview.
Rollback источника является отдельным контролируемым ENV change, а не скрытым
fallback внутри request.

## 3. ENV contract

| Variable | Required for `cloud_published` | Exposure | Purpose |
| --- | --- | --- | --- |
| `CATALOG_DATA_SOURCE=cloud_published` | да | server configuration | explicit source selection |
| `CYBERMEDICA_SUPABASE_URL` | да, только runtime | строго server-only | exact Supabase project origin для Published transport |
| `CYBERMEDICA_SUPABASE_PROJECT_REF` | да, только runtime | строго server-only | explicit approved 20-character project identity |
| `SUPABASE_SECRET_KEY` | да, только runtime | строго server-only | preferred `sb_secret_*` key; sent only as `apikey` after binding validation |
| `SUPABASE_SERVICE_ROLE_KEY` | только на переходный период | строго server-only | legacy service-role JWT compatibility; mutually exclusive with `SUPABASE_SECRET_KEY` |
| `NEXT_PUBLIC_SUPABASE_URL` | нет | browser-safe/public path | используется другими явно выбранными Supabase paths; Published adapter игнорирует |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | нет | browser-safe public credential | preferred public key; Published adapter игнорирует |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | нет | browser-safe public credential | temporary legacy anon JWT compatibility; Published adapter игнорирует |
| `VERCEL_ENV` | да в Vercel; `production`, `preview` или local `development` | server configuration | выбирает один compiled approved project ref; неизвестное/отсутствующее Vercel-значение отклоняется |
| `CYBERMEDICA_ALLOW_LOCAL_SUPABASE_ORIGIN=1` | только synthetic local QA с `NODE_ENV=test` | server-only test flag | разрешает fixed HTTP loopback ref строго вне Vercel |

Выбран **Option A — runtime-only server configuration**. Build не требует и не
читает server-only Published credential values. Runtime получает URL, project ref
и privileged key из `process.env`; `NEXT_PUBLIC_SUPABASE_URL` не является
authoritative origin и может относиться к другому browser-safe path. Build
artifact не связывается с build-time project origin.

Перед созданием transport URL выполняются две независимые проверки:

1. compiled server-only allowlist выбирает единственный ref для фактической
   deployment environment;
2. configured URL обязан точно соответствовать выбранному и configured ref.

Для Cloud допустим только exact origin
`https://<approved-project-ref>.supabase.co`: HTTPS, без credentials, port,
path, query и hash. Ref должен состоять ровно из 20 lowercase ASCII
letters/digits. Совпадающая URL/ref-пара произвольного третьего Supabase
проекта, custom host, suffix/prefix confusion, trailing dot, percent encoding
и mismatch отклоняются до `fetch`. Ошибка имеет только safe code
`configuration`; URL, ref, key и headers в неё не включаются.

Service-role token не используется как источник project identity: контракт не
опирается на недокументированные JWT claims. Один уровень identity закреплён в
server code и не принимается из ENV, request, query, cookie, header или
`NEXT_PUBLIC_*`. Binding обеспечивается compiled allowlist, exact URL/ref
validation до transport creation и deployment policy, которая обновляет
URL/ref/key как одну конфигурационную единицу.

Approved deployment values без credentials:

| Deployment environment | Compiled approved ref | Required configured origin |
| --- | --- | --- |
| `VERCEL_ENV=preview` | `gjlpkqdhlzbfnzzoxlsk` | `https://gjlpkqdhlzbfnzzoxlsk.supabase.co` |
| `VERCEL_ENV=production` | `clbzibuusyuajsylcbvl` | `https://clbzibuusyuajsylcbvl.supabase.co` |
| local `NODE_ENV=development\|test` или `VERCEL_ENV=development` | `gjlpkqdhlzbfnzzoxlsk` | `https://gjlpkqdhlzbfnzzoxlsk.supabase.co` |

Эта таблица является specification, а не разрешением менять Vercel ENV или
выполнять deployment. Local loopback доступен только при одновременных
`NODE_ENV=test`, test flag, fixed ref `localdevelopment0001` и отсутствии
`VERCEL_ENV`/Vercel runtime. Flag не работает в Preview или Production.
Отсутствующий `VERCEL_ENV` принимается только в явном local process с
`NODE_ENV=development|test`; при `VERCEL=1`, unknown environment или
`NODE_ENV=production` конфигурация fail-closed.

## 4. Transport и validation

Repository выполняет один `POST` без аргументов:

    /rest/v1/rpc/cloud_published_storefront_catalog_v1
    Accept-Profile: cloud_api
    Content-Profile: cloud_api

Request имеет timeout 10 секунд, `cache: no-store` и `redirect: error` через
общий Supabase server client. Target URL повторно проверяется на same-origin.
301/302/307/308 не follow-ятся, поэтому `Authorization` и `apikey` не могут
попасть на redirect target. Table reads, Preview RPC и write operations
отсутствуют.

Response body читается streaming reader-ом с hard limit 8 MiB decoded bytes.
`Content-Length` используется для раннего fail-closed отказа, но фактический
счётчик байтов применяется всегда. JSON parse и mapping начинаются только после
успешного bounded read; partial или oversized payload не достигает mapper.

До mapping payload проходит
`parsePublishedCatalogProjection()` из `lib/published-catalog/contracts.ts`.
Strict Zod contract проверяет top-level schema, `schemaVersion`, `generatedAt`,
summary counts, public identifiers, references, Products, media, documents,
registrations, Structured Fields, enum и nullable values. Snapshot-level pass
дополнительно запрещает duplicate id/slug для Product, Manufacturer, Category
и Application Area, broken/duplicate references и несовпадающее embedded
Application Area name. Slug schema остаётся lowercase, поэтому case-collision
не проходит routing contract. Extra internal field отклоняет snapshot целиком.

Media URL проходит единый allowlist из `lib/public-media-policy.ts`; этот же
список компилируется в Next `images.remotePatterns` и CSP. На Launch разрешён
только `https://static.tildacdn.com` без credentials и custom port. Unknown
HTTPS host отклоняется до `next/image`.

## 4.1 Source-specific adapter isolation

`lib/storefront/catalog-repository-factory.server.ts` является server-only
factory. Он выполняет ровно один source-specific dynamic import после строгого
`getStorefrontDataSource()`. `app/sitemap.ts` также определяет source прежде,
чем динамически загружает Published sitemap helper только в ветке
`cloud_published`:

- `cloud_published` загружает только `CloudPublishedCatalogRepository`;
- `cloud_preview` загружает только `CloudPreviewCatalogRepository`;
- `static` загружает только `FilesystemCatalogRepository`.

Неизвестный source и ошибка dynamic import отклоняются, `catch` и fallback
отсутствуют. Общий
`CatalogRepository`, `ProductService` и Storefront Domain Model не знают о
конкретной реализации. Operational boundary требует, чтобы selected execution
trace не загружал concrete opposite adapter и не вызывал opposite RPC:
Published не загружает Preview/filesystem implementation, Preview не загружает
Published/filesystem implementation, static не загружает Cloud implementation.

Next может выпустить неисполняемые lazy chunks других source в полном artifact,
а unrelated shared layout/framework chunks могут содержать harmless Preview
literals. Их полное отсутствие не является security boundary. Документ не
утверждает complete artifact absence; проверяется конкретный загруженный trace,
RPC matrix, отсутствие fallback и отсутствие draft leakage.

## 5. Mapping

Mapper создаёт только существующие Storefront `Product`, `Manufacturer`,
`Category` и `CatalogSummary`:

- Product status всегда `active`, потому что RPC contract допускает только
  explicitly published Product;
- manufacturer/category internal reference IDs заменяются public slug IDs;
- key features и specifications сохраняют утверждённый порядок;
- media использует только approved renderable origin, documents — validated
  public HTTPS URLs;
- `preview_draft`, review metadata, approval/batch IDs и staging markers
  отсутствуют;
- featured, compatibility и related products остаются fail-closed, пока этих
  полей нет в public projection.

## 6. Empty published catalog

Snapshot с `products=[]` валиден и не запускает fallback:

- Homepage Hero остаётся доступным, а equipment showcase скрывается;
- Catalog показывает существующий empty state;
- Product lookup возвращает `null`/not found;
- category/manufacturer overview не падает;
- sitemap не создаёт Product URLs;
- static и Preview Products не появляются.

## 7. Cache contract

v1 использует conservative cache policy:

- между HTTP requests — `no-store`;
- внутри одного React server request — request-scoped `React.cache` для одного
  transport/validation/mapping pass;
- Preview и Published loaders являются разными functions и не разделяют cache;
- cross-request TTL отсутствует, поэтому archive/removal не удерживается stale
  application cache.

Sitemap является runtime-dynamic и сначала получает один
`loadCloudPublishedCatalog()` snapshot, затем строит Product, Manufacturer и
static routes из него. Он не выполняет три service/RPC reads. Отдельные HTTP
requests по-прежнему независимы и могут читать новый snapshot; persistent cache
или ISR не добавлены.

Это осознанный performance trade-off до появления измеренного Production
traffic. Pagination и новый invalidation layer в v1 не вводятся.

## 8. Error contract

Fail-closed error boundary различает только server-side codes:
`configuration`, `transport`, `invalid_payload`, `payload_too_large`. Public message одинаков:
`Published catalog is unavailable.`

Production repository обязательно передаёт официальный Next.js
`unstable_rethrow` в response boundary до любой классификации ошибки. Поэтому
Next control-flow exceptions сохраняются без string matching, а реальные
transport/payload failures остаются санитизированными.

В ошибку не включаются URL, Authorization headers, credential values, raw RPC
body, SQL и internal publication metadata. Timeout, permission failure,
malformed JSON, schema mismatch и invalid nested child не возвращают частичный
Storefront catalog.

## 9. Rendering contract

- sitemap: `force-dynamic`, один runtime snapshot, zero Product URLs при empty;
- Product и Manufacturer slug routes: runtime dynamic; `generateStaticParams`
  возвращает `[]` для `cloud_published`, поэтому новые published slugs не
  требуют rebuild;
- route metadata и page body используют request-level memoized loader;
- static и cloud_preview source behavior не смешивается с Published loader;
- build с `cloud_published` выполняет zero RPC и не требует доступности RPC;
- temporary runtime RPC failure fail-closed возвращает safe error UI/response и
  не классифицируется как Next control-flow error.

## 10. Staging verification

После отдельного разрешения controlled Preview использует staging project
`gjlpkqdhlzbfnzzoxlsk`, exact staging URL/ref pair и
`CATALOG_DATA_SOURCE=cloud_published`.

Порядок проверки:

1. проверить immutable commit и Preview ENV без вывода значений;
2. подтвердить read-only RPC и ожидаемые counts `0/25/19/7`;
3. проверить Homepage, Catalog, Manufacturer routes, sitemap и not-found;
4. подтвердить отсутствие draft/static fallback и browser credentials;
5. проверить noindex, console и server logs;
6. зафиксировать deployment evidence.

Проверка не публикует Products и не выполняет Supabase writes/migrations.

## 11. Ограничения

- v1 не добавляет cross-request cache или pagination;
- public projection пока не содержит related/compatibility/featured contract;
- Launch media allowlist содержит один явно утверждённый host; расширение
  требует изменения единого policy и отдельного review;
- 8 MiB является hard launch boundary, а не pagination mechanism;
- cross-request cache отсутствует: один отдельный HTTP request может выполнить
  один полный snapshot RPC;
- deployment policy обязана атомарно задавать согласованные server-only
  URL/project-ref/service-key, а compiled environment allowlist независимо
  ограничивает project identity; cryptographic project binding внутри token не
  предполагается;
- Production ENV и Production Catalog publication настраиваются отдельным gate;
- runtime artifact не готов к merge до targeted Independent Adapter Re-Review v4 и
  отдельно разрешённого staging Preview.
