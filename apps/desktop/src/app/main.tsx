import { successFeedback, userError } from "../shared/feedback";
import { TaskCard } from "../design/domain";
import { AppShell } from "../design/components";
import { Sidebar } from "../design/Sidebar";
import { PageHeader } from "../design/PageHeader";
import "../design/obsidian.css";
import { flushPending } from "../shared/pending";
const Projects = lazy(() =>
  import("../pages/Projects").then((m) => ({ default: m.Projects })),
);

import { ForestHome } from "../pages/forest-v4/ForestHome";
import { CommandPalette } from "../pages/forest-v4/ForestPalette";
const Fitness = lazy(() =>
  import("../pages/Fitness").then((m) => ({ default: m.Fitness })),
);
const WorkoutForm = lazy(() =>
  import("../pages/Fitness").then((m) => ({ default: m.WorkoutForm })),
);
const Tasks = lazy(() =>
  import("../pages/Tasks").then((m) => ({ default: m.Tasks })),
);
import { pages } from "../shared/navigation";
const Planner = lazy(() =>
  import("../pages/Planner").then((m) => ({ default: m.Planner })),
);
const Study = lazy(() =>
  import("../pages/Study").then((m) => ({ default: m.Study })),
);
const Focus = lazy(() =>
  import("../pages/Focus").then((m) => ({ default: m.Focus })),
);
const Notes = lazy(() =>
  import("../pages/Notes").then((m) => ({ default: m.Notes })),
);
const Analytics = lazy(() =>
  import("../pages/Analytics").then((m) => ({ default: m.Analytics })),
);
const Preferences = lazy(() =>
  import("../pages/Preferences").then((m) => ({ default: m.Preferences })),
);
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { create } from "zustand";
import { Search, Check, Trash2 } from "lucide-react";
import type {
  Command,
  Item,
  TaskDetails,
} from "../../../../packages/contracts";
import { newItem, conflicts } from "../../../../packages/core";
import { ItemForm } from "../features/ItemForm";
import { GoogleCalendarDetails } from "../features/GoogleCalendarIntegration";
import { isExternalCalendarItem } from "../../../../packages/google-calendar/view";
import { Modal } from "../shared/ui";
import "../shared/theme.css";
import "../shared/features.css";
import "../shared/premium.css";
import "../design/release-polish.css";
const useUI = create<{ page: number; go: (page: number) => void }>((set) => ({
  page: 0,
  go: (page) => set({ page }),
}));
const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
function App() {
  const { page, go: rawGo } = useUI();
  const [, setMinute] = useState(0);
  useEffect(() => {
    const tick = setInterval(() => setMinute((n) => n + 1), 60000);
    return () => clearInterval(tick);
  }, []);
  const go = useCallback(
    (next: number) => {
      void flushPending()
        .then(() => rawGo(next))
        .catch((e) => setError(userError(e)));
    },
    [rawGo],
  );
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["state"],
    queryFn: () => window.focusAPI.state(),
    refetchInterval: 1500,
  });
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [projectSelection, setProjectSelection] = useState<string | null>(null);
  const [noteSelection, setNoteSelection] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState("");
  const [toastRevision, setToastRevision] = useState<number | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inform = useCallback((text: string, revision: number | null = null) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast(text);
    setToastRevision(revision);
    toastTimeout.current = setTimeout(() => {
      setToast("");
      setToastRevision(null);
    }, 4000);
  }, []);
  useEffect(
    () => () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    },
    [],
  );
  const command = useCallback(
    async (c: Command) => {
      try {
        const s = await window.focusAPI.command(c);
        qc.setQueryData(["state"], s);
        setError("");
        window.dispatchEvent(
          new CustomEvent("focus-operation-error", { detail: "" }),
        );
        const feedback = successFeedback(c);
        if (s.diagnostics.notice) inform(s.diagnostics.notice);
        else if (
          feedback &&
          !(useUI.getState().page === 0 && c.type === "save")
        )
          inform(feedback.text, feedback.undo ? s.revision : null);
        return s;
      } catch (e) {
        setError(userError(e));
        window.dispatchEvent(
          new CustomEvent("focus-operation-error", { detail: userError(e) }),
        );
        setToast("");
        setToastRevision(null);
        if (toastTimeout.current) clearTimeout(toastTimeout.current);
        throw e;
      }
    },
    [qc, inform],
  );
  useEffect(() => window.focusAPI.onCloseRequested(flushPending), []);
  useEffect(() => {
    document.querySelector("main")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      e.preventDefault();
      setError(userError(e.reason));
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!document.querySelector('[role="dialog"]') || palette)
          setPalette((v) => !v);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (!document.querySelector('[role="dialog"]') && !palette)
          setEditing(newItem("task", ""));
      }
      if (
        e.ctrlKey &&
        e.key.toLowerCase() === "z" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        void command({ type: "undo" }).catch(() => {});
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  useEffect(() => {
    if (q.data?.settings.startPage !== undefined)
      go(Number(q.data.settings.startPage));
  }, [q.data?.settings.startPage, go]);
  if (!q.data)
    return (
      <main>
        <h1>FOCUS OS PRO</h1>
        <p role="status">
          {q.error ? String(q.error) : "Открываем ваше пространство…"}
        </p>
      </main>
    );
  const s = { ...q.data };
  const projects = s.items.filter((i) => i.kind === "project");
  const forestConcept = "B" as const;
  const forestHome = page === 0;
  const collapsed =
    s.settings.collapsed === undefined ? true : !!s.settings.collapsed;
  const save = async (i: Item, details?: TaskDetails) => {
    if (isExternalCalendarItem(i)) { setEditing(i); return; }
    if (
      conflicts(
        i,
        s.items.filter((x) => ["task", "event", "workout"].includes(x.kind)),
      ).length &&
      !window.confirm(
        "Время пересекается с другим событием. Всё равно сохранить?",
      )
    )
      return;
    await command(
      details
        ? { type: "saveTask", item: i, details }
        : { type: "save", item: i },
    );
    setEditing(null);
    if (page === 0) inform("Изменения сохранены");
  };
  const remove = async (i: Item) => {
    if (isExternalCalendarItem(i)) { setEditing(i); return; }
    if (
      window.confirm(
        i.kind === "project"
          ? "Архивировать проект? Задачи сохранятся."
          : `Удалить «${i.title}»?`,
      )
    )
      await command({ type: "remove", id: i.id });
  };
  const card = (i: Item) => isExternalCalendarItem(i) ? (
    <button key={i.id} className="gcal-readonly" onClick={() => setEditing(i)}>🎓 {i.title}</button>
  ) : (
    <TaskCard
      item={i}
      key={i.id}
      className="taskcard"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
    >
      <div className="row">
        <button
          className={"check " + (i.status === "done" ? "checked" : "")}
          aria-label={"Завершить " + i.title}
          onClick={() =>
            void save({ ...i, status: i.status === "done" ? "today" : "done" })
          }
        >
          {i.status === "done" && <Check size={14} />}
        </button>
        <button className="textbutton grow" onClick={() => setEditing(i)}>
          {i.title}
        </button>
        <button
          className="icon"
          aria-label={"Удалить " + i.title}
          onClick={() => void remove(i)}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="meta">
        <span className={"priority p" + i.priority}>P{i.priority}</span>
        <span>{i.estimate} мин</span>
        {i.date && <span>{i.date.slice(5)}</span>}
        {i.projectId && (
          <span>{projects.find((p) => p.id === i.projectId)?.title}</span>
        )}
      </div>
    </TaskCard>
  );
  return (
    <AppShell
      data-page={page}
      data-motion={s.settings.animations === false ? "reduce" : "normal"}
      reduce={s.settings.animations === false}
      className={
        "shell obsidian-app forest-shell forest-shell-b " +
        (collapsed ? "collapsed " : "") +
        ""
      }
      style={{
        fontSize: Number(s.settings.fontSize ?? 14),
        ["--density" as string]:
          s.settings.density === "compact" ? "12px" : "20px",
      }}
    >
      <Sidebar
        s={s}
        command={command}
        page={page}
        go={go}
        collapsed={collapsed}
      />
      <div className="workspace">
        <header>
          <div className="breadcrumb">
            Рабочее пространство <span>/</span> <strong>{pages[page]}</strong>
          </div>
          <div className="row">
            <button className="search" onClick={() => setPalette(true)}>
              <Search size={15} /> Поиск и команды <kbd>Ctrl K</kbd>
            </button>
            <span className="avatar">F</span>
          </div>
        </header>
        {s.diagnostics.workspace === "demo" && (
          <div className="demo-banner">
            <strong>ДИЗАЙН-ПРЕДПРОСМОТР</strong>
            <span>
              Изолированная демонстрационная база · показатели не являются
              вашими данными
            </span>
          </div>
        )}
        <main>
          <PageHeader s={s} page={page} edit={setEditing} />
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")}>Закрыть</button>
            </div>
          )}
          <Suspense fallback={<p role="status">Открываем раздел…</p>}>
            {forestHome && forestConcept && (
              <ForestHome
                s={s}
                command={command}
                go={go}
                edit={setEditing}
                concept={forestConcept}
              />
            )}
            {page === 2 && (
              <Tasks s={s} command={command} edit={setEditing} save={save} />
            )}
            {page === 1 && (
              <Planner
                s={s}
                card={card}
                save={save}
                command={command}
                edit={setEditing}
              />
            )}
            {page === 3 && (
              <Projects
                s={s}
                command={command}
                requestedId={projectSelection}
                card={card}
                edit={(i) => {
                  if (i.kind === "note") {
                    setNoteSelection(i.id);
                    go(8);
                  } else setEditing(i);
                }}
                remove={remove}
              />
            )}
            {page === 4 && <Study s={s} command={command} />}
            {page === 5 && (
              <Fitness
                s={s}
                command={command}
                edit={setEditing}
                remove={remove}
              />
            )}
            {page === 6 && <Analytics s={s} />}
            {page === 7 && <Focus s={s} command={command} />}
            {page === 8 && (
              <Notes
                s={s}
                command={command}
                remove={remove}
                requestedId={noteSelection}
              />
            )}
            {page === 9 && <Preferences s={s} command={command} />}
          </Suspense>
        </main>
        <footer>
          <span className="dot" /> SQLite · Сохранение автоматически{" "}
          <span>FOCUS OS PRO / {__APP_VERSION__}</span>
        </footer>
      </div>
      <Suspense fallback={<p role="status">Открываем редактор…</p>}>
        {editing && isExternalCalendarItem(editing) ? (
          <GoogleCalendarDetails item={editing} onClose={() => setEditing(null)} />
        ) : editing?.kind === "workout" ? (
          <WorkoutForm
            item={editing}
            s={s}
            command={command}
            onClose={() => setEditing(null)}
          />
        ) : (
          editing && (
            <ItemForm
              presentation="sheet"
              item={editing}
              projects={projects}
              state={s}
              command={command}
              onSave={(i, details) => void save(i, details).catch(() => {})}
              onClose={() => setEditing(null)}
            />
          )
        )}{" "}
      </Suspense>
      {palette && (
        <CommandPalette
          s={s}
          command={command}
          go={go}
          edit={(i) => {
            if (i.kind === "project" && s.items.some((x) => x.id === i.id)) {
              setProjectSelection(i.id);
              go(3);
            } else if (i.kind === "note") {
              setNoteSelection(i.id);
              go(8);
            } else setEditing(i);
          }}
          close={() => setPalette(false)}
        />
      )}
      {!s.settings.onboarded && (
        <Modal
          title="Ваше новое пространство"
          onClose={() =>
            void command({ type: "settings", key: "onboarded", value: true })
          }
        >
          <p>
            Начните с пустого пространства или перенесите известные отметки из
            приложенного учебного трекера.
          </p>
          <button
            className="primary"
            onClick={() => void command({ type: "importStudy" })}
          >
            Импортировать учебный прогресс из примера
          </button>
          <button
            onClick={() =>
              void command({ type: "settings", key: "onboarded", value: true })
            }
          >
            Пустое пространство
          </button>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
          {toastRevision !== null && toastRevision === s.revision && (
            <button onClick={() => void command({ type: "undo" })}>
              Отменить
            </button>
          )}
          <button aria-label="Скрыть сообщение" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </AppShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

