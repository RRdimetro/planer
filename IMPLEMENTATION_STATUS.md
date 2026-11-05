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

Финальная упаковка 0.3.0 выполнена: NSIS 89 452 944 байт, Portable 89 201 617 байт. Из обоих готовых EXE извлечены реальные payloads; все 25 frontend/main/preload файлов совпали с финальным build, версия 0.3.0, PE AMD64, native SQLite export `node_register_module_v140`, checksum native совпал. Отчёты `F/windows-build.json` и `F/artifacts.json`. Эти проверки не запускают Windows и не закрывают Windows gate. Публикация в отдельную подпапку существующей поставки; предыдущие файлы не заменяются.

Дополнительный GUI-сценарий с реальной задержкой IPC 900 ms воспроизвёл race заметок: старый ответ мог заменить более новый черновик. Исправлены защита всей очереди и draining правок, появившихся при ожидании перехода/закрытия. Новый `notes-queue-e2e` добавлен в Windows CI-команду; lifestyle regression повторён. Финальная поставка пересобирается с этим исправлением, прежние кандидаты 0.3.0 не публикуются.

Повторная финальная упаковка после исправления очереди заметок завершена и прошла извлечение/проверку всех embedded файлов обоих EXE. Проверка закрытия при двух overlapping saves и последующего реального перезапуска также прошла. SHA-256 финальных кандидатов: `F/artifacts.json`; Windows execution остаётся false.

## 1.0 Final Polish — release/1.0-rc-polish

M1 Windows Baseline: BLOCKED/NOT RUN. Executor Linux; origin RRdimetro/planer добавлен, но `gh auth status` invalid и push dry-run не получает credentials. Запрошен доступный репозиторий/Windows executor без запроса секретов. Все 16 Windows-проверок остаются not_run (`docs/reports/1.0-rc/M1/windows-status.json`). 1.0 Stable не объявляется. Независимые M2–M5 выполняются на временных копиях; рабочая пользовательская база не открывается тестами.

M2 Visual Polish: завершён локальный проход Obsidian B — доминирующий Daily Score, выразительный график рядом с задачами, согласованные типографические токены, индивидуальная композиция страниц, reduced motion 160–220ms. 80 реальных PNG, 0 renderer errors/overflow. Найдены/исправлены 8 случаев контраста; повторный computed text audit 0 нарушений обследованной выборки (без объявления полной WCAG/Windows DPI сертификации). Данные/схема БД не изменялись.

M3 UX Audit: быстрый task create/complete/Undo; фокус из сохранённой задачи; safe dirty/busy forms; sidebar aria-current; понятные success/errors, backup acknowledgement после проверки. Исправлен недоступный для screen reader global error под Radix: alert теперь внутри диалога. Реальный IPC SQLITE_FULL тест подтвердил сохранение черновика, отсутствие ложного success и успешный retry. Таблица сценариев/проверки: docs/reports/1.0-rc/M3. Новых разделов и схем БД нет.

M4 Reliability: 66 unit/integration в 23 файлах прошли, включая реальный SIGKILL во время SQLite WAL transaction. Базы фактических Store 0.2.0/schema3 и 0.3.0/schema5 обновлены на временных копиях: точные записи, вложения и 9/4/54 сохранены, FK/integrity OK. Исправлены исключение перерывов из Home, timezone/deadline instants и прогноз проектов по уникальным фактам. Замер 1000 задач/3000 завершений/3000 сессий: median fresh-process launch 5531→1604 ms, Home 4215→151, Analytics 5716→375, Planner 685→666, Tasks 467→567 (регрессия одиночного замера отмечена, улучшение этого экрана не заявляется). Поиск 55→53 ms, суммарный measured process working set 718→641 MiB. Linux/debug/warm filesystem, не Windows benchmark.

