import { flushPending } from "../shared/pending";
import { Projects } from "../pages/Projects";
import { Home } from "../pages/Home";
import { ForestHome } from "../pages/forest-v4/ForestHome";
import { ForestPalette } from "../pages/forest-v4/ForestPalette";
import { Fitness, WorkoutForm } from "../pages/Fitness";
import { Tasks } from "../pages/Tasks";
import { pages } from "../shared/navigation";
import { Planner } from "../pages/Planner";
import { Study } from "../pages/Study";
import { Focus } from "../pages/Focus";
import { Notes } from "../pages/Notes";
import { Analytics } from "../pages/Analytics";
import { Preferences } from "../pages/Preferences";
import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { create } from "zustand";
import {
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  FolderKanban,
  GraduationCap,
  Dumbbell,
  ChartNoAxesCombined,
  Timer,
  NotebookPen,
  Settings,
  Search,
  Plus,
  PanelLeftClose,
  Leaf,
  Check,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import type {
  Command,
  Item,
  TaskDetails,
} from "../../../../packages/contracts";
import { newItem, conflicts } from "../../../../packages/core";
import { ItemForm } from "../features/ItemForm";
import { Modal } from "../shared/ui";
import "../shared/theme.css";
import "../shared/features.css";
import "../shared/premium.css";
const icons = [
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  FolderKanban,
  GraduationCap,
  Dumbbell,
  ChartNoAxesCombined,
  Timer,
  NotebookPen,
  Settings,
];
const useUI = create<{ page: number; go: (page: number) => void }>((set) => ({
  page: 0,
  go: (page) => set({ page }),
}));
const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
function App() {
  const { page, go } = useUI();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["state"],
    queryFn: () => window.focusAPI.state(),
    refetchInterval: 1500,
  });
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [search, setSearch] = useState("");
  const [noteSelection, setNoteSelection] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState("");
  const command = useCallback(
    async (c: Command) => {
      try {
        const s = await window.focusAPI.command(c);
        qc.setQueryData(["state"], s);
        setError("");
        return s;
      } catch (e) {
        setError(String(e));
        throw e;
      }
    },
    [qc],
  );
  useEffect(() => window.focusAPI.onCloseRequested(flushPending), []);
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      e.preventDefault();
      setError(String(e.reason));
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
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
  const s = q.data;
  const tasks = s.items.filter((i) => i.kind === "task");
  const projects = s.items.filter((i) => i.kind === "project");
  const forestConcept =
    s.diagnostics.workspace === "demo" ? s.diagnostics.homeConcept : undefined;
  const forestHome = page === 0 && !!forestConcept;
  const collapsed =
    s.settings.collapsed === undefined && forestHome && forestConcept === "B"
      ? true
      : !!s.settings.collapsed;
  const save = async (i: Item, details?: TaskDetails) => {
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
    setToast("Сохранено в SQLite");
    setTimeout(() => setToast(""), 2400);
  };
  const remove = async (i: Item) => {
    if (
      window.confirm(
        i.kind === "project"
          ? "Архивировать проект? Задачи сохранятся."
          : `Удалить «${i.title}»?`,
      )
    )
      await command({ type: "remove", id: i.id });
  };
  const card = (i: Item) => (
    <article
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
    </article>
  );
  return (
    <div
      className={
        "shell " +
        (collapsed ? "collapsed " : "") +
        (forestHome
          ? `forest-shell forest-shell-${forestConcept!.toLowerCase()}`
          : "")
      }
      style={{
        fontSize: Number(s.settings.fontSize ?? 14),
        ["--density" as string]:
          s.settings.density === "compact" ? "12px" : "20px",
      }}
    >
      <aside>
        <div className="brand">
          <Leaf size={27} />
          {!collapsed && (
            <span>
              FOCUS OS <b>PRO</b>
            </span>
          )}
        </div>
        <div className="navlabel">ВАШЕ ПРОСТРАНСТВО</div>
        <nav>
          {pages.map((p, i) => {
            const Icon = icons[i];
            return (
              <button
                key={p}
                className={page === i ? "selected" : ""}
                title={p}
                aria-label={p}
                onClick={() => go(i)}
              >
                <Icon size={19} />
                {!collapsed && <span>{p}</span>}
                {i === 2 && !collapsed && (
                  <small>
                    {tasks.filter((t) => t.status !== "done").length}
                  </small>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebarfoot">
          <span className="dot" />
          {!collapsed &&
            (s.diagnostics.workspace === "demo"
              ? "Демо · отдельная база"
              : "Локально · без облака")}
          <button
            className="icon"
            aria-label="Свернуть навигацию"
            onClick={() =>
              void command({
                type: "settings",
                key: "collapsed",
                value: !collapsed,
              })
            }
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
      </aside>
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
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="pageheading"
          >
            <div>
              <div className="eyebrow">
                FOCUS OS / {String(page + 1).padStart(2, "0")}
              </div>
              <h1>{pages[page]}</h1>
              <p className="muted">
                {
                  [
                    "Ясность в планах. Пространство для главного.",
                    "Время под вашим контролем.",
                    "От намерения — к результату.",
                    "Большие идеи, понятные шаги.",
                    "Каждая отметка — шаг вперёд.",
                    "Движение в своём ритме.",
                    "Только ваши данные. Честная картина.",
                    "Одна задача. Полное внимание.",
                    "Мысли, к которым хочется вернуться.",
                    "Ваше пространство, ваши правила.",
                  ][page]
                }
              </p>
            </div>
            <div className="row">
              <span className="date">
                {new Date().toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  weekday: "short",
                  timeZone: String(
                    s.settings.timezone ??
                      Intl.DateTimeFormat().resolvedOptions().timeZone,
                  ),
                })}
              </span>
              <button
                className="primary"
                onClick={() =>
                  setEditing(
                    newItem(
                      page === 3 ? "project" : page === 5 ? "workout" : "task",
                      "",
                    ),
                  )
                }
              >
                <Plus size={16} /> Добавить
              </button>
            </div>
          </motion.div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")}>Закрыть</button>
            </div>
          )}
          {page === 0 && !forestHome && (
            <Home
              s={s}
              command={command}
              go={go}
              edit={setEditing}
              save={save}
            />
          )}
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
        </main>
        <footer>
          <span className="dot" /> SQLite · Сохранение автоматически{" "}
          <span>FOCUS OS PRO / 0.2.0</span>
        </footer>
      </div>
      {editing?.kind === "workout" ? (
        <WorkoutForm
          item={editing}
          s={s}
          command={command}
          onClose={() => setEditing(null)}
        />
      ) : (
        editing && (
          <ItemForm
            presentation={forestHome ? "sheet" : undefined}
            item={editing}
            projects={projects}
            state={s}
            command={command}
            onSave={(i, details) => void save(i, details).catch(() => {})}
            onClose={() => setEditing(null)}
          />
        )
      )}{" "}
      {palette && forestHome && (
        <ForestPalette
          s={s}
          command={command}
          go={go}
          edit={setEditing}
          close={() => setPalette(false)}
        />
      )}
      {palette && !forestHome && (
        <Modal title="Поиск и команды" onClose={() => setPalette(false)}>
          <input
            autoFocus
            placeholder="Раздел, задача, заметка…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="commandlist">
            {pages
              .filter((p) => p.toLowerCase().includes(search.toLowerCase()))
              .map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    go(pages.indexOf(p));
                    setPalette(false);
                    setSearch("");
                  }}
                >
                  {p} ↗
                </button>
              ))}
            {s.items
              .filter((i) =>
                i.title.toLowerCase().includes(search.toLowerCase()),
              )
              .slice(0, 25)
              .map((i) => (
                <button
                  key={i.id}
                  onClick={() => {
                    setEditing(i);
                    setPalette(false);
                  }}
                >
                  {i.title}
                </button>
              ))}
          </div>
        </Modal>
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
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
