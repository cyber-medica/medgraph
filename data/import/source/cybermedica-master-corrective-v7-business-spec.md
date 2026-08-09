# CyberMedica — Master Corrective v7

## Цель
Довести Stage до финальной приёмки перед Production и рекламой.

## Ключевой вывод
Проблема системная: одновременно повреждены/неравномерны legacy descriptions, source completeness новых товаров и presentation Product Detail.

## Бизнес-решения
- Product Detail hero: carousel, без thumbnail strip, без большой пустоты.
- Description: 1–3 читаемых абзаца, authoritative source only.
- Key Features: короткие source-derived тезисы, без длинных абзацев.
- Specifications: полный authoritative набор.
- Applications: все теги на Product Detail; +N запрещён.
- Manufacturer: последний содержательный блок.
- Legacy catalog: полный content-integrity audit.
- EndoMarket/new catalog: semantic source audit, не доверять одному старому features[].
- Acceptance выполняется напрямую на https://stage.cyber-medica.ru.

## Подтвержденные P0
- Hamilton-T1: `$21` в Description.
- Mindray SV300: `$22` в Description.
- iLivTouch: source features 4, Stage features 0.
- EB-500 исторически был неполным; hard reference 6 features / 7 specs / 3 media.
- Medinova BR/CY/UR: generic descriptions и неполезные single-feature blocks.
- HD-350: неполная карточка.
- HD-500/HD-550: должны быть корректно представлены как отдельные модели без дублей.

## Принцип для Features
Source fact сохраняется, UI presentation сокращается.
Например:
`Видеогастроскоп обеспечивает получение профессионального... изображения большого разрешения, с естественной цветопередачей`
→
`Изображение высокого разрешения с естественной цветопередачей`.

## Группы, обязательные для regression
SonoScape EG/EC 430/500; EG-UC5T; EG-UR5; EB-5H20; EB-5T28; ED-5GT; EB-500;
Medinova BR-1231/1242/1249/1259; UR-1328; CY-1355/CY-1356; AF; HV-3101;
Medinova monitors 19/24/27/32/55; ENDO CLEAN 1000/2000; EC-5BD/EC-10BD;
ERBE VIO 200 S/D/VIO 3/VIO+APC2; BOWA ARC 303/350/400; iLivTouch;
Hamilton-T1; Mindray SV300; SonoScape HD-350/500/550.

## Финальный результат
`Готово, проверяйте stage: https://stage.cyber-medica.ru`
