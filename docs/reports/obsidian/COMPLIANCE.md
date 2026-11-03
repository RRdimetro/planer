# Obsidian 0.3.0 — соответствие утверждённому ТЗ

| Требование | Реализация и свидетельства | Граница проверки |
|---|---|---|
| Утверждённая Home B | Прямое развитие существующей Home, shared tokens/nav, persisted widgets/reset; A/RESULT и B/core E2E | A сохранил 0 changed pixels. Новые дневные показатели — точечное дополнение |
| Десять страниц, offline, SQLite | Electron main, preload IPC, CSP, локальные fonts/assets, normalized DB; 60 PNG F | Linux Electron, Windows execution отсутствует |
| Миграции без потери | v1–v5 additive, preflight copy, каноническое сравнение/FK, backup; migration-v2 и obsidian-core/study tests | Проверено на fixtures/копиях, личная рабочая БД не была приложена |
| Учебный импорт | 9/4/54, unknown/null, timestamp invariants, editor, explicit bindings, настоящий XLSX | Шаблон приложения; произвольные XLS и маппинг не сделаны |
| Планировщик/задачи | 00–24, DnD, native pointer resize, серии, conflicts/free windows, preview/apply, subtasks/checklists/dependencies/files/bulk/backlog | Серия 2–104. Следующая task occurrence после завершения |
| Проекты | Цели/этапы, status, weighted progress, remaining/forecast, Kanban/Gantt/activity | Forecast требует истории; Gantt не придумывает даты |
| Fitness | Programs/exercises/sets/reps/weights/run metrics/PR/plan-fact/periods, actual 960 kg GUI control | Только реальные подтверждённые записи |
| Insights | Daily/Weekly, deadlines/accuracy/focus/moves/overdue/load/weekdays/projects/fitness/month heatmap, фильтры | До 366 дней; sessions по дню начала, без реконструкции DST |
| Deep Work | Pomodoro/free/break/task/duration/fullscreen/history, monotonic main timer/suspend events | Реальный minimized/busy Linux; реальный sleep Windows не проверен |
| Knowledge Base | Markdown/folders/tags/search/files/images/links/backlinks/tasks/projects/autosave/history | Remote HTML/images отключены; локальные изображения до 10 MB |
| Control Panel | Scale/density/motion/timezone/weights/notifications/backup/restore/import/demo/integrity/version | OS notification delivery и DPI Windows не приняты |
| Большие списки | Measured table/Kanban virtualization, cached calculations, lazy routes, compact audit | 1000 длинных записей, Linux worker; не Windows benchmark |
| Backup | Manual/auto/retention, verified restore-before-rotation, pre-restore/import ZIP, checksum | ZIP целиком, не выборочное объединение архивов |
| Demo isolation | Разные каталоги/БД, marker, cross-mode import/restore rejected, постоянный banner | Demo не переносится в user автоматически |
| Windows release | NSIS/portable cross-build, PE x64/native ABI/ASAR checks, workflow + real install smoke подготовлены | **Windows CI не запускался. Реальный Windows-релиз не принят** |

A–E и код F проверены; F как Windows-приёмка остаётся открытым. Тесты не подменяют неизвестные факты успешными статусами. Исходники сохраняют историю предыдущей реализации. Инструкции установки/запуска/обновления и ограничения — README.
