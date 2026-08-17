# CyberMedica — infrastructure, environments and access

**Статус:** канонический operational reference

**Дата проверки:** 17 августа 2026 года

**Владелец:** Product Owner и назначенный corporate technical operator

**Область действия:** GitHub, Vercel, Supabase, RFQ, email, analytics,
indexing, DNS, CI/CD и recovery

Этот документ является единственным каноническим местом для текущей карты
инфраструктуры, environment bindings и безопасных account identities. Он не
заменяет [PROJECT_GUIDE](../00-project/PROJECT_GUIDE.md),
[Corporate Identity and Access Policy](../00-project/CORPORATE_IDENTITY_AND_ACCESS.md),
[Architecture](../00-project/ARCHITECTURE.md) или
[Release Process](../00-project/RELEASE_PROCESS.md). Эти документы определяют
правила; здесь фиксируются проверяемые operational bindings.

Значения SHA, deployment ID и provider status изменяемы. Перед write или
release-операцией их необходимо проверить заново; этот файл нельзя использовать
как замену live preflight.

## 1. Проверенный baseline

| Поле | Текущее значение | Источник проверки |
| --- | --- | --- |
| GitHub repository | `cyber-medica/medgraph` | Git remote и Vercel Git metadata |
| `main` SHA | `192ab3ea9af0f5f489e6ff358892128094bce1ff` | свежий `origin/main` |
| `production` SHA | `192ab3ea9af0f5f489e6ff358892128094bce1ff` | свежий `origin/production` |
| Production deployment | `dpl_BAewcSSsjNxATZwj2TwAp2it1WAP` (`READY`) | Vercel alias inspection и public response header |
| Production release SHA | `192ab3ea9af0f5f489e6ff358892128094bce1ff` | `X-CyberMedica-Release` и Vercel Git metadata |
| Vercel team / project | `medgraph` / `medgraph` | Vercel CLI и linked project metadata |
| Production Supabase | `cybermedica` / `clbzibuusyuajsylcbvl` | Supabase project inventory и runtime binding |
| Stage Supabase | `cybermedica-staging` / `gjlpkqdhlzbfnzzoxlsk` | Supabase project inventory и application environment map |
| Catalog health | `healthy`; live transport `healthy`; fallback inactive | sanitized Production health endpoint |
| Published snapshot | projection version `75`; `114` Products | sanitized Production health endpoint |

Public Production responses identify one origin (`medgraph`), the deployment
above and the exact release SHA. `main` and `production` were aligned at audit
time. A future change to either ref makes this table historical until refreshed.

## 2. Corporate technical identity

- Canonical corporate email for new Git, GitHub, Vercel, Supabase, Resend,
  Google and other technical operations: `cybermedicaooo@gmail.com`.
- Git author and committer: `cybermedica <cybermedicaooo@gmail.com>`.
- GitHub repository owner/login used by Git integration: `cyber-medica`.
- Vercel actor: `cybermedica`; approved team: `medgraph`.
- Corporate operational inbox: `info@cyber-medica.ru`.
- Personal or legacy identities are prohibited for new operations unless the
  Product Owner gives a new explicit authorization. Historical audit records
  are not rewritten.
- MFA, recovery codes, passwords, sessions and OAuth tokens are held only in
  provider-controlled secret stores. They are never copied into Git.

Identity and RBAC details remain normative in
[Corporate Identity and Access Policy](../00-project/CORPORATE_IDENTITY_AND_ACCESS.md).

## 3. Public domains

| Purpose | Canonical value | Rule |
| --- | --- | --- |
| Public website | `https://cyber-medica.ru` | canonical apex for all public routes |
| `www` | `https://www.cyber-medica.ru` | permanent redirect to the apex |
| Sitemap | `https://cyber-medica.ru/sitemap.xml` | only canonical, indexable public URLs |
| Vercel project aliases | Vercel-generated `medgraph` aliases | evidence/diagnostics only; never public canonical URLs |

