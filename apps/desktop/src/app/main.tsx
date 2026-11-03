import { AppShell } from "../design/components";
import { Sidebar } from "../design/Sidebar";
import { PageHeader } from "../design/PageHeader";
import "../design/obsidian.css";
import { flushPending } from "../shared/pending";
import { Projects } from "../pages/Projects";

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
import { Search, Check, Trash2 } from "lucide-react";
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
  const [projectSelection, setProjectSelection] = useState<string | null>(null);
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
  const projects = s.items.filter((i) => i.kind === "project");
  const forestConcept = "B" as const;
  const forestHome = page === 0;
  const collapsed =
    s.settings.collapsed === undefined ? true : !!s.settings.collapsed;
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
    <AppShell
      data-page={page}
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
      {palette && (
        <ForestPalette
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
