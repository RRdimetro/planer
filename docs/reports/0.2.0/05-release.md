# Этап 5 — сборка и граница проверки Windows
Подготовлены Windows NSIS и portable через electron-builder с официальным Electron 39.8.10 win32-x64 и better-sqlite3 12.11.1 electron-v140-win32-x64. Native binding копируется в отдельный build workspace; Linux binding разработчика не подменяется. Иконка/метаданные приложения включены. Артефакты unsigned.

Wine helper не работает в этом Linux worker. Для cross-build используется встроенный electron-builder UninstallerReader (его штатный macOS-путь) для извлечения NSIS-uninstaller из PE без исполнения Windows-кода; собственный installer script не подменяется. Publish отключён. Отчёт окончания сборки: 05-cross-build.json; статическая проверка и SHA-256: 05-artifacts.json. Статическая проверка не считается Windows smoke test.

Реальный Windows CI НЕ ЗАПУЩЕН: нет Windows executor, git remote отсутствует, GitHub CLI auth недоступна/невалидна. Никаких утверждений об успешной установке/обновлении/работе Windows нет. Файл 05-windows-status.json фиксирует false, а не успешную заглушку.

Workflow windows-2022 собирает настоящий baseline 0.1.0 из commit 79764b5, ставит его NSIS, создаёт данные через UI, затем ставит 0.2.0 в тот же каталог и запускает установленный executable. Проверяет исходные данные/учёбу, изменение задач, таймер, перезапуск, ZIP restore и сохранение userData при удалении. На отсутствие baseline workflow падает, а не пропускает upgrade test. Нужна полная история; она поставляется в repository.bundle.

Linux Electron unit/integration, critical UI E2E, screenshots и packaged Linux smoke выполнены отдельно. Windows релизный gate остаётся ОТКРЫТЫМ до настоящего зелёного запуска CI и проверки Windows 10/11.

## Финальный результат сборки
NSIS: 104793980 байт; portable: 95888572 байт. Статическая проверка прошла: main/preload и каждый актуальный frontend asset в Windows ASAR совпадают с финальным build; Electron и SQLite DLL имеют AMD64 PE, ожидаемый ABI 140. SHA-256 в 05-artifacts.json. Эти результаты подтверждают состав артефакта, не его исполнение на Windows.

33 unit/integration и восемь critical Electron UI сценариев прошли; дополнительно 60 screenshot checks и packaged Linux smoke. Отдельный реальный UI-прогон: создание/рендер 1000 задач за 1978 ms и рабочий фильтр (Linux worker; не Windows performance guarantee).
