# M1 — Windows Baseline

Статус: **BLOCKED / NOT RUN**, 3 ноября 2026.

Проверено наличие доступа: управляемый executor — Linux, Windows capabilities отсутствуют, репозиторий RRdimetro/planer найден пустым; remote настроен, но authenticated push dry-run отказал (credentials unavailable), `gh auth status` сообщает invalid GH_TOKEN. Содержимое токена не читалось. Доступного Actions run/job ID нет. Никакие Linux/Wine результаты не объявляются Windows-проверкой.

Подготовка workflow обновляется для baseline 0.2.0 и 0.3.0, текущего NSIS/portable и отдельного сохранения evidence. Native DPI 100/125/150 и фактическая OS-доставка toast требуют реальной Windows-конфигурации и наблюдаемого результата, а не Chromium zoom или подмены Notification.show.

Продолжение независимых M2–M5 разрешено заданием; версия останется `1.0.0-rc.1`. Stable gate закрывается только фактическими свидетельствами Windows. Вопрос о доступном репозитории/Windows-среде направлен пользователю асинхронно.

Репозиторий предоставлен пользователем: https://github.com/RRdimetro/planer . Public read доступен, GitHub API с текущей авторизацией возвращает 401, `git push --dry-run` не получает credentials. Удалённые ветки не изменялись.
