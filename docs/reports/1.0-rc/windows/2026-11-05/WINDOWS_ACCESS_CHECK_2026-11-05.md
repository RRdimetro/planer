# FOCUS OS PRO RC1 — проверка доступа Windows-релиза, 5 ноября 2026

Статус: **BLOCKED; версия остаётся 1.0.0-rc.1, не Stable.**

## Фактические результаты

- GitHub connector определил пользователя RRdimetro. Стандартный `gh auth status` в сетевой среде подтвердил действительный вход этого аккаунта. Секреты не читались и не заменялись.
- API читает RRdimetro/planer; права владельца включают push. Это не доказывает, что интеграции предоставлен Git-доступ к репозиторию.
- `git ls-remote --heads origin`: HTTP403, `Permission to RRdimetro/planer.git denied to RRdimetro`. Следующий в цепочке push dry-run не запускался; реальный push не выполнялся. Force push не использовался.
- API настроек Actions: HTTP403, `Resource not accessible by integration`.
- В списке установок подключённого GitHub App видна только организация IU5-TOPIT-Prog, с выборочными репозиториями. Установка для личного аккаунта RRdimetro не показана.
- API списка Actions runs: total_count=0, workflow_runs=[]; список веток также пуст. Фактических run/job URL и новых Windows CI logs нет. Страница Actions: https://github.com/RRdimetro/planer/actions . Это ссылка на список, не на состоявшийся прогон.

История исходников сохранена, базовый commit RC1 — 6e13161, локальная ветка для продолжения — release/windows-rc1. Приложение, SQLite, десять страниц, дизайн B и существующий Windows workflow не изменялись. Пользовательская база не открывалась. Повторная сборка прежних бинарников без Windows проверки не выдаётся за новый результат.

## Краткая матрица Windows-проверок

| Проверка | Результат |
|---|---|
| NSIS установка | NOT_RUN |
| Portable запуск | NOT_RUN |
| Native SQLite / Electron ABI | NOT_RUN |
| Миграции 0.2.0 → RC1 | NOT_RUN |
| Миграции 0.3.0 → RC1 | NOT_RUN |
| Создание/изменение/завершение задач | NOT_RUN |
| Сохранение после перезапуска | NOT_RUN |
| Учебный трекер 9/4/54 | NOT_RUN |
| Тренировки | NOT_RUN |
| Календарь | NOT_RUN |
| Таймер при сворачивании | NOT_RUN |
| Резервная копия/восстановление | NOT_RUN |
| Все десять страниц, дизайн B | NOT_RUN |
| Доставка OS уведомления | NOT_RUN |
| Native DPI100/125/150 | NOT_RUN |

Предыдущие Linux проверки и статические проверки Windows EXE остаются отдельными свидетельствами. Ни одна строка этой таблицы ими не закрывается. Windows acceptance gate остаётся false.

## Безопасное продолжение через подключённый репозиторий

В настройках подключения GitHub откройте Configure/Manage. В GitHub https://github.com/settings/installations проверьте доступ GitHub App к **личному аккаунту RRdimetro** и включите **RRdimetro/planer** в разрешённые репозитории. Для публикации workflow нужны соответствующие разрешения интеграции на содержимое репозитория и workflows; для управления Actions — доступ Actions. Права владельца репозитория сами по себе не заменяют разрешения установки приложения.

После обновления доступа повторяется обычная read-only проверка `git ls-remote`, затем обычный push отдельной ветки. Токены/пароли в чат не присылайте. Обход отказа через другую учётную запись, снятие proxy/guard или пересоздание истории через файловый API не применяется.

Если подключение не поддерживает Git push, исходную историю можно опубликовать обычным Git с вашего компьютера, с авторизацией в браузере через Git Credential Manager. Скачайте архив полной истории RC1 из текущей папки Drive:

https://drive.google.com/file/d/1F5_oT5Q3sE-ID8e1EvORgmK8_AjVTM3a/view

В PowerShell из каталога с архивом:

```powershell
Expand-Archive .\FOCUS_OS_PRO_1.0.0-rc.1_Repository_History.zip .\focus-release-history
git clone .\focus-release-history\repository.bundle .\focus-release
Set-Location .\focus-release
git remote set-url origin https://github.com/RRdimetro/planer.git
git switch -c release/windows-rc1 6e13161
git push -u origin release/windows-rc1
```

Команды не используют force и сохраняют оригинальные commit SHA и историю, включая baselines0.2.0 и0.3.0. Если ветка с таким именем уже появилась, не перезаписывайте её: сначала прочитайте удалённый head и согласуйте продолжение через обычный fetch/merge либо новое имя ветки.

Существующий `.github/workflows/windows.yml` запускается по push, использует windows-2022, проверяет приложение и устанавливает реальные NSIS baseline0.2.0/0.3.0. После первого push нужно получить настоящий run URL и изучить результат; это ещё не автоматическое принятие Stable. Native DPI125/150 и видимое OS уведомление требуют подходящей реальной Windows-сессии согласно WINDOWS_INSTRUCTIONS.md. Acceptance gate не понижается.

Текущая поставка RC с исходниками, установщиками UNTESTED, скриншотами и предыдущими тестами: https://drive.google.com/drive/folders/1_M7yVzq1er29VbCJ6kdAdibqtmcDVLbE . Новых проверенных Windows-бинарников на этой итерации нет.