The whole `cyber-medica.ru/*` namespace must resolve to one Vercel project and
deployment family. Tilda, `medvist.ru`, a legacy origin or mismatched route
fingerprints are P0 blockers. Media provenance on an external image host does
not by itself prove a routing split.

## 4. Production environment

- Application: Next.js on Vercel, target `production`.
- Vercel Production branch: `production`.
- Data source: `cloud_published` through the server-only Supabase adapter.
- Public catalog reads use a validated last-known-good snapshot only as the
  resilience fallback. Invalid, empty or partial live data cannot replace it.
- Production indexing is enabled only by the exact Production environment,
  catalog source and Supabase project-ref binding.
- Canonical promotion is Git-tracked. Manual `vercel --prod`, arbitrary alias
  reassignment or direct feature-to-Production promotion is not canonical.
- Production secrets live in Vercel Production environment storage. Their
  names may be audited; values must never be pulled into reports or logs.

Current public runtime evidence:

- canonical generated deployment URL:
  `https://medgraph-8gw4kfzqp-medgraph.vercel.app`;
- apex and `www` aliases are assigned to the current READY deployment;
- `www` returns a one-hop permanent redirect to the apex;
- the sanitized catalog health response reports live transport healthy and
  fallback inactive.

## 5. Stage and Preview environment

There is no separate custom public Stage domain. Stage application testing is
performed on immutable Vercel Preview deployments and branch aliases.

- Current `main` branch Preview alias:
  `https://medgraph-git-main-medgraph.vercel.app`.
- Current generated `main` Preview at audit time:
  `https://medgraph-4ppffsjay-medgraph.vercel.app`.
- A real isolated Supabase Stage project exists:
  `cybermedica-staging` (`gjlpkqdhlzbfnzzoxlsk`). It is not a Supabase branch
  of Production and must not be confused with `clbzibuusyuajsylcbvl`.
- The application maps Vercel Preview to the Stage ref. Selected Vercel Preview
  branches also have branch-scoped server bindings; therefore every Preview QA
  must verify its actual data source and environment names before use.
- Preview remains `noindex`, must not receive Production aliases and must not
  use Production credentials.
- Feature Preview URLs are ephemeral evidence. A Preview is not a Production
  release and cannot be used as the canonical public URL.

Detailed deployment steps are in [Vercel Preview Deployment Workflow](../deployment-preview.md).

## 6. GitHub repository and branches

- Repository: `https://github.com/cyber-medica/medgraph`.
- Default/canonical integration branch: `main`.
- Canonical Production branch: `production`.
- Feature branches use the `codex/*` convention unless an approved task says
  otherwise.
- Required promotion path: feature → `main` → controlled fast-forward to
  `production` after all gates and explicit authorization.
- Merge commits, force pushes, hidden rebases and untracked Production artifacts
  are prohibited by the release contract.
- Git author/committer must pass the corporate identity preflight before commit
  or push.

## 7. CI and GitHub Actions

Current workflow names are exact:

| Workflow | Trigger | Operational role |
| --- | --- | --- |
| `Catalog reliability gate` | pull request; pushes to `main` and `production` | catalog fault injection, build and WebKit smoke; Production push also waits for the exact canonical route release |
| `Catalog production synthetic` | every five minutes; manual dispatch | external canonical routing, Product-count and mobile/WebKit Production synthetic |

Both workflows are fail-closed. WebKit is installed with the lockfile-local
`playwright-core` CLI; tests must not be skipped or hidden behind
`continue-on-error`. A failed canonical synthetic blocks subsequent Production
writes until the incident is resolved.

## 8. Vercel

| Field | Value |
| --- | --- |
| Team | `medgraph` |
| Project | `medgraph` |
| Project ID | `prj_emEZsTDpPLEaXuC8cM9URmmG0zX8` |
| Production branch | `production` |
| Production domains | `cyber-medica.ru`, `www.cyber-medica.ru` |
| Runtime | Node.js 24.x / Next.js |

Vercel environment values are scoped by Production, Preview and, where needed,
an exact Preview branch. Only variable names and scope may be documented.
Environment values, deployment tokens and downloaded `.env` files are secret
material.

