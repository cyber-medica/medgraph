# CyberMedica — EndoMarket Corrective v4

## Source of truth
EndoMarket is the source of truth for the 42 new products:
- product name;
- description;
- feature bullets;
- technical specifications;
- source media.

No generic marketing copy may replace source content.

## Final application tags
Forbidden:
- Анестезиология и реаниматология
- Эндоскопические отделения
- Диагностические центры
- Диагностические кабинеты
- Диагностические и лечебные подразделения
- Медицинские организации

Bronchoscopes:
- Пульмонология
- Бронхоскопия
- Анестезиология
- Реанимация

Gastroscopes:
- Гастроэнтерология
- Эндоскопия
- Диагностика

Colonoscopes:
- Колоноскопия
- Эндоскопия
- Диагностика

Product Detail shows ALL tags. `+N` is forbidden there.
Catalog may show 2 tags + `+N`.

## Product names
Use the canonical names from `endomarket_business_content_corrective_v4.json`.
They are source-derived; only typography/brand case/Unicode model normalization is allowed.

## Media
For every Stage product with no photo or fallback:
1. open the direct EndoMarket product page;
2. collect all clean unique product images;
3. reject EM/EndoMarket-watermarked images;
4. reject exact/near duplicates;
5. use clean hero + gallery.

EC-430T is a mandatory blocking example: source media exist and Stage must not leave it without photo.

## Product Detail block order
1. Hero / commercial terms / CTA
2. Description
3. Key features
4. Technical characteristics
5. Applications
6. Existing related/service/RFQ content
7. Manufacturer — LAST content block

## Catalog regression
EndoMarket must enrich the canonical catalog, not replace it.

Expected Stage visible catalog:
- 71 existing published products
- +42 new EndoMarket drafts
= 113 visible products

The 9 EndoMarket bindings are existing products and are not added again.
The 8 previously unpublished products remain hidden.

## Acceptance
No release candidate is acceptable until all of the following are true:
- 113 visible Stage products;
- all 42 new products have source description/features/specs where supplied by EndoMarket;
- no generic generated product copy replaces source content;
- no forbidden tags;
- all Product Detail application tags expanded;
- manufacturer block last;
- no EM/EndoMarket watermark;
- every Stage no-photo/fallback product is source-audited and source media imported where available;
- EC-430T has source media;
- old 71 published catalog products remain visible.
