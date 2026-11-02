# FOCUS OS PRO 0.2.0 — Development Review

**Кандидат 0.2.0. Windows-релиз ещё не принят: исполнение под Windows и Windows CI не подтверждены.** Проект продолжен от 0.1.0; все 10 страниц сохранены. «Привычки» и «Финансы» не добавлялись. Архив исходного статуса: docs/reports/0.2.0/BASELINE_0.1.0.md.

| Этап | Проверенный результат | Статус |
|---|---|---|
| 1. Нормализация | additive v2/v3, preflight на копии, точный перенос v1 DTO, SQL FK/check, сохранённая v1 SQLite-копия | Проверено в SQLite/Linux |
| 2. Планировщик | parent tasks/checklist/dependencies/cycle guards, recurrence occurrences, attachments, bulk/filter/tree; день/неделя/месяц, DnD/resize, weekly scope/snapshot, busy slots/rules/preview/atomic apply | Unit + Electron E2E |
| 3. Fitness | programs/exercises/sets/reps/weights, run metrics, actual volume/PR/charts, rest days | Контрольные наборы + Electron E2E |
| 4. Premium Forest | индивидуальные экраны, плотная главная, roadmap/notes/files, widget layout, отдельный demo workspace | 60 screenshot checks + UI E2E |
| 5. Дистрибуция | настоящие NSIS/portable cross-build; Windows CI install/update script | Cross-build проверяется статически; Windows execution НЕ выполнен |

## Сохранение данных

- Точный импорт: 9 предметов, четыре группы, 54 tri-state значения. Unknown ≠ not_done; исходные Экз/Итог null, агрегаты не удваиваются.
- Один учебный клик обновляет ровно одну SQL-ячейку и её timestamp.
- Миграция сначала на отдельной копии с WAL-данными; проверка точного соответствия записей, integrity_check и FK. Сохраняется открываемый pre-vN original. Ошибка не очищает действующую базу.
- Legacy records остаётся архивом; новые основные записи находятся в нормализованных таблицах.
- Backup проверяет SHA-256 JSON, истории и SQLite; транзакционное восстановление включает связи/байты вложений. Старые v1 ZIP поддерживаются. Старая undo-очередь после restore очищается.
- Notes pending autosave сбрасывается при переходе и до закрытия SQLite. Гонка раннего close handshake покрыта повторными GUI-прогонами.
- Исторические завершения и initial snapshots не переписываются при редактировании/переносе. Повторные задачи получают новые ID, исходный день месяца и смещение срока сохраняются.
- Месяцы/недели используют календарные даты; новая weekly membership хранит понедельник. Недатированные v1 weekly tasks без известной недели не получают выдуманную историческую неделю.

## Проверки

- TypeScript strict, ESLint, production build — прошли.
- 33 unit/integration — прошли; полный вывод в docs/reports/0.2.0/unit-tests.txt.
- Миграционный regression fixture использует замороженный настоящий Store 0.1.0.
- SQL tests: orphan references, checks, cross-group stage FK, cycles, atomic rollback.
- Контрольные задачи: month-end recurrence/deadline, week scope, stale preview, capacity/deadline/dependencies/midnight, empty/future workout metrics.
- Fitness control: 2×8×60=960 кг; незавершённый план не попадает в фактический объём/PR.
- User/demo isolation, отказ cross-mode ZIP/JSON, seed idempotence.
- Electron: M1/M2/M3/M5 regressions и новые planner/fitness/notes-flush/projects workflows. JSON-отчёты рядом с отчётами этапов.
- 60 настоящих скриншотов user/demo × 10 страниц × три разрешения; renderer errors и горизонтальное переполнение проверены.
- Упакованный Linux smoke проверяет SQLite и отсутствие Node/require в renderer. Windows-бинарники этим тестом не проверяются.

## Windows gate

Нет приложенного Windows executor; git remote не настроен, GitHub CLI не авторизована. Реальный CI не запускался. Установка, запуск, обновление и OS-specific уведомления Windows НЕ объявляются успешными. Статус явно false в docs/reports/0.2.0/05-windows-status.json.

Workflow windows-2022 собирает baseline 0.1.0 и 0.2.0, реально устанавливает/обновляет, запускает установленный exe, проверяет данные/учёбу/таймер/backup и сохраняет evidence. Для baseline требуется полная история; приложен repository.bundle. Публикации и обязательного cloud sync нет. Cross-build файлы unsigned, помечены UNTESTED в поставке.

## Границы, которые ещё не закрывают весь MASTER SPEC

- Windows execution/signing/SmartScreen и ручные Windows 10/11 usability checks.
- Явная конвертация учебного aggregate → per-item и редактор уже существующего состава групп; новые группы независимы.
- CSV/XLSX import/export, расширенные отчёты переносов/нагрузки, распределение долгих focus sessions по смене суток/DST.
- Унификация выбранного часового пояса во всех журналах (header/Home/Planner учитывают настройку; часть журналов следует OS locale/timezone).
- Повторы создают следующую occurrence по завершении текущей, не разворачивают бесконечные будущие серии; повторяемые шаблоны событий/пар отдельно не сделаны.
- Полный независимый accessibility/security/performance audit. Замер 1000 задач относится к текущему Linux worker, не к Windows.

Ни одна из этих границ не помечена завершённой. Учебный референс сохранён без изменений. Данные тестов/демо живут отдельно от пользовательской базы. Запуск Windows и команды проверок: README.md. Подробности этапов: docs/reports/0.2.0/01–05.

## Итоговая фиксация кандидата
Windows NSIS 104793980 байт и portable 95888572 байт собраны. PE/ASAR/native/static integrity проверки прошли, содержимое main/preload/frontend совпадает с финальным build. Реальный UI: 1000 задач + фильтр, create/render 1978 ms на Linux. Контрольные суммы: docs/reports/0.2.0/05-artifacts.json. Полный Windows release по-прежнему НЕ принят: Windows runtime/CI = false. Исходники поставляются с полной git-историей для реального upgrade workflow.
