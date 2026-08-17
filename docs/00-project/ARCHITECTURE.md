# Архитектура CyberMedica

> Нормативная основа: [PROJECT_GUIDE.md](./PROJECT_GUIDE.md).

**Статус:** действующий архитектурный обзор  
**Дата:** 17 августа 2026 года

## 1. Контекст системы

CyberMedica состоит из публичного Storefront, внутренних операционных интерфейсов, Cloud Catalog и offline pipeline. Публичная витрина не знает о внутренних Research, Review и Publication models.

    Browser
      |
      v
    Next.js on Vercel
      |
      +-- Public UI --> Storefront Services --> CatalogRepository
      |                                      |-- Static adapter (local/tests)
      |                                      |-- Cloud Preview adapter (Stage)
      |                                      +-- Cloud Published + LKG (Production)
      |
      +-- Internal UI/API --> server-only adapters --> cloud_api RPC
      |
      +-- Request API --> external lead webhook

    Offline CLI --> immutable inputs --> import/migration --> Supabase

## 2. Компоненты и ответственность

| Компонент | Ответственность | Не должен делать |
| --- | --- | --- |
| Public routes | каталог, поиск, товары, manufacturers, compare, SEO | читать Research/Review/Publication или service credentials |
| Storefront Services | продуктовые use cases | знать способ физического хранения |
| CatalogRepository | read contract каталога | содержать UI logic |
| Static adapter | local/tests/deterministic QA | считаться Source of Truth или Production fallback |
| Cloud Preview adapter | read-only staging projection | работать в Production |
| Cloud Published adapter | validated published-only Production transport with LKG resilience | принимать empty/partial response как новый snapshot |
| Catalog Admin | ограниченные staging corrections | публиковать, менять immutable snapshot, выполнять bulk edit |
| Import tooling | воспроизводимый перенос данных | запускаться как side effect web build |
| Supabase | operational data, RLS, RPC, audit boundary | отдавать закрытую cloud schema публично |

## 3. Runtime boundary

Public request проходит путь:

    Route
      -> Product/Manufacturer/Category/Search Service
      -> CatalogRepository
      -> selected adapter
      -> public Storefront model
      -> presentation contract
      -> UI / Metadata / JSON-LD

Запрещены прямые imports из data/research, data/public, legacy publication loaders и Supabase service adapters в public UI.

## 4. Data boundary

Supabase является operational Source of Truth. Git остаётся каноном для:

- source code;
- SQL migrations;
- standards и JSON Schema;
- immutable import snapshots;
- machine-readable baselines;
- deterministic test fixtures.

Production resilience использует только validated last-known-good published
snapshot. Static runtime сохраняется для local/tests и не является Production
fallback; наличие любого fallback не меняет ownership данных.

## 5. Security boundary

- service role — server-only;
- anon доступ ограничен RLS и публичными projections;
- internal flags не являются authentication;
- enabled internal Preview требует Deployment Protection;
- internal API использует private/no-store;
- Preview использует noindex;
- cloud schema не входит в Exposed Schemas;
- cloud_api exposure не означает публичный execute grant.

## 6. Deployment topology

| Контур | Application | Data | Назначение |
| --- | --- | --- | --- |
| Local | Next dev/build | static; explicit staging read | разработка |
| Staging | Vercel Preview | staging Supabase | приёмка |
| Production | Vercel Production | approved production source | публичный сервис |

Build artifact не содержит raw repository, data/research, data/legacy и SQL migrations. Output File Tracing exclusions являются частью runtime security и size boundary.

## 7. Изменение архитектуры

Изменение этой модели требует:

1. ADR;
2. threat/data-flow review;
3. обновления PROJECT_GUIDE;
4. tests для boundary;
5. staging verification;
6. documented rollback.

Существующие детальные документы в docs/architecture являются domain references. При противоречии приоритет имеет PROJECT_GUIDE и принятые ADR.
