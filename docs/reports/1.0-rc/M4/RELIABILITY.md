# M4 — Reliability и расчёты

Пройдено 66 unit/integration tests, 23 файла; журнал `unit-tests.txt`. TypeScript strict, ESLint и production build прошли. Новый календарный Electron-прогон проверил 00–24h, реальный pointer resize 30→45→75 минут и interval/until событий.

Исправлены: Home ошибочно включала break в фокус-время; учёт legacy completion fallback в графике; точные ISO дедлайны сравниваются как instants, date-only — в выбранном часовом поясе; проектный прогноз требует три уникальных прошлых завершения, не принимает будущие/дублирующиеся факты. Общий weighted project progress используется на главной и в проектах. Добавлены случаи empty/zero denominator, timezone/DST, frozen observation time, focus/break и исключение будущих тренировок.

Миграционная проверка использует **настоящий код Store из зафиксированных git-коммитов** 0.2.0 и 0.3.0, скомпилированный отдельно. Созданы временные SQLite базы с учебным импортом, уточнённым unknown статусом, задачей и вложением. Текущий Store открывает только эти копии. Schema3→5 и schema5→5: 14 canonical records без изменений, точные 9 предметов/4 группы/54 статуса сохранены, attachment bytes совпали, foreign_key_check и integrity_check прошли. Для schema3 создан migration backup; schema5 не меняет схему. Это не проверка NSIS update Windows. См. migrations.json.

Сбой проверен реальным SIGKILL дочернего Electron Node-процесса во время незавершённой транзакции: 100 длинных записей и cache_size=2 вынудили WAL spill. После открытия сохранились только последние committed записи и все учебные данные; FK/integrity OK. Рабочая пользовательская база не открывалась.

Существующие backup-тесты проверяют checksum ZIP/SQLite/history/blobs, отказ при повреждении, запрет demo→user, автоматические backup/retention, восстановление на отдельном каталоге. UX-тест отдельно проверил фактический verified backup и отсутствие ложного success при SQLITE_FULL. Хранение вложений остаётся локальным, SQL FK включены.

Границы: сессия исторически относится к дню начала, поминутное разделение по смене суток/DST не внедрялось. Реальная пользовательская база не предоставлена; гарантии основаны на fixtures и старых Store. Windows native ABI/installation/crash/restart требуют Windows CI; не отмечены выполненными.
