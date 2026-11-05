# FOCUS OS PRO 1.0.0-rc.1 — реальные Windows CI результаты

5 ноября 2026. Runner windows-2022, Windows Server build20348, Electron39.8.10 / native SQLite ABI140. **Stable acceptance false.** Это реальное выполнение Windows, не кросс-сборка.

Исходники: https://github.com/RRdimetro/planer/tree/release/windows-rc1

Первый прогон: https://github.com/RRdimetro/planer/actions/runs/41991121523 —65/66 тестов, сбой подготовки crash-test: отсутствовал release directory в чистом checkout. Исправлено явным созданием каталога, без изменения программы/схемы/дизайна.

Повторный прогон: https://github.com/RRdimetro/planer/actions/runs/41991402257 — фактический commit a8f18bd37f22c6cb6c224b2098691ad5279f6f1c. Общий conclusion=failure, причина — неподтверждённый видимый системный toast. Ниже успешные и незавершённые проверки разделены явно.

| Проверка | Результат |
|---|---|
| Native SQLite rebuild / ABI140 | PASS |
| TypeScript / ESLint / production build | PASS |
| Unit/integration | PASS66/66 |
| GUI RC: задачи, учёба, проекты, тренировки, календарь, заметки, аналитика, фокус, настройки | PASS |
| 10 страниц / сохранение Obsidian B | GUI и визуальный прогон PASS |
| Скриншоты filled/empty×3 размера, диалоги, Electron zoom | PASS100 настоящих PNG Windows |
| NSIS install / первый запуск | PASS на baseline0.2 и0.3 |
| Update0.2.0→RC1 | PASS |
| Update0.3.0→RC1 | PASS |
| Задачи edit/complete/restart persistence | PASS в установленном приложении |
| Учебные9/4/54 | Точное сохранение PASS |
| Таймер при сворачивании | PASS |
| ZIP backup/delete/restore | PASS |
| Actual Portable launcher / создание и restart задачи | PASS |
| SQLite integrity после установки | ok |
| Native DPI100 | PASS: scaleFactor1,GetDpiForWindow96,forcedScale=false |
| Видимый OS toast | НЕ ПОДТВЕРЖДЁН: APIshow_event, UIAutomation matches0 |
| Native DPI125 /150 | NOT_RUN |
| Общая приёмка Stable | FALSE |

Исходный acceptance-gate.json объединяет native DPI и видимый toast в один пункт: nativeDPI1=false относится к комбинированному условию, хотя сырой native-platform-1.json подтверждает сам масштаб100%. Chromium/Electron zoom125/150 не заменяет native DPI.

Все опасные операции выполнялись на временных тестовых данных runner, не на рабочей базе. Native Save/Open/confirmation dialog responses задаются тестом; архивы/SQLite/вложения сохраняются и восстанавливаются реально. Скриншоты сняты из настоящего Electron, не из макетов. Некоторые исторические генераторы JSON всё ещё выводят conservative windowsTested=false; фактическая платформа и шаги данного Windows job записаны в полных CI logs. Это не подтверждение физической установки на Windows10/11 — использован разрешённый заданием Windows runner.

## Что нужно для Stable

Интерактивная Windows-сессия с установленным RC, проверка реально видимого toast и системного масштаба100/125/150. Причина отсутствия видимого toast на runner пока не установлена: полученный show_event не доказывает доставку. Условия gate не ослаблялись, показ уведомления не подменялся. Команды — WINDOWS_INSTRUCTIONS.md; `FOCUS_CURRENT_EXE` позволяет указать установленный EXE. При каждом масштабе используется native GetDpiForWindow, без force-device-scale-factor. После успешного сбора evidence нужно повторить gate и отдельно собрать/проверить целевую Stable версию; сейчас распространяется RC1.

NSIS и Portable в поставке — реальные бинарники из второго Actions run, unsigned. Сборка и основные проверки прошли; остающиеся блокировки указаны выше. До обновления рабочей базы сохраните ZIP-копию и весь AppData каталог при закрытой программе. Дизайн и функции приложения не менялись.
