# Статус реализации
M0 — каркас, SQLite/Drizzle миграция, sandbox IPC, стили. Проверки выполняются.
M1–M5 — ещё не реализованы.

Инварианты: aggregate и per-stage не суммируются; unknown ≠ not_done; оценки null; импорт не перезаписывает существующие предметы. Временные метки UTC, даты плана — локальные календарные YYYY-MM-DD. Длительности — минуты, сессии — секунды, расстояния — км.

M0: foundation unit 1/1, typecheck/lint/build прошли. См. docs/reports/M0.md. Windows ещё не проверен.

M1 — работает MVP задач/проектов/планирования. 4/4 теста. Ограничения перечислены в docs/reports/M1.md. Учебный экран подключён вместе с общим layout, точная проверка seed относится к M2.

M2 — точный seed и tri-state сохранение проверены: 6/6 unit/integration + Electron E2E. См. docs/reports/M2.md, docs/screenshots/M2.png. Конвертация агрегатов в детализацию не реализована; группы остаются независимыми.

M3 — работают журнал тренировок, persistent focus timer, Markdown notes autosave/export. 7/7 unit/integration. Детальные ограничения: docs/reports/M3.md.
M1 UI E2E повторно прошёл после исправления aria-label полей формы (docs/reports/M1-e2e.json).

M4 — вычисления, immutable weekly snapshots, historical completions, smart planner preview работают. Полный перечень и ограничения: docs/reports/M4.md. Полнота M4 ещё частичная.
