# M5 — Release Candidate, Linux verification

Версия **1.0.0-rc.1**, ветка `release/1.0-rc-polish`. Stable acceptance: **false**. Windows execution/CI отсутствует; реальные CI logs не предоставляются, причина зафиксирована в WINDOWS_CI_NOT_RUN.md.

| Проверка | Результат |
|---|---|
| TypeScript strict / ESLint / production build | PASS |
| Unit/integration | 66 tests,23 files PASS |
| GUI regression | 10 suites,40 проверок PASS |
| Visual matrix | 100 PNG;60 filled/empty×10pages×3sizes,20 dialogs,20 Electron zoom |
| Renderer errors / root overflow | 0 / 0 |
| Text contrast audit | 1596 nodes,0 failures в обследованной выборке |
| SQLite migration0.2.0/schema3→5 | PASS на изолированной копии |
| SQLite0.3.0/schema5 compatibility | PASS на изолированной копии |
| Original study import | 9 subjects,4 groups,54 exact statuses preserved |
| Attachments / FK / integrity / crash transaction | PASS |
| Native Windows install/portable/update/DPI/OS toast | NOT_RUN, blocks Stable |

| GUI suite | Проверок | Статус |
|---|---:|---|
| core-e2e.json | 6 | PASS |
| workspaces-e2e.json | 4 | PASS |
| lifestyle-e2e.json | 3 | PASS |
| fitness-e2e.json | 6 | PASS |
| insights-e2e.json | 5 | PASS |
| desktop-e2e.json | 4 | PASS |
| calendar-e2e.json | 2 | PASS |
| study-binding-e2e.json | 1 | PASS |
| notes-queue-e2e.json | 3 | PASS |
| ux-e2e.json | 6 | PASS |

Все GUI тесты запускали настоящий Electron/Linux, локальные SQLite и IPC. В desktop suite перехвачено создание Notification для проверки расписания/дедупликации; реальная доставка OS не заявляется. Native file dialog ответы подставлены в backup tests, но ZIP/SQLite/вложения записываются и проверяются реально. SQLITE_FULL специально инжектируется на границе настоящего main IPC, чтобы проверить UX; это не симуляция физически заполненного диска.

Последняя CSS-поправка: прокрутка фиксированной навигации при низком viewport150%. После неё полностью повторена визуальная матрица с реальными кликами по всем10 страницам. Исправлено раннее снятие lazy Study route: автоматизация ждёт исчезновения loading fallback. Осмотренные PNG содержат страницы, не loading placeholders. См. VISUAL_FINDINGS.md. Обычные screenshots имеют1366×768,1920×1080,2560×1440; zoom-снимки явно отделены от native Windows DPI. Вертикальная прокрутка и внутренние scroll containers календаря/таблиц допустимы. Цвета градиентов проверены визуально; computed text audit не равен независимой WCAG сертификации.

Производительность измерена отдельно на исходной0.3.0 и текущем RC с одинаковым1000/3000/3000 fixture, до финальной навигационной CSS-поправки. См. ../PERFORMANCE_REPORT.md; Windows не измерен.

Windows setup/portable статическая проверка записывается в `artifacts.json` после извлечения готовых EXE: совпадение всех frontend/main/preload файлов, версияRC, PE AMD64, native SQLite ABI140. Это не Windows runtime test. Канонический gate — acceptance-gate.json, без реальных Windows evidence false.
