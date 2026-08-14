# RFC-024 — Storefront Structured Data

**Status:** Implemented  
**RFC:** RFC-024  
**Scope:** Public Storefront

## Executive Summary

The Storefront publishes conservative schema.org JSON-LD built exclusively from
Storefront domain models. Structured data has no dependency on Review,
Publication, Research, generated public/research datasets, Supabase Projection,
or the FS510 vertical.

The implementation adds non-visual structured data to the homepage, catalog,
product, manufacturer directory, and manufacturer detail routes. Search and
comparison remain intentionally unstructured because their output is mutable or
interactive rather than a stable standalone entity.

## Architecture

```text
Public route
    ↓
Storefront service
    ↓
Storefront domain model
    ↓
lib/storefront/structured-data.ts
    ↓
components/seo/JsonLd.tsx
```

The schema builders are pure. They do not read files, call APIs, or trigger
additional Storefront queries. Routes pass the same page data already loaded for
rendering.

## JsonLd Component

`components/seo/JsonLd.tsx` is a Server Component with no `use client`
directive and no `next/script` dependency. It accepts one schema object or an
array of schema objects and renders a native:

```html
<script type="application/ld+json">…</script>
```

It has no wrapper element, route-specific behavior, visual output, or client
JavaScript.

## Schema Matrix

| Route | Schema | Input |
| --- | --- | --- |
| `/` | `WebSite`, `Organization` | Storefront site constants and homepage public description |
| `/catalog` | `CollectionPage` | Catalog page content |
| `/catalog/[slug]` | `ItemPage` → `MedicalDevice`, `BreadcrumbList` | `Product`, `Category` |
| `/manufacturers` | `CollectionPage` | Manufacturer directory content |
| `/manufacturers/[slug]` | `Organization`, `BreadcrumbList` | `Manufacturer` |
| `/search` | None | Deliberately omitted |
| `/compare` | None | Deliberately omitted |

The catalog directories do not emit a large `ItemList`.

## Homepage

The homepage emits `WebSite` and `Organization`. The published fields are
limited to name, canonical URL, description, and a minimal Organization
publisher reference. No stable CyberMedica logo URL exists in the Storefront,
so a logo is not invented. Address, telephone, email, `sameAs`, founding date,
and contact points are omitted.

## Product Detail

Product Detail does not declare schema.org `Product`, because the RFQ storefront
does not publish truthful Product-specific prices, offers, reviews, or ratings.
The page instead emits an `ItemPage` whose `mainEntity` is a `MedicalDevice`.
All 114 published catalog entries are medical equipment used for diagnosis,
treatment, monitoring, or clinical support, so this subtype is truthful.

The `MedicalDevice` entity is intentionally limited to inherited `Thing`
properties whose values are already public and unambiguous: `name`, plain-text
`description`, canonical `url`, and resolvable `image`. Product-oriented
properties `manufacturer`, `brand`, `model`, `sku`, `mpn`, and `category` are
not copied to `MedicalDevice`, because their schema.org domains do not include
that type. Category remains page navigation context and an `ItemPage` keyword.

The following fields and concepts are explicitly prohibited and absent:

- schema.org `Product`, offers, price, discount, availability;
- manufacturer, brand, model, SKU, MPN, or category on `MedicalDevice`;
- aggregate ratings and reviews;
- GTIN or invented identifiers;
- registration, verification, or provenance metadata;
- Review/Evidence/DocumentVersion IDs;
- artifact paths, checksums, comments, and internal notes.

## Manufacturer

The Storefront Manufacturer model represents a company rather than only a
marketing label, so its detail page uses `Organization`. It publishes the
Storefront name, description, route canonical, and logo only when `logoUrl` is
present. No missing organization metadata is inferred.

## Breadcrumbs

Breadcrumbs are non-visual and use the canonical Storefront route strategy:

```text
Product:      Главная → Каталог → Товар
Manufacturer: Главная → Производители → Производитель
```

Every `ListItem.item` is an absolute URL rooted at
`https://cybermedica.ru`. Product pages remain under `/catalog/{slug}`. The
FS510 vertical is outside this RFC.

## Canonical and Query Policy

JSON-LD URLs use the same site URL and route paths as Metadata API. Catalog and
search query results retain their base canonicals. When `q` is non-empty, their
generated metadata uses `noindex, follow` in an indexing-enabled environment;
Preview and other indexing-disabled environments retain the stricter global
`noindex, nofollow` gate.

Search and compare pages emit no JSON-LD.

## Security

`serializeStorefrontJsonLd()` serializes with `JSON.stringify()` and then
escapes characters that can terminate or alter an inline script context:

- `&` as `\u0026`;
- `<` as `\u003c`;
- `>` as `\u003e`;
- U+2028 as `\u2028`;
- U+2029 as `\u2029`.

Escaping `<` also neutralizes `</script>`. The result remains valid JSON and
round-trips to the original data.

## Validation

Automated tests verify schema types, absolute canonical URLs, ordered
BreadcrumbList entries, valid safe serialization, CollectionPage behavior,
Storefront-only route wiring, query noindex policy, and absence of commercial
or internal fields. The production build is additionally inspected for the
expected `application/ld+json` output on all five structured routes.

## Performance

Structured data performs no extra query or filesystem access. The component is
server-only and adds no client JavaScript or hydration boundary. Each schema is
built from the data already loaded by its route.

## Out of Scope

- visual breadcrumbs;
- Product Offers, prices, availability, discounts;
- ratings and reviews;
- FS510 and Supabase Projection;
- route, redirect, canonical, or Storefront API changes;
- Review, Publication, Research, or Wave 2 changes.
