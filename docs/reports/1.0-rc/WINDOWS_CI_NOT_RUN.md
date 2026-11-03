# Windows CI — NOT RUN

Проверено 3 ноября 2026: среда Linux, Windows executor/capabilities отсутствуют. Пользователь указал https://github.com/RRdimetro/planer . Public metadata: пустой репозиторий; git remote origin настроен. `gh auth status`: invalid configured token; authenticated API request: HTTP401. `git push --dry-run` завершился без изменения сервера: could not read Username / terminal prompts disabled.

Секреты не читались и не публикуются. Запрос подключения авторизованной среды отправлен; доступа к write/Actions нет. Windows workflow не запускался, job URL = null. Реальных Windows CI logs не существует, этот файл является отчётом о недоступности, а не CI-журналом.

Исходники содержат workflow и реальные Windows-only install/upgrade/portable/native-DPI/notification scripts. Приложена полная git-история для baseline 0.2.0/0.3.0. `M5/acceptance-gate.json` оставляет Stable false. Linux GUI/tests/static PE verification не заменяют эти пункты.
