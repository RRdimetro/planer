# FOCUS OS PRO 0.2.0 — Development Review

**Кандидат 0.2.0. Windows-релиз ещё не принят: исполнение под Windows и Windows CI не подтверждены.** Проект продолжен от 0.1.0; все 10 страниц сохранены. «Привычки» и «Финансы» не добавлялись. Архив исходного статуса: docs/reports/0.2.0/BASELINE_0.1.0.md.

| Этап              | Проверенный результат                                                                                                                                                                                | Статус                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Нормализация   | additive v2/v3, preflight на копии, точный перенос v1 DTO, SQL FK/check, сохранённая v1 SQLite-копия                                                                                                 | Проверено в SQLite/Linux                                          |
| 2. Планировщик    | parent tasks/checklist/dependencies/cycle guards, recurrence occurrences, attachments, bulk/filter/tree; день/неделя/месяц, DnD/resize, weekly scope/snapshot, busy slots/rules/preview/atomic apply | Unit + Electron E2E                                               |
| 3. Fitness        | programs/exercises/sets/reps/weights, run metrics, actual volume/PR/charts, rest days                                                                                                                | Контрольные наборы + Electron E2E                                 |
| 4. Premium Forest | индивидуальные экраны, плотная главная, roadmap/notes/files, widget layout, отдельный demo workspace                                                                                                 | 60 screenshot checks + UI E2E                                     |
| 5. Дистрибуция    | настоящие NSIS/portable cross-build; Windows CI install/update script                                                                                                                                | Cross-build проверяется статически; Windows execution НЕ выполнен |

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

## Forest Noir V4 — Gate B (3 ноября 2026)

Полный приложенный brief прочитан и сохранён в `docs/research/forest-noir-v4/`. Работа в отдельной ветке `design/forest-noir-v4`. Gate A и реализация Gate B завершены; визуальное направление пока не утверждено. Полный редизайн остальных девяти страниц не начинался.

- A Editorial Forest: локальная оригинальная панорама, кириллическая Lora, редакционная иерархия и списки.
- B Obsidian Command Center: 64px навигация, сводка дня с эффективностью, три рабочие колонки, таймер и расписание.
- C Atmospheric Bento: асимметричная сетка 5/4/3 и 7/5, одна атмосферная карточка, приоритеты и недельный контекст.
- Все варианты работают через существующие State/IPC/SQLite команды. Новые компоненты и токены ограничены Home preview и её диалогами. Классическая пользовательская Home сохраняется до выбора направления.
- Три populated и три empty базы изолированы по каталогам; marker и launcher защищают от случайного открытия рабочей/чужой preview-базы. Никаких изменений схемы v3 и новых миграций. Побайтная неизменность пользовательской SQLite покрыта regression-тестом.
- Исходный учебный импорт: 9 предметов, 4 группы, все 54 tri-state значения. После UI-операций и перезапуска проверено точное сохранение учебных записей.
- TypeScript strict, ESLint, production build, 38 unit/integration — прошли. Предупреждения Vite: размер JS chunk и аннотации зависимости Zod.
- Electron/Linux E2E — прошёл: task create/edit/complete/undo, side-sheet, таймер, fuzzy commands, клавиатура, offline, график, 10 маршрутов, перезапуск всех шести preview-баз.
- 12 настоящих основных PNG: A/B/C × populated/empty × 1920×1080/1366×768. Дополнительно before, side-sheet, palette и контрольные снимки девяти остальных страниц.
- Визуальная регрессия остальных страниц: 0 изменённых пикселей на снимках 1366×768. Home A дополнительно проверена на четырёх размерах × zoom 100/125/150%; без горизонтального переполнения. Это Linux Chromium zoom, не Windows DPI certification.
- Записано реальное MP4 взаимодействий: completion/undo, sheet, commands, navigation, calendar drag и focus. 25fps записи не объявляется 60fps benchmark.
- Windows portable preview собран (96018067 байт) отдельно с маркировкой UNTESTED и CMD-launcher A/B/C/empty. Windows executor/CI отсутствует, реальный запуск Windows НЕ выполнен; unsigned, установка/обновление и DPI не приняты.

