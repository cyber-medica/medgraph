# CyberMedica — руководство проекта

**Статус:** нормативный документ  
**Версия:** 1.3
**Дата вступления в силу:** 17 августа 2026 года
**Владелец:** владелец продукта и технический руководитель CyberMedica  
**Область действия:** репозиторий, облачная инфраструктура, разработка, данные и релизы

## Статус и приоритет

PROJECT_GUIDE является конституцией CyberMedica и главным источником истины по устройству проекта и правилам работы.

При противоречии действует следующий приоритет:

1. применённые ограничения безопасности и целостности данных;
2. PROJECT_GUIDE и принятые ADR;
3. актуальные документы конкретного домена;
4. исполняемый код, миграции и автоматические проверки;
5. README и операционные памятки;
6. обсуждения, старые инструкции и память человека или ИИ;
7. предположения.

Код не может молча отменить правило этого документа. Расхождение фиксируется как дефект документации или реализации и устраняется отдельным проверяемым изменением.

## Навигация

1. [Назначение проекта](#1-назначение-проекта)
2. [Основные принципы](#2-основные-принципы)
3. [Архитектура](#3-архитектура)
4. [Среды](#4-среды)
5. [Источники данных](#5-источники-данных)
6. [Структура репозитория](#6-структура-репозитория)
7. [Процесс разработки](#7-процесс-разработки)
8. [Правила staging](#8-правила-работы-со-staging)
9. [Релизы](#9-правила-релизов)
10. [Definition of Done](#10-definition-of-done)
11. [Работа с данными](#11-правила-работы-с-данными)
12. [ADR](#12-архитектурные-решения-adr)
13. [Документация](#13-правила-документации)
14. [ИИ-ассистенты](#14-правила-работы-ии)
15. [Corporate Identity and Account Policy](#15-corporate-identity-and-account-policy)
16. [История проекта](#16-история-проекта)
17. [Обновление руководства](#17-порядок-обновления-документа)
18. [Canonical routing](#18-canonical-routing-invariant)

---

## 1. Назначение проекта

CyberMedica — коммерческая B2B-витрина медицинского оборудования и управляемый каталог для поиска, оценки и запроса коммерческого предложения.

Проект:

- предоставляет покупателю единый публичный каталог;
- нормализует производителей, категории, области применения и продуктовые данные;
- даёт редактору контролируемый контур подготовки карточек;
- обеспечивает воспроизводимый путь от исходного материала до публичной карточки.

Публичный продукт не является интерфейсом Research, Review, Verification или Publication Pipeline. Эти подсистемы поддерживают качество данных, но их внутренние сущности, идентификаторы, статусы и терминология не входят в публичный контракт.

### 1.1. Философия

- Пользователь видит только понятные и публично безопасные данные.
- Отсутствующие сведения не заменяются догадками.
- Недоступное действие не рекламируется и не имитируется.
- Неполная карточка остаётся честной и fail-closed.
- Происхождение данных и воспроизводимость важнее скорости массового наполнения.
- Внутренние инструменты отделены от публичной витрины технически и терминологически.

### 1.2. Состав системы

В состав входят публичный Storefront, Storefront Data Layer, Cloud Catalog, справочники, импорт, Catalog Admin, внутренние Research/Review/Publication workflows, миграции, QA и документация. Наличие подсистемы в репозитории не означает её включение в публичный runtime.

---

## 2. Основные принципы

| Принцип | Нормативное правило |
| --- | --- |
| Cloud First | Операционное состояние хранится в облачной транзакционной системе. Git хранит код, миграции, стандарты и воспроизводимые входы, но не заменяет рабочую БД. |
| Supabase — Source of Truth | Supabase является каноническим источником операционных данных каталога в соответствующей среде. |
| Storefront boundary | Public UI получает данные только через Storefront Services и CatalogRepository. |
| Fail closed | Неоднозначные или неполные данные не публикуются и не активируют коммерческие действия автоматически. |
| Immutable source | Source snapshots, source UID и checksums не исправляются задним числом. |
| Воспроизводимость | Миграция, импорт, нормализация и проверка имеют повторяемую команду, версию входов и проверяемый результат. |
| Безопасность по умолчанию | Секреты server-only; публичные роли без write-доступа; Preview не индексируется. |
| Документация — часть продукта | Архитектурное или процессное изменение без документации не завершено. |
| Качество выше скорости | Автоматизация не оправдывает ложное сопоставление или потерю происхождения. |
| Малые обратимые изменения | Один PR содержит одну проверяемую цель и понятный rollback. |
| Наблюдаемое состояние | Решения принимаются по проверенному состоянию среды, а не по предположению. |

---

## 3. Архитектура

Подробная карта: [ARCHITECTURE.md](./ARCHITECTURE.md).

### 3.1. Общая схема

    Пользователь
        |
        v
    Vercel / Next.js App Router
        |
        +--> Public Server Components
        |        |
        |        v
        |    Storefront Services
        |        |
        |        v
        |    CatalogRepository
        |        |
        |        +--> Cloud Preview adapter --> Stage Supabase cloud_api
        |        |
        |        +--> Cloud Published adapter --> Production Supabase cloud_api
        |        |                              + validated LKG resilience
        |        |
        |        +--> Static adapter (tests, local)
        |
        +--> Internal protected routes
                 |
                 +--> server-only adapters --> service-only RPC
                 +--> local-only research loaders, где разрешено

    Offline/import contour
        snapshot --> proposal --> import --> quality/review --> publish
           |                                      |
           +---------- immutable evidence --------+
                                                  |
                                                  v
                                       Supabase Cloud Catalog

### 3.2. Frontend

- Next.js App Router, React и TypeScript.
- Server Components используются по умолчанию.
- Client Components допускаются только для реальной интерактивности.
- Public routes работают с Storefront Domain Models.
- SEO, metadata, sitemap и JSON-LD строятся из публичного Storefront contract.
- Service credentials, internal IDs, checksums, artifact paths, review comments и raw snapshots запрещены в public UI.

### 3.3. Backend

Backend состоит из server-only модулей, route handlers, repository adapters и CLI. Обязательны input validation, whitelist изменяемых полей, разделение public read/internal read/service-only write, no-store для internal API и отсутствие secrets в browser artifacts.

### 3.4. Supabase

- **cloud** — закрытая операционная схема;
- **cloud_api** — контролируемые RPC;
- **public_api** — публичные проекции, созданные отдельными миграциями;
- RLS обязателен для операционных таблиц;
- service role используется только на сервере.

Схема cloud не публикуется как общий PostgREST API. Заголовки custom schema применяются в конкретном adapter, а не глобально.

### 3.5. Local

Local предназначен для разработки, tests, dry-run и предварительного visual QA. По умолчанию Storefront использует CATALOG_DATA_SOURCE=static. Подключение к staging выполняется явно. Localhost не доказывает состояние staging или Production.

---

## 4. Среды

| Среда | Назначение | Источник данных | Разрешено | Запрещено |
| --- | --- | --- | --- | --- |
| Local | разработка, tests, dry-run | static по умолчанию; staging read явно | code changes, offline tooling, local build | финальная приёмка; неявные Cloud writes; secrets в Git |
| Staging | основная приёмка продукта и данных | staging Supabase и Cloud Preview | read-only QA; разрешённые migrations/corrections; Preview deploy | production secrets; writes без плана; отключение RLS; индексация |
| Production | публичный сервис | утверждённый production data source | принятый release; controlled migration; rollback | эксперименты; staging credentials; неаудируемые правки |

### 4.1. Staging — среда приёмки

**Staging является основной средой приёмки CyberMedica.**

Локально проверенная runtime/UI/API/data задача остаётся незавершённой, пока затронутый сценарий не развернут и не проверен на staging. Для offline или документационной задачи допускается явное исключение.

### 4.2. Контекст диагностики

До диагностики фиксируются:

    environment
      + deployment URL / commit
      + active data source
      + Supabase project
      + current release and baseline

Разница между localhost и staging сама по себе не означает потерю данных.

### 4.3. Git-ветки и deployment environments

Нормативная модель веток:

    feature/*
        -> main
        -> automatic Preview deployment

    main
        -> controlled promotion
        -> production
        -> Production deployment

- `main` — каноническая интеграционная ветка разработки и источник всех новых feature-веток;
- `main` не является Vercel Production branch и каждый push в неё создаёт только Preview;
- `production` — единственная Vercel Production branch;
- обновление `production` выполняется только явным контролируемым promotion принятого immutable commit из `main`;
- push, merge или force update в `production` без пройденного Production gate запрещён;
- Production domains и Production ENV не назначаются deployment из `main` или feature-веток.

Решение зафиксировано в [ADR-004](./ADR/ADR-004-main-production-branch-separation.md).

---

## 5. Источники данных

### 5.1. Поток

    External source
          |
          v
    Immutable Research / Source Snapshot
          |
          v
    Normalization Proposal / Import Package
          |
          v
    Reference Data + Cloud Catalog in Supabase
          |
          v
    Quality / Review / explicit publication decision
          |
          v
    Published projection --> Storefront Services

### 5.2. Матрица

| Слой | Назначение | Каноничность | Изменение |
| --- | --- | --- | --- |
| Research | sources, documents, extraction, evidence | исторический материал, не карточка | отдельный процесс |
| Immutable Snapshot | полный payload с UID/checksum | канонический вход импорта | запрещено |
| Reference Data | manufacturers, aliases, categories, areas, mappings | Supabase — operation canon; Git — versioned input | service-only import |
| Cloud Catalog | нормализованные товары и связи | основной operational Source of Truth | Admin/import workflow |
| Cloud Preview | staging read model | не отдельная база | Storefront read-only |
| Static Fallback | local/tests/compatibility | **никогда не Source of Truth** | отдельная fixture task |
| Published Catalog | approved public projection | канон публичной видимости | explicit publication action |

### 5.3. Текущее runtime-состояние

- Production Storefront использует только `cloud_published` через approved
  server-only `cloud_api` boundary.
- Validated last-known-good published snapshot является resilience fallback,
  но не самостоятельным Source of Truth. Пустой, partial или невалидный live
  ответ не заменяет валидный snapshot.
- `cloud_preview` разрешён только в Vercel Preview/Stage и запрещён в
  Production.
- Static adapter сохраняется для local/tests и deterministic QA; он не является
  Production data source.
- Production и Stage используют разные Supabase projects. Environment должен
  быть подтверждён по exact project ref до любого read/write preflight.
- Изменяемые Product counts, projection version, SHA и deployment ID не
  закрепляются в конституции. Их текущий проверенный baseline находится в
  [Infrastructure, Environments and Access](../04-technical/infrastructure-and-access.md).

---

## 6. Структура репозитория

| Путь | Назначение | Ограничения |
| --- | --- | --- |
| app/ | routes, layouts, metadata, handlers | public routes не импортируют internal pipelines |
| components/ | public/internal React UI | JSON не читается напрямую; client boundary минимален |
| lib/storefront/ | models, services, repositories, presentation | единственная data boundary Storefront |
| lib/catalog-admin/ | server-only Admin adapters | service role не попадает в browser |
| lib/data/, lib/database/ | repository/DB infrastructure | не протекает в UI |
| lib/supabase/ | env validation и transport | secrets server-only |
| supabase/ | config и migrations | reviewed, без secrets |
| scripts/importers/ | offline pipeline | не входит в public runtime |
| scripts/migrations/ | data migrations | dry-run прежде apply; environment pinning |
| scripts/qa/ | health/baseline/integrity audits | read-only по умолчанию |
| data/legacy/ | immutable snapshots | checksums; не переписывать |
| data/reference/ | versioned reference inputs | не operational DB |
| data/baseline/ | контрольные состояния | отдельный baseline update |
| data/research/ | research datasets/artifacts | исключать из serverless runtime |
| data/storefront/ | static fixtures/fallback | не Cloud Source of Truth |
| data/public/ | legacy publication outputs | новый UI не читает напрямую |
| public/ | public assets | public-safe content |
| tests/ | contract, safety, migration QA | часть acceptance evidence |
| docs/00-project/ | governance и ADR | главный уровень документации |
| docs/01-product/–05-operations/ | тематические индексы | reorganization выполняется отдельно |
| docs/releases/ | release evidence | не заменяет PROJECT_GUIDE |

---

## 7. Процесс разработки

    Идея
      |
      v
    Scope и ограничения
      |
      v
    Архитектурная проверка / ADR
      |
      v
    Малое независимое изменение
      |
      v
    Local QA
      |
      v
    Preview deployment в Staging
      |
      v
    Staging QA
      |
      v
    Product acceptance
      |
      v
    Production + rollback + smoke

До разработки проверяются branch/status, release, environment, data source, protected systems, acceptance criteria и необходимость ADR.

Базовый QA:

    npm test
    npm run lint
    npx tsc --noEmit --pretty false
    npm run build
    git diff --check

По scope добавляются baseline, Supabase, import, security, visual и bundle audits. Подробно: [DEVELOPMENT.md](./DEVELOPMENT.md).

Запрещено запускать migration как side effect build/test/deploy, смешивать чужие staged changes с PR и использовать reset/restore/clean/stash без разрешения.

---

## 8. Правила работы со staging

1. Staging — главный контур функциональной и визуальной приёмки.
2. UI принимается по Preview, не по localhost screenshot.
3. Runtime PR незавершён до staging QA.
4. Preview использует только staging credentials.
5. Service role допускается только server-side.
6. Preview остаётся noindex.
7. Write требует scope, pre-state, post-state и integrity audit.
8. PATCH/import/publication/migration не выполняются во время read-only QA.
9. Drift сверяется с baseline; baseline update принимается отдельно.
10. Отчёт содержит Preview URL, deployment, commit и data source.

---

## 9. Правила релизов

Подробно: [RELEASE_PROCESS.md](./RELEASE_PROCESS.md).

| Статус | Значение | Evidence |
| --- | --- | --- |
| Запланировано | scope согласован | backlog/release plan |
| В работе | реализация выполняется | branch/plan |
| Реализовано локально | изменения внесены | diff |
| Локально проверено | Local QA зелёный | command results |
| Развернуто на staging | создан deployment | Preview URL/ID |
| Проверено | staging QA завершён | report/screenshots/API evidence |
| Принято | product owner подтвердил | явное подтверждение |
| Production | артефакт развернут и проверен | deployment + smoke report |

Build success не означает принятие, Preview не означает Production. Релиз связан с конкретным commit или immutable artifact. До Production определяются previous stable deployment, data rollback, владелец решения и post-rollback checks.

---

## 10. Definition of Done

Задача завершена, когда выполнены все применимые условия:

- scope реализован без незаявленных изменений;
- архитектурные границы соблюдены;
- code, schema, migration и docs согласованы;
- tests, lint, TypeScript, build и domain audits проходят;
- secrets и internal data не раскрыты;
- Local QA завершён;
- runtime/UI/API/data изменение проверено на staging;
- baseline и immutable inputs сохранены либо изменение принято;
- оформлены report/screenshots/machine evidence;
- product owner принял результат;
- для Production определён rollback;
- рабочее дерево и commit соответствуют scope.

Документационная задача может завершиться без staging, если Markdown и ссылки проверены, а документ не утверждает непроверенное поведение.

---

## 11. Правила работы с данными

Обязательные различия:

- Research ≠ Published Catalog.
- Static Fallback ≠ Cloud Catalog.
- Cloud Preview ≠ отдельная база.
- Review decision ≠ publication.
- Import diagnostics ≠ current catalog quality.

Перед выводом фиксируются environment, deployment/commit, data source, Supabase project, release/baseline и operation mode.

Правила write:

- SQL/RPC/write только в разрешённом scope;
- Dashboard insert не заменяет migration/import;
- RLS не отключается;
- service-role key не выводится и не сохраняется;
- apply следует после dry-run, если применимо;
- post-audit проверяет counts, duplicates, FK, orphans и domain invariants;
- повторный запуск идемпотентен либо это явно опровергнуто документацией.

---

## 12. Архитектурные решения (ADR)

ADR обязателен при изменении Source of Truth, infrastructure, security boundary, repository/service contract, data/publication/release model или долгосрочного исключения.

Формат и реестр: [ADR/README.md](./ADR/README.md).

Нумерация последовательна: ADR-001, ADR-002, ADR-003. Принятый ADR не переписывается: новое решение заменяет его новым ADR.

---

## 13. Правила документации

1. Документация проверяется в том же PR.
2. README не дублирует PROJECT_GUIDE, а ссылается на него.
3. Новый нормативный документ ссылается на PROJECT_GUIDE.
4. Архитектурное изменение без docs/ADR незавершено.
5. Документ указывает status, scope и date/version.
6. Secrets запрещены.
7. Факт проверки отделяется от рекомендации.
8. Устаревший документ получает явный статус.
9. Массовое перемещение docs выполняется отдельно с link audit.
10. Release report фиксирует evidence, но не заменяет архитектурный канон.

---

## 14. Правила работы ИИ

До анализа или изменения ИИ обязан:

1. прочитать PROJECT_GUIDE и ADR;
2. проверить branch/status и смешанные изменения;
3. определить Local/Staging/Production;
4. определить release/deployment;
5. определить data source и Supabase project;
6. различить read-only/dry-run/apply;
7. перечислить protected systems;
8. сверить утверждения с code, migrations, env contract и evidence.

ИИ запрещено делать вывод только по памяти, считать localhost отражением staging, считать static каноническим Cloud Catalog, выполнять deploy/merge/publication/migration/write без разрешения, раскрывать secrets, удалять пользовательские изменения, угадывать фактические данные или объявлять completion без QA.

Если состояние нельзя установить, ИИ сообщает ограничение и предлагает безопасную проверку.

---

## 15. Corporate Identity and Account Policy

Канонической корпоративной identity CyberMedica является
`cybermedicaooo@gmail.com`. Все новые Auth, Review, Git, deployment и
external-service операции выполняются только через неё или напрямую связанный
корпоративный account. Другая identity требует отдельного явного разрешения
Product Owner на exact операцию; существующая session или ранее выданное
исключение не являются постоянным разрешением.

Перед write, OTP/PKCE, account creation и deployment обязателен identity
preflight. Несовпадение завершается fail-closed:
`CORPORATE IDENTITY POLICY BLOCKED`. Секреты и session credentials не
сохраняются в документации или Git.

`armansmarkosyan@gmail.com` является legacy identity и запрещена для новых
операций. Исторические Review Decisions и audit records сохраняются с исходной
identity и не переписываются. Отзыв или удаление legacy account требует
отдельной controlled задачи.

Подробности: [Corporate Identity and Access Policy](./CORPORATE_IDENTITY_AND_ACCESS.md).

---

## 16. История проекта

| Период | Этап | Значение | Ссылка |
| --- | --- | --- | --- |
| 2026, Wave 2 | Research/Review foundation | внутренний контур источников | docs/architecture и docs/research |
| 2026, Storefront migration | Storefront Data Layer | public UI отделён от internal pipelines | docs/storefront-data-contract.md |
| 2026, Cloud Foundation | Supabase foundation | Cloud-first target и RLS | docs/cloud-first-data-architecture-v1.md |
| 2026, Catalog Baseline v1 | Staging baseline | 79 товаров и checksum | docs/reports/catalog-baseline-v1.md |
| 2026, Release 0.2 | Commercial UX foundation | переход к B2B-витрине | docs/releases |

История содержит только принятые этапы. Детали остаются в release reports и Git.

---

## 17. Порядок обновления документа

PROJECT_GUIDE обновляется при изменении product boundary, Source of Truth, architecture, environments, development/release process, Definition of Done, security boundary, repository structure, data workflows или правил ИИ.

Процедура:

1. Описать причину.
2. Создать ADR, если решение архитектурно значимо.
3. Обновить PROJECT_GUIDE и domain docs.
4. Проверить ссылки и противоречия.
5. Получить technical/product review.
6. Обновить version и дату.
7. Обновить checklists и gates.

Опечатка не требует ADR. Изменение обязательного правила повышает minor version; изменение назначения, Source of Truth или governance — major version.

---

## 18. Canonical routing invariant

`cyber-medica.ru/*` MUST resolve to one canonical Vercel project and one
deployment family. Any Tilda, `medvist.ru`, legacy-origin content, untracked
Production deployment, or mismatched route fingerprint is a P0 release blocker.

The canonical project is `medgraph`. Public responses MUST expose the same
sanitized `X-CyberMedica-Origin`, `X-CyberMedica-Deployment`, and
`X-CyberMedica-Release` values across `/`, `/catalog`, `/request`,
`/sitemap.xml`, and Product Detail routes.

| Operational gate | Статус | Блокирует запуск |
| --- | --- | --- |
| External canonical-routing release gate | Обязателен | Да |
| Five-minute canonical synthetic | Обязателен | Да |
| Characteristics and Product backlog | Отложено на время P0 | Нет |

Production promotion is Git-tracked and corporate-owned. Manual
`vercel --prod` promotion is prohibited because it can move the canonical alias
to an artifact without auditable commit metadata. The approved identity is
`cybermedica <cybermedicaooo@gmail.com>` and the approved Vercel team is
`medgraph`.

Published media hosted on `static.tildacdn.com` is provenance, not proof of a
Tilda page origin. Incident classification MUST use response headers, redirect
chain, deployment fingerprint, and page-shell markers rather than image host
strings alone.

## Связанные нормативные документы

- [Архитектура](./ARCHITECTURE.md)
- [Процесс разработки](./DEVELOPMENT.md)
- [Процесс релизов](./RELEASE_PROCESS.md)
- [Corporate Identity and Access Policy](./CORPORATE_IDENTITY_AND_ACCESS.md)
- [Infrastructure, Environments and Access](../04-technical/infrastructure-and-access.md)
- [Реестр ADR](./ADR/README.md)
- [Product index](../01-product/README.md)
- [Backend index](../02-backend/README.md)
- [Frontend index](../03-frontend/README.md)
- [Data index](../04-data/README.md)
- [Operations index](../05-operations/README.md)
- [Canonical domain routing](../architecture/canonical-domain-routing.md)
- [Canonical routing P0 runbook](../runbooks/canonical-routing-incident.md)
