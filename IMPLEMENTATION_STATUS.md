# FOCUS OS PRO — статус реализации

**Рабочая предварительная версия. Полное MASTER SPEC ещё не выполнено.** Все 10 разделов имеют реальные операции с SQLite; заглушек финальных экранов и демонстрационных метрик нет. Разделы «Привычки» и «Финансы» не создавались.

| Этап | Статус | Результат |
|---|---|---|
| M0 | Готов базовый foundation | Electron/React/TS, 10 маршрутов, WAL, Drizzle, migration v1, sandbox/typed IPC, logging |
| M1 | MVP работает, расширенные требования частично | CRUD задач/проектов, Kanban/таблица/список, недельный backlog, день/неделя/месяц, DnD, конфликт/undo, история, E2E restart |
| M2 | Точный импорт и основные операции готовы | 9 предметов, 4 группы, все 54 этапа, tri-state, null-оценки, счётчики, добавление/редактирование предметов, прямые клики, сохранение |
| M3 | Основные операции готовы, расширения частично | CRUD тренировок, план/факт/темп; Pomodoro/free/pause/recovery; Markdown autosave/export |
| M4 | Частично | Реальные KPI/score/charts, исторические завершения, immutable snapshots, smart planner preview+atomic apply |
| M5 | Частично; Windows release не принят | Premium UI, shortcuts, persistent widgets/settings, ZIP backup/restore, security validation, CI definition, Linux package |

## Проверено

- Полный файл CODEX_MASTER_SPEC.md прочитан; исходное изображение просмотрено.
- TypeScript strict, ESLint, production build — успешно.
- 13/13 unit/integration. Контрольный seed проверяет каждую строку и ячейку.
- 4 Electron UI E2E прошли: задачи после перезапуска; учебные unknown/not_done/done после перезапуска; фокус/пауза/заметки; ZIP restore.
- 10 экранов × 3 разрешения = 30 настоящих скриншотов, без renderer error/горизонтального переполнения страницы.
- 1000 задач batch + read ~133 ms (один замер Linux worker).
- Linux directory packaging прошёл; smoke report отдельно.

## Не завершено

- Полная модель/редактор подзадач, checklist, зависимостей, вложений, повторов/occurrences; массовые изменения и весь набор фильтров.
- Project milestones/roadmaps и достоверный календарный прогноз завершения.
- Resize событий календаря, повторяемые шаблоны пар/дороги, ограничения после тренировок и гибкая работа на лекциях.
- Конвертация учебных агрегатов в детальные работы. Новые группы явно независимы: удвоения нет. Редактор существующего состава групп отсутствует.
- Структурированные силовые подходы/рекорды, workout templates и полные fitness charts.
- Расширенные отчёты по переносам/проектам/нагрузке и распределение длительных фокус-сессий по суткам/DST. Настройка timezone сейчас применяется к дате header; остальные локальные даты следуют OS timezone.
- Вложения заметок, связи с задачами/предметами; CSV import/export; полный редактор рабочего календаря/категорий.
- Развёрнутая нормализованная SQL-схема ТЗ: сейчас domain-validated JSON payload, FK внутри JSON контролируются не SQL.
- Полные accessibility/Windows performance tests, независимый security audit, подписанный установщик и Windows release smoke.

## Данные и ограничения

Aggregate РК/ДЗ и detailed stages не суммируются. Unknown ≠ not_done. Экз/Итог изначально null. Импорт референса добровольный и не перезаписывает существующие предметы. Все пользовательские данные сохраняются в userData/SQLite; тестовые workspace изолированы в OS temp. Snapshots фиксируют исходные веса/оценки/сроки; completion facts защищают историю от позднего изменения дедлайна.

Единицы: estimate/duration — минуты, focus.seconds — секунды, distance — км. Timestamps UTC; planned date/time — локальные календарные значения. Детали схемы: docs/DATABASE.md.

После каждого этапа есть docs/reports/M0.md–M5.md и docs/screenshots/M0.png–M5.png. Windows инструкции — README.md. Подготовлен Windows CI, но его запуск не подтверждён; фиктивного `.exe` нет.