Сравнение, рекомендация C, ограничения, команды запуска и список добавленных компонентов: `docs/reports/forest-noir-v4/COMPARISON.md`. Машинные отчёты находятся рядом. Исходники и результаты публикуются в подпапке прежней поставки: https://drive.google.com/drive/folders/1uGsL1ZipowERVsZ9uXg2RoyDiY0zFY8H . Перед переходом к Gate C/D требуется выбор пользователем A/B/C.

## Obsidian Command Center — утверждён B, полное ТЗ A–F

Новое ТЗ полностью прочитано, сохранено в `docs/reports/obsidian/APPROVED_SPEC.md`. Рабочая ветка `feature/obsidian-complete`. Эксперименты A/C прекращены; B — единый эталон.

- Этап A: общие компоненты/токены/Tailwind без preflight, единая навигация и палитра. Home B сохранена: 0 изменённых пикселей в 1366×768 и 1920×1080. 12 настоящих снимков в `docs/screenshots/obsidian/A/`; 38 tests + typecheck/lint/build прошли. База на этом этапе не изменялась.
- Этапы B–F: в работе, ещё не приняты. Windows execution/CI по-прежнему не выполнены.

- Этап B проверен: миграция v4 с копией/восстановлением, события-серии и исключения, lanes конфликтов/свободные окна, недельный список/backlog, virtual DataTable, контекстные панели и история, persisted widgets + reset. 44 unit/integration, typecheck/lint/build и реальный Electron E2E прошли; 12 PNG в `docs/screenshots/obsidian/B/`. Бесконечные серии не объявляются: материализация 2–104 встреч. C–F ещё в работе.

- Этап C проверен: проекты Kanban/Gantt/активность, редактирование учебных групп, явная привязка агрегатов, настоящий XLSX с предпросмотром/backup. Additive v5, исходные 9/4/54 сохранены. 48 unit/integration + typecheck/lint/build и bundled Electron E2E прошли, 8 PNG. XLSX — шаблон приложения; произвольные XLS/маппинг не заявляются. Windows execution отсутствует, D–F в работе.

- Этап D проверен: Fitness Studio (сравнение периодов/реальный прогресс), Deep Work (Pomodoro/free/break/fullscreen), Knowledge Base (папки/ссылки/локальные изображения/версии/автосохранение). 50 unit/integration + typecheck/lint/build; два реальных Electron E2E, 12 обзорных PNG и контрольные 960 кг. Перерывы исключены из рабочих метрик. E/F ещё в работе; Windows не проверен.

- Этап E проверен: интерактивные Insights, Daily/Weekly Score, периоды/проекты/категории, реальные линии/столбцы/donut/heatmap, нагрузки и переносы с учётом timezone. 53 unit/integration + typecheck/lint/build, реальный Electron E2E, 4 PNG. Историческое время сессии относится к дню начала; ограничение явно описано. F/Windows в работе.

- Этап F, код и Linux-проверки: 59 unit/integration + strict TS/lint/production build прошли. Реальный общий Electron regression (core/calendar/workspaces/lifestyle/fitness/insights) и дополнительные desktop/bound-study прошли. 60 финальных PNG всех десяти страниц в 1366/1920/2560, demo и empty; без renderer errors/overflow. Измеряемая виртуализация таблицы/Kanban, compact audit с сохранением старой истории и версий при undo, проверенные автоматические копии/retention, single-instance, монотонный background timer и локальные reminders реализованы. Запрос notifications API проверен; OS-доставка Windows не заявляется. Календарь охватывает 00–24 и реальный pointer resize.
- Приёмка F/Windows НЕ завершена: нет Windows executor/подключённого remote/результата реального CI. NSIS/portable поставляются только как unsigned UNTESTED candidates после статической проверки PE/ASAR/native. Установка, обновление, DPI и Windows notifications остаются false: `docs/reports/obsidian/F/windows-status.json`. Реальная рабочая база пользователя к этой сессии не приложена; сохранность проверена на миграционных копиях/регрессионных fixtures и исходном импорте 9/4/54. Данные приложения не подменяются демонстрационными.
