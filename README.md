# FOCUS OS PRO
Локальное Electron-приложение Windows 10/11 x64. Node.js 22.18+ и pnpm 10.20.0.

```powershell
corepack enable
corepack prepare pnpm@10.20.0 --activate
pnpm install
pnpm rebuild
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dist:win
```

SQLite находится в `%APPDATA%/FOCUS OS PRO/focus.db` (точное имя каталога зависит от режима запуска Electron). Обновление не удаляет данные. Резервные копии — в Настройках через системный диалог. При несовместимом SQLite binding выполните `pnpm rebuild`. Для unit-тестов под Node после Electron rebuild: `pnpm exec electron-rebuild` не нужен; переустановите better-sqlite3 через `pnpm rebuild better-sqlite3`, затем перед desktop повторите `pnpm rebuild`.

Windows-сборка запускается на Windows: `pnpm dist:win`. Непроверенный установщик не считается релизом. Данные по умолчанию пусты; импорт учебного референса — только по желанию.
