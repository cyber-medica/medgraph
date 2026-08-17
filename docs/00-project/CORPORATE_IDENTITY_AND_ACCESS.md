# CyberMedica — Corporate Identity and Access Policy

> Нормативная основа: [PROJECT_GUIDE.md](./PROJECT_GUIDE.md), раздел 15.
> Текущая карта сервисов, environments и safe account identities:
> [Infrastructure, Environments and Access](../04-technical/infrastructure-and-access.md).

**Статус:** действующая security/access policy
**Версия:** 1.0
**Дата:** 1 августа 2026 года
**Каноническая identity:** `cybermedicaooo@gmail.com`

## Область действия

Политика применяется к Git/GitHub, Vercel, Supabase organization и Auth,
Production/Preview login, PKCE/OTP/magic-link, SMTP, indexing, registrar/DNS,
monitoring, CRM/RFQ, CI/CD и новым внешним сервисам проекта.

## Обязательный preflight

Перед операцией с аккаунтом или внешним сервисом оператор проверяет без
раскрытия credentials:

1. Git author и committer email;
2. активный GitHub account и organization;
3. Vercel user, team и deployment author;
4. Supabase organization identity и Auth reviewer email;
5. получателя OTP, PKCE или magic-link;
6. владельца нового внешнего сервиса.

Ожидается `cybermedicaooo@gmail.com` или напрямую связанный корпоративный
account. При несовпадении write, письмо, account creation и deployment
запрещены. Результат: `CORPORATE IDENTITY POLICY BLOCKED`.

## Runtime Auth/RBAC contract

- Новые login/OTP принимают только корпоративный email.
- Auth identity должна точно совпадать с корпоративным UUID и подтверждённым
  email.
- Доступ дополнительно определяется live Production profile через
  аргумент-free `cloud_api.current_internal_access_v1()` и `auth.uid()`.
- Разрешены только роли `admin` и `reviewer`; отсутствующий или неподходящий
  profile закрывает доступ.
- Browser и штатный SSR check не используют service-role и не читают
  `cloud.user_profiles` напрямую.
- Controlled lifecycle runners may use the Production service role only in the
  server runtime after an exact corporate UUID/email/role session check. Their
  browser contract is limited to a tracked operation key and immutable digest;
  Product scope is never accepted from the browser.

## Legacy identity

`armansmarkosyan@gmail.com` — legacy identity. Она запрещена для новых
OTP/PKCE, login, Review, allowlist, commit или deployment без нового явного
разрешения Product Owner.

Исторические Review Decisions, audit records и release evidence сохраняют
исходную identity и не перепривязываются. Account не удаляется автоматически:
отзыв или удаление доступа требуют отдельной controlled задачи.

## Secrets и evidence

В документации разрешены только email identity, safe account/team labels,
operation scope и результат preflight. Запрещены passwords, tokens, magic
links, PKCE verifiers, cookies, session credentials и connection strings.
