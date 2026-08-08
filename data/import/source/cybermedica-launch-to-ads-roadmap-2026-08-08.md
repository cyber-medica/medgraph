# CyberMedica — Roadmap to Ads Launch

Цель: максимально быстро перейти от текущего Stage к Production и запуску рекламы.

| ID | Задача | Статус | Приоритет | Блокирует запуск | Результат |
|---|---|---|---|---|---|
| R1 | EndoMarket business/content/name/media audit v4 | Готово | P0 | Да | Финальные тексты/названия/теги/media-policy переданы как source of truth. |
| R2 | Codex: применить Corrective v4 и восстановить объединенный Stage-каталог | Ожидает Codex | P0 | Да | Stage должен показывать 113 товаров: 71 прежний published + 42 новых drafts. |
| R3 | Codex: восстановить все доступные source media для карточек с fallback/без фото | Ожидает Codex | P0 | Да | Особенно EC-430T; watermark запрещен. |
| R4 | Codex: импортировать source descriptions/features/specifications для всех 42 новых товаров | Ожидает Codex | P0 | Да | EndoMarket — source of truth; generic copy запрещен. |
| R5 | Повторный полный Stage-аудит ChatGPT | После R2–R4 | P0 | Да | Контент, визуал, карточки, media, tags, Product Detail, mobile. |
| R6 | Ручная приемка Stage владельцем | После R5 | P0 | Да | Только визуальная проверка готового Stage. |
| R7 | Controlled Production Release | Не начато | P0 | Да | Merge/promote только после приемки; production writes контролируемые. |
| R8 | Production smoke + catalog/sitemap/RFQ regression | Не начато | P0 | Да | Подтвердить рабочие landing URLs перед рекламой. |
| R9 | Проверить рекламную аналитику и цели конверсии | Требуется проверка | P0 | Да | До запуска трафика должны фиксироваться отправки RFQ/лидов. |
| R10 | Запуск рекламной кампании на приоритетные landing pages | Не начато | P0 | Да | Запуск сразу после R7–R9. |
| R11 | Исправить GitHub scheduled synthetic playwright/playwright-core | Известный corrective | P1 | Нет | Убрать ложные CI-падения; не задерживать рекламный запуск. |
| R12 | Скрыть «База знаний» на странице подтверждения + polish | Post-launch backlog | P1 | Нет | Высокий приоритет после запуска. |
| R13 | Cellular custom-domain connectivity forensics | Отложено | P2 | Нет | Не возвращаться до отдельного решения; запуск не блокирует. |
