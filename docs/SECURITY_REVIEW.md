# Security review (предварительный)
- SQLite, filesystem, notifications — только Electron main.
- Preload allowlist: state/command; Zod discriminated union; значения настроек валидируются по ключам.
- contextIsolation=true, nodeIntegration=false, sandbox=true. OS sandbox отключается флагом только в CI launch scripts.
- CSP запрещает remote scripts/images/connect; Markdown raw HTML отключён, изображения не загружаются, ссылки не открываются.
- Новые окна и внешняя навигация запрещены. Никакого eval или remote content.
- SQL payload параметризован; миграции/CRUD/stages/restore транзакционны.
- ZIP не распаковывается по именам на диск; читает только фиксированные записи; проверяет schema/hash/размеры. Restore валидирует доменные записи до замены данных.
- Backup содержит историю и не является зашифрованным. Секреты или API ключи приложение не запрашивает.
- Не выполнены: независимый аудит зависимостей, Windows signing/SmartScreen smoke, проверка всех ACL Windows, миграция повреждённых файлов.

## 0.2.0 дополнения
- Нормализованные SQL FK/check/transactions; migration preflight на копии + recoverable original.
- Cycle guards для task relationships; stale planner preview проверяется до применения.
- Attachment read/write только через системный диалог, максимум 25 МБ на файл; renderer получает metadata, не произвольный путь/байты.
- User/demo — разные процессы/директории, постоянная sticky-плашка, archive/JSON mode check.
- API onCloseRequested — только подписка на фиксированный main close event; SQLite закрывается после завершения pending save. Node/fs не раскрываются.
- Backup SHA-256 охватывает data/history/SQLite, включая relations/blobs; failed restore атомарен, чужой mode отклоняется.
- Windows signing не выполнен. Cross-build не является проверкой runtime; CI status false до реального Windows-run.