For incident diagnosis, compare the public headers
`X-CyberMedica-Origin`, `X-CyberMedica-Deployment` and
`X-CyberMedica-Release` with Vercel inspection and Git. A matching page body
without matching provenance headers is not sufficient release evidence.

## 9. Supabase and database

| Environment | Project | Ref | Region |
| --- | --- | --- | --- |
| Production | `cybermedica` | `clbzibuusyuajsylcbvl` | West EU (Paris) |
| Stage | `cybermedica-staging` | `gjlpkqdhlzbfnzzoxlsk` | North EU (Stockholm) |

Production Data API state verified in the Supabase dashboard:

- exposed schemas: `cloud_api`, `graphql_public`, `public`, `public_api`;
- exposed schemas count: 4 of 14;
- exposed tables count: 0 of 71;
- exposed functions count: 4 of 135;
- closed operational schema `cloud` is not exposed;
- exposing `cloud_api` does not grant `anon` or `authenticated` execute rights;
  routine grants remain a separate least-privilege boundary.

The public runtime calls the exact published projection RPC through a
server-only service boundary. Service-role credentials never enter browser
code. Product, lifecycle and migration writes require a separate explicit
task, fresh backup/restore evidence when applicable, exact scope and post-write
verification.

## 10. RFQ flow

Current request path:

```text
public Product or /request
  -> POST /api/request
  -> input/rate-limit/Product-context/attribution validation
  -> server-only CYBERMEDICA_LEADS_WEBHOOK_URL
  -> Make custom webhook
  -> Make scenario "Integration Webhooks, Email"
  -> Resend transactional email
  -> info@cyber-medica.ru
```

The API returns success and a generated request ID only after the configured
webhook returns success. It fails closed when the webhook is absent, times out
or rejects the request. Email notification is downstream operational alerting;
its failure must be visible in Make/Resend monitoring and must not be mistaken
for a Product or Supabase failure.

Attribution fields are transported with the accepted RFQ, while analytics
payloads exclude contact PII. Never include lead bodies, phone numbers, names,
email addresses or webhook URLs in logs or documentation.

## 11. Make

- Make is the RFQ orchestration layer, not the storefront database.
- Active scenario: `Integration Webhooks, Email`.
- Verified audit state: scenario switch `Active`; the organization dashboard
  reports one active scenario.
- Responsibilities: accept the server webhook payload, preserve request and
  Product context, format a corporate notification and call Resend.
- Make connections and webhook endpoints are secrets. Document scenario names
  and operational state only.
- After any Make change, verify one controlled non-customer test end to end and
  remove or clearly label its evidence. Do not use a real lead for QA.

## 12. Resend and transactional email

- Transactional provider: Resend.
- Account identity: `cybermedicaooo@gmail.com`.
- Verified sending domain: `notify.cyber-medica.ru`.
- Approved sender identity:
  `CyberMedica <leads@notify.cyber-medica.ru>`.
- Notification recipient: corporate inbox `info@cyber-medica.ru`.
- Recent RFQ notifications were observed with `delivered` provider status at
  audit time.

Resend API keys are stored in the Make connection/provider secret store and
must not be copied to Vercel, Git or documentation unless the approved flow is
changed by a separate security-reviewed task. Yandex SMTP is not the primary
transactional sender for the current RFQ path.

## 13. Corporate inbox

- Operational inbox: `info@cyber-medica.ru`.
- Mail routing provider: Yandex Mail, confirmed by the domain MX record.
- The inbox receives RFQ notifications and is the current corporate identity
  visible in Yandex Webmaster/Metrica operations.
- Access must use corporate MFA/recovery ownership. App passwords and SMTP
  credentials are secrets and are never recorded here.
- Mailbox delivery is verified separately from application webhook acceptance.

## 14. Yandex Metrica

- Production counter: `98376495`.
- Counter access currently appears under the corporate inbox identity.
- Approved RFQ custom goals:

| Goal | Event identifier | Metrica goal ID |
| --- | --- | --- |
| RFQ CTA click | `rfq_cta_click` | `597461037` |
| RFQ form start | `rfq_form_start` | `597460970` |
| RFQ success | `rfq_success` | `597460964` |