M5 Release Candidate: версия 1.0.0-rc.1, все10 страниц сохранены. 66 unit/integration и10 реальных Electron GUI suites прошли; финальные100 PNG (60 filled/empty×3 разрешения,20 диалогов,20 Electron zoom), renderer errors/overflow0, computed text contrast1596nodes/0 failures. Найдено и исправлено обрезание sidebar при150%; все10 направлений доступны прокруткой. Автоматизация снимков теперь ждёт загрузки lazy Study. Исходная schema5/AppData/appId не меняются. Реальный Windows gate остаётся BLOCKED: origin RRdimetro/planer есть, но API401/push credentials unavailable; ветка не опубликована в GitHub, CI job/log отсутствует. NSIS/Portable кандидаты собираются с пометкой UNTESTED, Stable не принят. Результаты публикуются в новую папку Google Drive «FOCUS OS PRO — Release Candidate»: https://drive.google.com/drive/folders/1_M7yVzq1er29VbCJ6kdAdibqtmcDVLbE .

Финальные Windows-кандидаты RC собраны и статически проверены: NSIS 89 461 940 байт, Portable 89 210 526 байт. Из обоих EXE извлечены фактические embedded payloads; все 25 frontend/main/preload файлов совпали с финальным production build, версия 1.0.0-rc.1, PE AMD64, native SQLite ABI140 и checksum подтверждены. Подробности M5/artifacts.json и windows-build.json. Это не запуск Windows: Windows runtime/CI gate false. Поставка ZIP включает source, полную git-историю, setup/portable,100 снимков и отчёты; рабочие базы не включаются.

## Windows release follow-up — 5 ноября 2026

Локальная ветка release/windows-rc1 создана от6e13161. GitHub account/CLI authentication теперь действительны, metadata RRdimetro/planer читается. Git transport `git ls-remote` отказал HTTP403 (Permission denied); push dry-run/real push не запускались, force не применялся. Actions permissions API также403 Resource not accessible by integration. В подключённых установках видна только IU5-TOPIT-Prog/selected repositories; личная установка RRdimetro не показана. Remote branches пусты; Actions runs total_count0. Windows gate остаётся false, новых Windows evidence/Stable нет. Код приложения и workflow не менялись, рабочая БД не открывалась. Доказательства, полная матрица NOT_RUN и безопасная публикация обычным Git с сохранением истории: docs/reports/1.0-rc/windows/2026-11-05/.

Windows CI впервые запущен после обновления доступа: https://github.com/RRdimetro/planer/actions/runs/41991121523 . История опубликована без force push в release/windows-rc1. Native SQLite rebuild, TypeScript и lint прошли;65/66 unit/integration прошли на Windows. Единственный сбой: crash-test не создавал release directory в чистом checkout. Подготовка каталога исправлена; следующий прогон проверит все66. Stable gate остаётся false.

## Реальный Windows CI — 5 ноября 2026, актуальный статус

История опубликована без force push в release/windows-rc1. Run41991121523 выявил ENOENT в подготовке crash-test; исправлено. Run41991402257 (a8f18bd) прошёл66/66 unit/integration, TS/lint/build, GUI RC,100 Windows screenshots, native NSIS build/install/update0.2/0.3, данные9/4/54, task restart, minimized timer, backup/restore и actual Portable persistence. Native DPI100 подтверждён96DPI; API уведомления дал show_event, видимый toast UIAutomation не найден. Native125/150 не проверены. Общий CI conclusion=failure и Stable gate=false сохраняются. Новые фактические отчёты/полные logs: docs/reports/1.0-rc/windows/live/. Run URL: https://github.com/RRdimetro/planer/actions/runs/41991402257 . Поставка реальных Windows сборок/evidence: https://drive.google.com/drive/folders/109n9Bl3ziJjU1PDLMqybG3P7pWTo25MR . Предыдущие документы о недоступности авторизации являются историческими; текущий доступ работает.

Интерактивный Windows runner: пользователь подтвердил возможность подключения. Подготовлен workflow windows-native.yml, только workflow_dispatch, labels self-hosted/Windows/X64/focus-interactive. Три реальных системных масштаба, сохранение native evidence, итоговая проверка после загрузки двух предыдущих run IDs и core41991402257. Добавлен SHA256 установленного app.asar и требование одинакового payload во всех трёх native отчётах; gate не ослаблен. Runner ещё не подтверждён Online/Idle. Инструкция: windows/live/INTERACTIVE_RUNNER.md.
