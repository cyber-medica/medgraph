# CyberMedica Preview Deploy Checklist

> **Исторический документ.** Этот FS510-era MVP checklist superseded by
> [Infrastructure, Environments and Access](../04-technical/infrastructure-and-access.md)
> and [Vercel Preview Deployment Workflow](../deployment-preview.md). Do not use
> its routes, data-source assumptions or environment list as the current Stage
> contract.

Status: historical MVP preview checklist

Purpose: prepare a Vercel Preview URL for external demonstration without changing the CyberMedica architecture or publishing unverified data.

## 1. Required environment variables

Configure these variables in Vercel before sharing the preview URL.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
CYBERMEDICA_LEADS_WEBHOOK_URL=
CYBERMEDICA_LEADS_WEBHOOK_TOKEN=
CYBERMEDICA_ENABLE_ADMIN=
CYBERMEDICA_ENABLE_INTERNAL_REVIEW=
CYBERMEDICA_ENABLE_IMPORT_CENTER=
CYBERMEDICA_ENABLE_WAVE2_DASHBOARD=
```

Rules:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used only for read access to `public_api`.
- Never use a Supabase `service_role` key in the Portal.
- Leave `CYBERMEDICA_ENABLE_ADMIN` empty for external preview. `/admin` must remain hidden in production unless explicitly enabled for a controlled internal environment.
- Leave `CYBERMEDICA_ENABLE_INTERNAL_REVIEW`, `CYBERMEDICA_ENABLE_IMPORT_CENTER`, and `CYBERMEDICA_ENABLE_WAVE2_DASHBOARD` empty for external preview. Their `/internal/*` routes must remain hidden unless explicitly enabled for a controlled internal environment.
- Store real values only in Vercel environment settings or local `.env.local`. Do not commit secrets.

## 2. Build checks

Run before deployment:

```bash
npm test
npm run build -- --webpack
npm run lint
npx tsc --noEmit --pretty false
git diff --check
```

Expected result: all commands pass.

## 3. Routes to test

Open these routes on the preview URL:

```text
/
/catalog
/catalog/hamilton-c1
/products/fs510
/manufacturers
/request
/robots.txt
```

Expected behavior:

- Home, catalog, manufacturer and request pages render without client-side errors.
- Draft catalog pages do not show `CyberMedica Verified`.
- `/products/fs510` reads only published projection data from Supabase.
- If Supabase env is missing or unavailable, `/products/fs510` shows a neutral temporary-unavailable state, not infrastructure details.
- `/admin` returns not found in production unless `CYBERMEDICA_ENABLE_ADMIN=1`.
- `/internal/review-queue` and `/internal/reviewer` return not found unless `CYBERMEDICA_ENABLE_INTERNAL_REVIEW=1`.
- `/internal/import-center` returns not found unless `CYBERMEDICA_ENABLE_IMPORT_CENTER=1`.
- `/internal/wave2` returns not found unless `CYBERMEDICA_ENABLE_WAVE2_DASHBOARD=1`.

## 4. Request form behavior

Verify:

- Required fields are enforced.
- Phone or email is required.
- Invalid email is rejected.
- Large payloads are rejected.
- Repeated rapid requests are rate-limited with a user-facing message.
- If `CYBERMEDICA_LEADS_WEBHOOK_URL` is not configured, the form returns a controlled unavailable state.
- If webhook delivery fails, the user sees a neutral temporary-unavailable message.

## 5. Supabase projection check

Verify:

- The FS510 page uses `public_api.product_pages`.
- The Portal does not query `source`, `knowledge`, `publication`, `factory_api`, `core`, `private` or `governance` schemas directly.
- The anon key has only the intended public read access.

## 6. Robots and indexing policy

Preview indexing policy:

```text
Disallow: /
```

This is intentional for external preview. Do not enable indexing until public beta content, metadata, sitemap and canonical policy are approved.

## 7. Known preview limitations

- Draft catalog data is generated data, not verified publication data.
- Knowledge Engine and importers are not part of the public runtime.
- Public request intake depends on the configured webhook.
- No production analytics, monitoring or alerting is required for preview, but must be added before public beta.
- SEO is intentionally restricted during preview.

## 8. Go / no-go

Preview can be shared externally only if:

- Build checks pass.
- `/admin` is hidden.
- `/products/fs510` does not expose technical env errors.
- Request form behavior is controlled.
- Robots blocks indexing.
- No secrets are committed.