`rfq_success` fires only after backend acceptance and a valid request ID, once
per successful form submission. The runtime accepts only counter `98376495`;
another or missing value disables delivery rather than sending data to an
unapproved counter. R9 preserves legitimate UTM/`yclid` attribution and must
not send contact PII.

## 15. Yandex Webmaster

- Canonical site: HTTPS property `https://cyber-medica.ru` (port 443 in the
  provider's internal property path).
- Canonical sitemap: `https://cyber-medica.ru/sitemap.xml`.
- The HTTPS property is connected to Metrica counter `98376495`.
- A legacy HTTP property may remain visible as historical provider state; it is
  not the canonical submission or indexing target.
- Do not request indexing for Preview, Vercel aliases, technical query variants
  or broken/redirect-source URLs.

## 16. Google Search Console

- Canonical URL-prefix property: `https://cyber-medica.ru/`.
- Corporate Google identity: `cybermedicaooo@gmail.com`.
- Canonical sitemap: `https://cyber-medica.ru/sitemap.xml`.
- Product and Breadcrumb enhancement reports belong to this property.
- Verification tokens, OAuth sessions and ownership recovery artifacts must
  remain provider-managed and must not be committed.

## 17. DNS

Authoritative records verified read-only on 17 August 2026:

| Record | Value |
| --- | --- |
| NS | `ns1.reg.ru`, `ns2.reg.ru` |
| Apex A | `216.198.79.1` |
| Apex AAAA | none |
| `www` CNAME | `1ac5094ae1c52b74.vercel-dns-017.com` |
| MX | priority 10, `mx.yandex.net` |

REG.RU is the authoritative DNS/registrar boundary. Vercel owns the web
routing aliases; Yandex owns mail delivery through MX; Resend uses the verified
notification subdomain for outbound transactional mail. Never change MX,
mail TXT records or unrelated DNS while correcting web routing. Every DNS
change requires a before/after record capture, rollback values and explicit
authorization.

## 18. Mobile and CDN operational note

- A desktop HTTP 200 is not sufficient release evidence.
- Canonical Production promotion requires clean iPhone/WebKit navigation,
  direct `/catalog` and Product links, reload and back/forward checks.
- Current responses expose canonical deployment fingerprints. Their mismatch
  across routes is a P0 incident.
- The stale CSS bridge may serve only explicitly approved historical CSS asset
  names as `text/css`; an unknown asset must remain 404 and must never return
  application HTML.
- Published catalog transport degradation must render the validated LKG
  snapshot or a visible error state, never a blank screen.
- Cache purge, service-worker removal, DNS or alias changes require evidence of
  the corresponding failure; they are not generic first steps.

Runbook: [Canonical Routing Incident](../runbooks/canonical-routing-incident.md).

## 19. Secrets policy

Never add or print:

- passwords, access/recovery codes or app passwords;
- GitHub, Vercel, Supabase, Make or Resend tokens;
- Supabase anon/service-role keys or database passwords;
- webhook URLs/tokens, Authorization headers, cookies or session material;
- OAuth client secrets, SMTP credentials or private connection strings;
- raw RFQ payloads or customer PII.

Approved storage boundaries:

| Secret class | Storage boundary |
| --- | --- |
| Application/runtime | Vercel environment with exact environment/branch scope |
| Supabase project access | Supabase provider and Vercel server-only environment |
| CI-only credentials | GitHub Actions secret/environment store |
| RFQ orchestration | Make webhook/connection secret store |
| Transactional email | Resend/Make provider connection |
| Registrar, webmaster, analytics | provider account with corporate MFA |
| Local development | untracked `.env.local` or approved OS credential store |

Only service names, safe account identities, project refs, domains, variable
names and operational outcomes belong in Git. A secret found in output or Git
requires immediate stop, redaction, rotation and incident evidence.

## 20. Access recovery checklist

1. Stop writes and promotions; record the affected service and last known good
   deployment without copying credential material.
2. Confirm the operator is using the corporate identity and approved team/org.
3. Restore account access through the provider's official recovery/MFA path;
   never exchange login links or codes in Git, issue comments or reports.
4. GitHub: confirm `cyber-medica/medgraph`, default `main`, protected release
   path and current `main`/`production` refs.
5. Vercel: confirm team/project, Production branch, domain ownership, alias,
   deployment ID and Git SHA before any redeploy.
6. Supabase: confirm project name/ref, environment, Data API schemas and exact
   routine grants. Do not broaden `anon`/`authenticated` access as recovery.
7. RFQ: confirm Vercel webhook variable presence, Make scenario Active, Make
   execution outcome, Resend verified domain/sender and corporate mailbox
   receipt in that order.
8. Indexing/analytics: confirm the canonical HTTPS properties, sitemap,
   counter `98376495` and three RFQ goals.
9. DNS: capture NS/A/AAAA/CNAME/MX before any change. Never reset unrelated
   records or email routing.
10. Rotate only credentials proven exposed or inaccessible; update each
    consumer atomically, test the narrow path, then revoke the old credential.
11. Re-run canonical routing, WebKit, RFQ, indexing and synthetic checks before
    resuming Product or Production writes.

## 21. Operational ownership rules

Ownership is role-based; provider access must not depend on a personal account.

| Role | Responsibility | Cannot do without separate authorization |
| --- | --- | --- |
| Product Owner | approves scope, public behavior and Production writes | delegate corporate identity policy implicitly |
| Release operator | Git/Vercel reconciliation, gates, deploy evidence, rollback | Product/lifecycle/database writes |
| Data operator | Supabase backup, exact migrations/RPCs and invariance checks | runtime release or broad grants |
| RFQ operator | Make/Resend/inbox health and controlled test evidence | expose lead PII or change Product logic |
| SEO/analytics operator | GSC, Webmaster, Metrica, sitemap and goals | change DNS or runtime outside approved corrective |
| DNS owner | REG.RU/Vercel/mail record control and rollback | change MX or unrelated records during web incidents |

The same person may hold several roles, but must still respect each boundary.
Every external write records actor, scope, before/after state and rollback.
Unverified provider state is reported as requiring manual confirmation, never
filled with an assumption.

## 22. Preflight commands and evidence boundary

Safe baseline checks include:

```text
git fetch --prune origin
git rev-parse origin/main
git rev-parse origin/production
vercel inspect cyber-medica.ru --scope medgraph
curl -I https://cyber-medica.ru/
curl https://cyber-medica.ru/internal/health/catalog
dig +short NS cyber-medica.ru
dig +short MX cyber-medica.ru
```

Commands must be run without printing auth headers or environment values.
Provider dashboards are used only for safe account/project/status metadata.
Screens containing API keys, raw leads or customer data are not evidence
artifacts.

## 23. Documentation ownership and superseded material

The following documents overlap but retain narrower or historical purposes:

| Document | Classification |
| --- | --- |
| [PROJECT_GUIDE](../00-project/PROJECT_GUIDE.md) | constitutional rules; no mutable deployment baseline |
| [Corporate Identity and Access Policy](../00-project/CORPORATE_IDENTITY_AND_ACCESS.md) | normative identity/RBAC policy |
| [Architecture](../00-project/ARCHITECTURE.md) | system/data/security boundaries |
| [Release Process](../00-project/RELEASE_PROCESS.md) | promotion gates and rollback |
| [Vercel Preview Deployment Workflow](../deployment-preview.md) | specialized Preview procedure |
| [MVP Preview Deploy Checklist](../production/Preview_Deploy_Checklist.md) | historical/superseded FS510-era checklist |
| [Post-launch operational baseline — 2026-07-30](../reports/post-launch-operational-baseline-2026-07-30.md) | historical release evidence; not current state |
| [Final Production Release v2 — 2026-08-12](../reports/final-production-release-v2-2026-08-12.md) | historical release evidence; not current state |

Date-stamped release reports may contain correct historical SHA, deployment and
catalog counts. They must remain explicitly historical and must not override
this operational reference or a fresh live preflight.
