# Windows 10/11 x64 — RC и проверка

**Версия1.0.0-rc.1 не принята как Stable.** До запуска сохраните ZIP-копию из настроек действующей версии и копию всего `%APPDATA%\FOCUS OS PRO` при закрытом приложении. Приложение не требует удаления старой базы. Native build/update нужно сначала проверить на копии данных.

## Готовые кандидаты

Setup_UNTESTED.zip: распакуйте и запустите содержащийся NSIS Setup.exe, выберите каталог, откройте FOCUS OS PRO. Portable_UNTESTED.zip: распакуйте весь архив и запустите Open_App.cmd или Portable.exe. Open_Demo.cmd открывает отдельную демонстрационную базу с маркировкой. Portable хранит пользовательскую базу в том же AppData-каталоге; файл EXE переносим, SQLite не хранится рядом с EXE. Бинарники unsigned, Windows execution отсутствует. SHA256 сверяется PowerShell `Get-FileHash .\имя.exe -Algorithm SHA256` с SHA256SUMS.txt.

Первый запуск: пустое пространство или оригинальный учебный импорт9/4/54. Настройки→Создать ZIP-копию/Восстановить; восстановление заменяет текущую базу после подтверждения и проверки архива. Копия включает вложения и историю.

## Из исходников и CI

Node22.18+, pnpm10.20.0. Для native SQLite при отсутствии prebuilt требуются VS C++ Build Tools и Python.

```powershell
corepack enable
corepack prepare pnpm@10.20.0 --activate
pnpm install --frozen-lockfile
pnpm run rebuild
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:rc
node scripts/rc-visual.mjs final
pnpm dist:win
```

Проверки используют temp базы, не AppData. `pnpm dev` запускает из исходников. Системный Node и Electron имеют разные ABI: unit тесты запускаются через scripts/test.mjs с Electron Node mode. Нельзя копировать Linux better_sqlite3.node в Windows. Целевая текущая ABI140, проверка делается actual Windows runtime.

Полная история: распакуйте Repository_History.zip, `git clone repository.bundle focus-os-pro`. Настройте origin своего репозитория и загрузите ветку с разрешённой GitHub-авторизацией; пуш запускает `.github/workflows/windows.yml`. Workflow строит actual baseline0.2.0(d9e8446)/0.3.0(ab86f30), проверяет настоящие NSIS install→upgrade/restart/tasks/study/backup/timer, Portable EXE и сохраняет evidence. Необходим checkout fetch-depth0.

Native platform test запускается после install/upgrade (result.json содержит installedExecutable). В интерактивной Windows-сессии установите **системный** масштаб100%,125%,150% по очереди, при необходимости выйдите/войдите. Не подменяйте его Electron zoom/force-device-scale-factor:

```powershell
$env:FOCUS_EXPECTED_NATIVE_SCALE='1'
node scripts/rc-windows-platform.mjs
$env:FOCUS_EXPECTED_NATIVE_SCALE='1.25'
node scripts/rc-windows-platform.mjs
$env:FOCUS_EXPECTED_NATIVE_SCALE='1.5'
node scripts/rc-windows-platform.mjs
node scripts/rc-acceptance-gate.mjs --require-stable
```

Для отдельной ручной машины без upgrade result.json сначала задайте `$env:FOCUS_CURRENT_EXE='C:\путь\FOCUS OS PRO.exe'` на установленный RC. Тест сверит фактическую версию приложения. Меняйте Windows scale перед каждой соответствующей командой. Тест проверяет scaleFactor и GetDpiForWindow, actual SQLite и присутствие toast в OS UIAutomation; `show` event без видимого уведомления недостаточен. На headless/неинтерактивном runner уведомления могут не отобразиться: это блокировка, а не pass. Результаты привязаны к версии package.json, старые отчёты другой версии не принимаются.

Календарь проверяется общим GUI-набором: день/неделя/месяц, реальный drag/resize. 12 пунктов пользовательской матрицы остаются NOT_RUN до получения Windows evidence. Для ручного аудита повторите создание/изменение/завершение задачи, закрытие/перезапуск, изменение одной учебной ячейки, перетаскивание события, таймер со сворачиванием, ZIP backup/delete/restore и update на копиях0.2/0.3 при каждом масштабе. Журналы и снимки сохраняются в docs/reports/1.0-rc/windows; ссылки actual CI run должны быть добавлены после выполнения.
