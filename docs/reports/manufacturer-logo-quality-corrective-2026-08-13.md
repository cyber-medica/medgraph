# Manufacturer logo quality corrective

Дата: 2026-08-13  
Режим: Stage-only  
Base: `108032ce878f7b7983b8183146bb90e29de94672`

## Решения

| Производитель | Решение | Источник и основание |
|---|---|---|
| Hamilton Medical | Graphic | Exact SVG, который текущий официальный сайт Hamilton Medical использует как desktop header wordmark через свой Frontify asset boundary. Файл сохранён локально без изменения графики; внешний runtime URL отсутствует. |
| Mindray | Graphic | Чистый локальный вектор проверен против текущего официального красного wordmark `404×104` и официальной страницы Mindray о запуске логотипа. Он сохраняет исходные пропорции и не требует raster enlargement или hotlink. |
| iLivTouch | Fallback | Официальный SVG преимущественно белый и теряет читаемость на светлой карточке CyberMedica. Asset удалён, выбран polished fallback. |
| Longfian | Fallback | Доступный официальный CDN raster имеет только `215×30`, слабый контраст и недостаточную визуальную плотность. Asset удалён, выбран polished fallback. |
| Medinova | Fallback | Официальный SVG — white-on-transparent treatment, практически невидимый на светлом UI. Asset удалён, выбран polished fallback. |

Ключевой критерий corrective: качественный fallback предпочтительнее слабого graphic asset.

## Инварианты

- Все runtime logo assets локальные; external runtime logo URLs: 0.
- Текущие intrinsic-size, `object-fit: contain` и optical-scale contracts сохранены.
- Zero-product manufacturer filtering не менялась.
- Product data, assignments, lifecycle, SEO content, R9, Metrica, RFQ, navigation, breadcrumbs, catalog resilience, dependencies и migrations не менялись.
- Production writes: 0.
- Production deployment не меняется в этой Stage-only задаче.

## QA

Targeted contract проверяет exact решения для пяти производителей, checksum локальных graphics, отсутствие executable/external SVG content, отсутствие broken images и внешних logo URL. Stage browser QA выполняется на `/manufacturers` и пяти manufacturer detail routes в desktop/mobile Chromium и WebKit.
