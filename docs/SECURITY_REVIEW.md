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
