# Этап 1 — нормализация SQLite
Миграция 0002 additive: old records/settings/change_log сохранены. Основные записи читаются/пишутся в entities + projects/tasks/calendar_events/notes/workouts, focus_sessions, нормализованные учебные subjects/aggregates/groups/works/stages/statuses, weekly snapshots/items и completion facts. Подготовлены связанные таблицы checklist/dependencies/recurrence/attachments/fitness/history для следующего этапа.

Для файловой базы выполняются: сериализация WAL в pre-v2 SQLite, перенос на отдельной migration-check копии, точное сравнение всех исходных DTO, foreign_key_check и integrity_check, проверка открываемости неизменённой v1-копии; только после этого транзакция действующей базы. Ошибка прерывает открытие без изменения v1. Оригинал records после перехода не изменяется. Версия повторно не применяется.

16/16 unit/integration; typecheck, lint, build прошли. Регрессия создаёт БД настоящим замороженным Store 0.1.0; проверяет учебные 9/4/54, пользовательскую отметку, заметку, проект, задачу, бег, сессию, исходный snapshot, настройки и историю. Отдельно проверены отказ при orphan reference и ограничения SQL.

GUI-проверка: study-e2e (отчёт M2-e2e.json); скриншот 01-normalized-study.png.
Windows запуск: README; Windows не проверен на этом этапе.
