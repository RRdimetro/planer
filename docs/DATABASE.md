# SQLite schema v1
`records(id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)))`, индекс `records_kind`; `settings(key PRIMARY KEY, payload CHECK(json_valid(payload)))`; `schema_migrations(version PRIMARY KEY, applied_at TEXT)`; `change_log(id INTEGER PRIMARY KEY, at, action, before_json, after_json)`.

Миграция v1 находится в конструкторе Store (`packages/database/index.ts`), выполняется в транзакции с `INSERT OR IGNORE` версии. WAL и foreign_keys включены. Все data access — main process. Drizzle используется для чтения/записи records/settings; SQL для migration/event log. Это документированное отклонение от полной нормализованной схемы в ТЗ: бизнес-инварианты обеспечивает Zod/domain layer, а не SQL foreign keys внутри JSON.

Kinds: task/project/event/workout/note/snapshot, subject/group/session, completion. Мягкое удаление пользовательских сущностей через deletedAt. Subjects удаляются каскадно с groups только по явному действию UI. Project archive сохраняет задачи.

Счётчики предметов независимы от матриц stage. Матрица: строки — определения этапов; колонки — номера работ с 1. Значения done/not_done/unknown. IDs UUID. Экзамены/итог null или строка.

UTC ISO timestamps: createdAt/completedAt/deletedAt/startedAt. Даты плана YYYY-MM-DD, время HH:mm — локальная календарная дата/время. duration/estimate — минуты, session.seconds — секунды, distance — км.

Snapshots хранят исходные tasks с весами/оценками/сроками. Completion records хранят снимок завершённой задачи: изменение срока позднее не переписывает своевременность. Undo восстанавливает data/settings из последних 30 снимков текущего запуска. Архив ZIP дополнительно содержит change_log и сериализацию SQLite; manifest/schema/checksums проверяются при restore.
