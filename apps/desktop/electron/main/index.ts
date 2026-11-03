import {
  automaticBackup,
  verifiedBackup,
} from "../../../../packages/database/backup-service";
import { dueReminders } from "../../../../packages/core/reminders";
import { SessionClock } from "../../../../packages/core/session-clock";
import {
  exportStudyExcel,
  importStudyExcel,
} from "../../../../packages/database/study-excel";
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Notification,
  shell,
  powerMonitor,
} from "electron";
import path from "node:path";
import { z } from "zod";
import { spawn } from "node:child_process";
import { seedDesignPreview } from "../../../../packages/database/demo";
import type { State, Session, Item } from "../../../../packages/contracts";
import { designPreview } from "../../../../packages/core/design-preview";
import { claimPreviewWorkspace } from "../../../../packages/database/preview-workspace";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import AdmZip from "adm-zip";
import { restoreArchive } from "../../../../packages/database/backup";
import { Store } from "../../../../packages/database";
import { commandSchema, recordSchema } from "../../../../packages/contracts";
const isDemo =
  process.argv.includes("--focus-demo") || process.env.FOCUS_DEMO === "1";
const preview = designPreview(
  isDemo,
  process.env.FOCUS_HOME_CONCEPT || undefined,
  process.env.FOCUS_DEMO_EMPTY === "1",
);
app.setName("FOCUS OS PRO");
app.setPath(
  "userData",
  process.env.FOCUS_DATA_DIR ??
    path.join(app.getPath("appData"), preview.directory),
);
const marked = (state: State, notice?: string): State => ({
  ...state,
  diagnostics: {
    ...state.diagnostics,
    ...(notice ? { notice } : {}),
    workspace: isDemo ? "demo" : "user",
    ...(preview.homeConcept ? { homeConcept: preview.homeConcept } : {}),
  },
});
let store: Store;
let timer: NodeJS.Timeout;
const clock = new SessionClock(performance.now());
let background: NodeJS.Timeout;
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
(hasLock ? app.whenReady() : new Promise<void>(() => {}))
  .then(() => {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    if (preview.homeConcept)
      claimPreviewWorkspace(
        app.getPath("userData"),
        preview.homeConcept,
        preview.empty,
      );
    store = new Store(path.join(app.getPath("userData"), "focus.db"));
    if (isDemo && !preview.empty) seedDesignPreview(store, "demo");
    if (preview.empty && !store.state().settings.onboarded)
      store.setting("onboarded", true);
    app.setAppUserModelId("local.focusos.pro");
    const win = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 1100,
      minHeight: 700,
      backgroundColor: "#090F0C",
      title: "FOCUS OS PRO",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setZoomFactor(Number(store.state().settings.uiScale ?? 1));
    let closeAllowed = false,
      closing = false;
    let closeTimeout: NodeJS.Timeout | undefined;
    win.on("close", (event) => {
      if (closeAllowed) return;
      event.preventDefault();
      if (closing) return;
      closing = true;
      win.webContents.send("focus:prepare-close");
      closeTimeout = setTimeout(async () => {
        const answer = await dialog.showMessageBox(win, {
          type: "warning",
          message: "Не удалось подтвердить сохранение. Остаться в приложении?",
          buttons: ["Остаться", "Закрыть"],
          defaultId: 0,
          cancelId: 0,
        });
        closing = false;
        if (answer.response === 1) {
          closeAllowed = true;
          win.close();
        }
      }, 5000);
    });
    ipcMain.on("focus:close-subscriber-ready", (event) => {
      if (event.sender === win.webContents && closing)
        win.webContents.send("focus:prepare-close");
    });
    ipcMain.on("focus:close-ready", (event, success) => {
      if (
        event.sender !== win.webContents ||
        !closing ||
        typeof success !== "boolean"
      )
        return;
      clearTimeout(closeTimeout);
      closing = false;
      if (success) {
        closeAllowed = true;
        win.close();
      } else
        dialog.showErrorBox(
          "Изменения не сохранены",
          "Не удалось сохранить последние изменения. Приложение осталось открытым. Повторите сохранение.",
        );
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event, url) => {
      if (url !== win.webContents.getURL()) event.preventDefault();
    });
    ipcMain.handle("focus:state", (event) => {
      if (event.sender !== win.webContents) throw Error("Доступ запрещён");
      return marked(store.state());
    });
    ipcMain.handle("focus:history", (event, input) => {
      if (event.sender !== win.webContents) throw Error("Доступ запрещён");
      const id = z.string().uuid().parse(input);
      return (
        store.db
          .prepare(
            "SELECT id,at,action,CASE WHEN json_extract(before_json,'$.kind') IS NOT NULL THEN json_object('id',entity_id,'kind',json_extract(before_json,'$.kind'),'title',json_extract(before_json,'$.title'),'date',json_extract(before_json,'$.date'),'status',json_extract(before_json,'$.status')) END before_json,CASE WHEN json_extract(after_json,'$.kind') IS NOT NULL THEN json_object('id',entity_id,'kind',json_extract(after_json,'$.kind'),'title',json_extract(after_json,'$.title'),'date',json_extract(after_json,'$.date'),'status',json_extract(after_json,'$.status')) END after_json FROM entity_changes WHERE entity_id=? OR entity_id IN(SELECT id FROM tasks WHERE project_id=?) ORDER BY at DESC,rowid DESC LIMIT 1000",
          )
          .all(id, id) as {
          id: string;
          at: string;
          action: string;
          before_json: string | null;
          after_json: string | null;
        }[]
      ).map((r) => ({
        id: r.id,
        at: r.at,
        action: r.action,
        before: r.before_json ? JSON.parse(r.before_json) : null,
        after: r.after_json ? JSON.parse(r.after_json) : null,
      }));
    });
    ipcMain.handle("focus:revision", (event, input) => {
      if (event.sender !== win.webContents) throw Error("Доступ запрещён");
      const id = z.string().uuid().parse(input);
      const row = store.db
        .prepare("SELECT after_json FROM entity_changes WHERE id=?")
        .get(id) as { after_json: string | null } | undefined;
      if (!row?.after_json) return null;
      const parsed = recordSchema.safeParse(JSON.parse(row.after_json));
      return parsed.success ? parsed.data : null;
    });
    ipcMain.handle("focus:image", (event, input) => {
      if (event.sender !== win.webContents) throw Error("Доступ запрещён");
      const id = z.string().uuid().parse(input);
      const row = store.db
        .prepare("SELECT content FROM attachments WHERE id=?")
        .get(id) as { content: Buffer } | undefined;
      if (!row || row.content.length > 10 * 1024 * 1024) return null;
      const b = row.content;
      const mime = b
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : b[0] === 255 && b[1] === 216
          ? "image/jpeg"
          : b.subarray(0, 3).toString() === "GIF"
            ? "image/gif"
            : b.subarray(0, 4).toString() === "RIFF" &&
                b.subarray(8, 12).toString() === "WEBP"
              ? "image/webp"
              : null;
      return mime ? `data:${mime};base64,${b.toString("base64")}` : null;
    });
    ipcMain.handle("focus:command", async (event, input) => {
      if (event.sender !== win.webContents) throw Error("Доступ запрещён");
      const c = commandSchema.parse(input);
      try {
        if (c.type === "workspace") {
          const args = app.isPackaged
            ? ["--focus-demo"]
            : [app.getAppPath(), "--focus-demo"];
          if (process.argv.includes("--no-sandbox")) args.push("--no-sandbox");
          const child = spawn(process.execPath, args, {
            detached: true,
            stdio: "ignore",
            env: {
              ...process.env,
              FOCUS_DEMO: "1",
              FOCUS_HOME_CONCEPT: "",
              FOCUS_DEMO_EMPTY: "0",
              FOCUS_DATA_DIR: path.join(
                app.getPath("appData"),
                "FOCUS OS PRO Design Preview 0.2",
              ),
            },
          });
          child.unref();
          return marked(store.state());
        }
        if (c.type !== "file") {
          if (c.type === "focusAction")
            advance(clock.elapsed(performance.now()));
          const next = store.command(c);
          if (
            c.type === "focusStart" ||
            (c.type === "focusAction" && c.action === "resume")
          )
            clock.resume(performance.now());
          if (c.type === "settings" && c.key === "uiScale")
            win.webContents.setZoomFactor(Number(c.value));
          return marked(next);
        }
        if (c.action === "fullscreen") {
          win.setFullScreen(!win.isFullScreen());
          return marked(store.state());
        }
        if (c.action === "integrity") {
          const integrity = store.db.pragma("integrity_check", {
            simple: true,
          });
          const fks = store.db.pragma("foreign_key_check") as unknown[];
          if (integrity !== "ok" || fks.length)
            throw Error("Нарушена целостность базы");
          await dialog.showMessageBox(win, {
            message: "SQLite integrity_check: OK. Foreign keys: OK.",
          });
          return marked(store.state());
        }
        if (c.action === "studyExport") {
          const result = await dialog.showSaveDialog(win, {
            defaultPath: "FOCUS-study.xlsx",
            filters: [{ name: "Excel", extensions: ["xlsx"] }],
          });
          if (result.filePath)
            fs.writeFileSync(
              result.filePath,
              await exportStudyExcel(store.state(), isDemo ? "demo" : "user"),
            );
          return marked(store.state());
        }
        if (c.action === "studyImport") {
          const result = await dialog.showOpenDialog(win, {
            filters: [{ name: "Excel", extensions: ["xlsx"] }],
            properties: ["openFile"],
          });
          if (result.filePaths[0]) {
            const file = result.filePaths[0];
            if (fs.statSync(file).size > 50 * 1024 * 1024)
              throw Error("Excel больше 50 МБ");
            const data = await importStudyExcel(
              fs.readFileSync(file),
              store.state(),
              isDemo ? "demo" : "user",
            );
            const before = store.state();
            let changed = 0;
            for (const g of data.groups) {
              const old = before.groups.find((x) => x.id === g.id);
              g.values.forEach((row, r) =>
                row.forEach((v, col) => {
                  if (old?.values[r]?.[col] !== v) changed++;
                }),
              );
            }
            const answer = await dialog.showMessageBox(win, {
              type: "question",
              message: `Импорт Excel: ${data.subjects.length} предметов, ${data.groups.length} групп, ${data.cells} ячеек. Изменений ячеек: ${changed}. Записи вне файла сохранятся. Продолжить?`,
              buttons: ["Отмена", "Импортировать"],
              defaultId: 0,
              cancelId: 0,
            });
            if (answer.response === 1) {
              const folder = path.join(app.getPath("userData"), "backups");
              fs.mkdirSync(folder, { recursive: true });
              verifiedBackup(
                store,
                path.join(folder, `before-study-import-${Date.now()}.zip`),
                isDemo ? "demo" : "user",
              );
              store.command({
                type: "studyWorkbook",
                subjects: data.subjects,
                groups: data.groups,
              });
            }
          }
          return marked(store.state());
        }
        if (c.action === "attach") {
          if (!c.id) throw Error("Запись не выбрана");
          const r = await dialog.showOpenDialog(win, {
            properties: ["openFile"],
          });
          if (r.filePaths[0]) {
            const file = r.filePaths[0];
            if (fs.statSync(file).size > 25 * 1024 * 1024)
              throw Error("Максимальный размер — 25 МБ");
            store.attach(
              c.id,
              path.basename(file),
              "application/octet-stream",
              fs.readFileSync(file),
            );
          }
          return marked(store.state());
        }
        if (c.action === "exportAttachment") {
          const a = store.db
            .prepare("SELECT name,content FROM attachments WHERE id=?")
            .get(c.id ?? "") as { name: string; content: Buffer } | undefined;
          if (!a) throw Error("Вложение не найдено");
          const r = await dialog.showSaveDialog(win, { defaultPath: a.name });
          if (r.filePath) fs.writeFileSync(r.filePath, a.content);
          return marked(store.state());
        }
        if (c.action === "openData") {
          await shell.openPath(app.getPath("userData"));
          return marked(store.state());
        }
        if (c.action === "backup") {
          const result = await dialog.showSaveDialog(win, {
            defaultPath: "FOCUS-backup.zip",
            filters: [{ name: "ZIP", extensions: ["zip"] }],
          });
          if (result.filePath) {
            verifiedBackup(store, result.filePath, isDemo ? "demo" : "user");
            return marked(store.state(), "Копия проверена и сохранена");
          }
        }
        if (c.action === "restore") {
          const result = await dialog.showOpenDialog(win, {
            filters: [{ name: "ZIP", extensions: ["zip"] }],
            properties: ["openFile"],
          });
          if (result.filePaths[0]) {
            if (fs.statSync(result.filePaths[0]).size > 512 * 1024 * 1024)
              throw Error("Слишком большой файл");
            const zip = new AdmZip(result.filePaths[0]);
            const answer = await dialog.showMessageBox(win, {
              type: "warning",
              message: "Заменить текущие данные резервной копией?",
              buttons: ["Отмена", "Восстановить"],
              defaultId: 0,
              cancelId: 0,
            });
            if (answer.response === 1) {
              verifiedBackup(
                store,
                path.join(
                  app.getPath("userData"),
                  "backups",
                  `before-restore-${Date.now()}.zip`,
                ),
                isDemo ? "demo" : "user",
              );
              restoreArchive(store, zip, isDemo ? "demo" : "user");
              return marked(store.state(), "Данные восстановлены из копии");
            }
          }
        }
        if (c.action === "export" || c.action === "exportNote") {
          const note = store
            .state()
            .items.find((i) => i.id === c.id && i.kind === "note");
          const r = await dialog.showSaveDialog(win, {
            defaultPath:
              c.action === "export" ? "FOCUS-data.json" : "Заметка.md",
          });
          if (r.filePath)
            fs.writeFileSync(
              r.filePath,
              c.action === "export"
                ? JSON.stringify({
                    ...JSON.parse(store.dump(true)),
                    workspace: isDemo ? "demo" : "user",
                  })
                : (note?.description ?? ""),
            );
        }
        if (c.action === "import") {
          const r = await dialog.showOpenDialog(win, {
            filters: [{ name: "JSON", extensions: ["json"] }],
            properties: ["openFile"],
          });
          if (r.filePaths[0]) {
            const answer = await dialog.showMessageBox(win, {
              type: "warning",
              message: "Импорт заменит все текущие данные. Продолжить?",
              buttons: ["Отмена", "Импортировать"],
              cancelId: 0,
            });
            if (answer.response === 1) {
              if (fs.statSync(r.filePaths[0]).size > 512 * 1024 * 1024)
                throw Error("Файл слишком большой");
              const raw = fs.readFileSync(r.filePaths[0], "utf8");
              const workspace = JSON.parse(raw).workspace ?? "user";
              if (workspace !== (isDemo ? "demo" : "user"))
                throw Error("Демо и рабочие данные не смешиваются");
              const check = new Store(":memory:");
              try {
                check.restore(raw);
                if ((check.db.pragma("foreign_key_check") as unknown[]).length)
                  throw Error("Нарушены связи импорта");
              } finally {
                check.close();
              }
              verifiedBackup(
                store,
                path.join(
                  app.getPath("userData"),
                  "backups",
                  `before-import-${Date.now()}.zip`,
                ),
                isDemo ? "demo" : "user",
              );
              store.restore(raw);
              store.resetUndo();
            }
          }
        }
        return marked(store.state());
      } catch (e) {
        fs.appendFileSync(
          path.join(app.getPath("userData"), "errors.log"),
          `${new Date().toISOString()} ${String(e)}\n`,
        );
        throw e;
      }
    });
    const logError = (error: unknown) =>
      fs.appendFileSync(
        path.join(app.getPath("userData"), "errors.log"),
        `${new Date().toISOString()} ${String(error)}\n`,
      );
    const advance = (delta: number) => {
      if (delta <= 0) return;
      const active = store
        .list<Session>("session")
        .find((x) => x.state === "running");
      if (!active) return;
      active.seconds += delta;
      if (active.target && active.seconds >= active.target) {
        active.seconds = active.target;
        active.state = "done";
        const settings = Object.fromEntries(
          (
            store.db.prepare("SELECT key,payload FROM settings").all() as {
              key: string;
              payload: string;
            }[]
          ).map((s) => [s.key, JSON.parse(s.payload)]),
        );
        if (settings.notifications && Notification.isSupported())
          new Notification({
            title: "FOCUS OS PRO",
            body:
              active.kind === "break"
                ? "Перерыв завершён. Готовы продолжить?"
                : "Фокус-сессия завершена. Время отдохнуть.",
          }).show();
      }
      store.put("session", active);
    };
    clock.resume(performance.now());
    powerMonitor.on("suspend", () => {
      try {
        advance(clock.suspend(performance.now()));
      } catch (e) {
        logError(e);
      }
    });
    powerMonitor.on("resume", () => clock.resume(performance.now()));
    timer = setInterval(() => {
      try {
        advance(clock.elapsed(performance.now()));
      } catch (e) {
        logError(e);
      }
    }, 1000);
    const jobs = () => {
      try {
        automaticBackup(
          store,
          path.join(app.getPath("userData"), "backups"),
          isDemo ? "demo" : "user",
        );
        const settings = Object.fromEntries(
          (
            store.db.prepare("SELECT key,payload FROM settings").all() as {
              key: string;
              payload: string;
            }[]
          ).map((s) => [s.key, JSON.parse(s.payload)]),
        );
        if (!settings.notifications || !Notification.isSupported()) return;
        const items = [
          ...store.list<Item>("task"),
          ...store.list<Item>("workout"),
        ];
        const notices = dueReminders(
          items,
          String(
            settings.timezone ??
              Intl.DateTimeFormat().resolvedOptions().timeZone,
          ),
          Number(settings.notificationLead ?? 10),
        );
        for (const n of notices)
          if (
            !store.db
              .prepare("SELECT key FROM notification_receipts WHERE key=?")
              .get(n.key)
          ) {
            const notification = new Notification({
              title: n.title,
              body: n.body,
            });
            notification.on("click", () => {
              if (win.isMinimized()) win.restore();
              win.show();
              win.focus();
            });
            notification.show();
            store.db
              .prepare("INSERT INTO notification_receipts VALUES(?,?)")
              .run(n.key, new Date().toISOString());
          }
      } catch (e) {
        logError(e);
      }
    };
    background = setInterval(jobs, 15000);
    setTimeout(jobs, 3000);
    if (process.env.FOCUS_DEV_URL) win.loadURL(process.env.FOCUS_DEV_URL);
    else win.loadFile(path.join(__dirname, "../dist/index.html"));
  })
  .catch((error) => {
    dialog.showErrorBox("Ошибка запуска FOCUS OS PRO", String(error));
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => {
  clearInterval(timer);
  clearInterval(background);
  store?.close();
});
