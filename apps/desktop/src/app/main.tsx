import { Fitness, WorkoutForm } from "../pages/Fitness";
import { Tasks } from "../pages/Tasks";
import { pages } from "../shared/navigation";
import { Planner } from "../pages/Planner";
import { Study } from "../pages/Study";
import { Focus } from "../pages/Focus";
import { Notes } from "../pages/Notes";
import { Analytics } from "../pages/Analytics";
import { Preferences } from "../pages/Preferences";
import React, { useState, useEffect } from "react";
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
  ArrowUpRight,
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
import { newItem, localDate, conflicts } from "../../../../packages/core";
import { metrics } from "../../../../packages/analytics";
import { ItemForm } from "../features/ItemForm";
import { Empty, Modal } from "../shared/ui";
import "../shared/theme.css";
import "../shared/features.css";
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
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState("");
  async function command(c: Command) {
    try {
      const s = await window.focusAPI.command(c);
      qc.setQueryData(["state"], s);
      setError("");
      return s;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }
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
  const today = localDate();
  const m = metrics(s);
  const collapsed = !!s.settings.collapsed;
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
      className={"shell " + (collapsed ? "collapsed" : "")}
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
          {!collapsed && "Локально · без облака"}
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
          {page === 0 && (
            <>
              <div className="hero">
                <div>
                  <span className="eyebrow">ВАШ ЛИЧНЫЙ COMMAND CENTER</span>
                  <h2>Сосредоточьтесь на важном.</h2>
                  <p>Соберите день из осмысленных шагов.</p>
                </div>
                <div className="forest">
                  <span>△</span>
                  <span>△</span>
                  <span>△</span>
                </div>
              </div>
              <div className="kpis">
                {[
                  [
                    "Задачи сегодня",
                    `${tasks.filter((t) => t.date === today && t.status === "done").length} / ${tasks.filter((t) => t.date === today).length}`,
                    2,
                  ],
                  [
                    "Исходный план",
                    m.components[0] === null
                      ? "Нет снимка"
                      : Math.round(m.components[0] * 100) + "%",
                    6,
                  ],
                  [
                    "Фокус сегодня",
                    `${metrics(s, today, today).focusMinutes} мин`,
                    7,
                  ],
                  [
                    "Эффективность",
                    m.score === null ? "Нет данных" : m.score + " / 100",
                    6,
                  ],
                ].map(([title, value, target]) => (
                  <button
                    key={title}
                    className="kpi"
                    onClick={() => go(Number(target))}
                  >
                    <span>
                      {title}
                      <ArrowUpRight size={16} />
                    </span>
                    <strong>{value}</strong>
                    <small>На основе сохранённых данных</small>
                  </button>
                ))}
              </div>
              <div
                className="dashboard"
                style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}
              >
                {(
                  (s.settings.dashboard as string[] | undefined) ?? [
                    "Сегодня",
                    "Расписание",
                    "Активные проекты",
                    "Учебный прогресс",
                  ]
                ).map((name, index) => (
                  <section
                    key={name}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("widget", String(index))
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      if (!e.dataTransfer.types.includes("widget")) return;
                      const from = Number(e.dataTransfer.getData("widget"));
                      const layout = [
                        ...((s.settings.dashboard as string[]) ?? [
                          "Сегодня",
                          "Расписание",
                          "Активные проекты",
                          "Учебный прогресс",
                        ]),
                      ];
                      [layout[index], layout[from]] = [
                        layout[from],
                        layout[index],
                      ];
                      void command({
                        type: "settings",
                        key: "dashboard",
                        value: layout,
                      });
                    }}
                    style={{
                      height: (
                        s.settings.widgetSizes as
                          Record<string, number> | undefined
                      )?.[name],
                    }}
                    onMouseUp={(e) => {
                      const height = Math.min(
                        1000,
                        Math.max(230, e.currentTarget.clientHeight),
                      );
                      const sizes =
                        (s.settings.widgetSizes as
                          Record<string, number> | undefined) ?? {};
                      if (sizes[name] !== height)
                        void command({
                          type: "settings",
                          key: "widgetSizes",
                          value: { ...sizes, [name]: height },
                        });
                    }}
                    className="widget"
                  >
                    <div className="sectionhead">
                      <h3>{name}</h3>
                      <button
                        className="icon"
                        aria-label={"Переместить виджет " + name}
                        onClick={() => {
                          const layout = [
                            ...((s.settings.dashboard as string[]) ?? [
                              "Сегодня",
                              "Расписание",
                              "Активные проекты",
                              "Учебный прогресс",
                            ]),
                          ];
                          const target = (index + 1) % layout.length;
                          [layout[index], layout[target]] = [
                            layout[target],
                            layout[index],
                          ];
                          void command({
                            type: "settings",
                            key: "dashboard",
                            value: layout,
                          });
                        }}
                      >
                        ↕
                      </button>
                      <button
                        className="textbutton"
                        onClick={() =>
                          go(
                            name === "Сегодня"
                              ? 2
                              : name === "Расписание"
                                ? 1
                                : name === "Активные проекты"
                                  ? 3
                                  : 4,
                          )
                        }
                      >
                        Открыть ↗
                      </button>
                    </div>
                    {name === "Сегодня" ? (
                      tasks.filter((t) => t.date === today).length ? (
                        tasks.filter((t) => t.date === today).map(card)
                      ) : (
                        <Empty>На сегодня пока нет задач</Empty>
                      )
                    ) : name === "Расписание" ? (
                      s.items.filter((t) => t.date === today && t.time)
                        .length ? (
                        s.items
                          .filter((t) => t.date === today && t.time)
                          .sort((a, b) => a.time!.localeCompare(b.time!))
                          .map((t) => (
                            <div className="scheduleline" key={t.id}>
                              <time>{t.time}</time>
                              <button
                                className="textbutton"
                                onClick={() => setEditing(t)}
                              >
                                {t.title}
                              </button>
                              <small>{t.estimate} мин</small>
                            </div>
                          ))
                      ) : (
                        <Empty>День открыт для ваших планов</Empty>
                      )
                    ) : name === "Активные проекты" ? (
                      projects.length ? (
                        projects.slice(0, 4).map((p) => (
                          <div className="scheduleline" key={p.id}>
                            <FolderKanban size={18} />
                            <button
                              className="textbutton"
                              onClick={() => setEditing(p)}
                            >
                              {p.title}
                            </button>
                          </div>
                        ))
                      ) : (
                        <Empty>Добавьте первый проект</Empty>
                      )
                    ) : s.subjects.length ? (
                      <>
                        <div className="bigstat">
                          {s.subjects.reduce(
                            (a, x) => a + x.rkDone + x.hwDone,
                            0,
                          )}
                          <small> агрегированных РК и ДЗ сдано</small>
                        </div>
                        <p className="muted">
                          {s.subjects.length} предметов · подробные этапы
                          учитываются отдельно
                        </p>
                      </>
                    ) : (
                      <Empty>Импортируйте прогресс в разделе «Учёба»</Empty>
                    )}
                  </section>
                ))}
              </div>
            </>
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
            <div className="projectgrid">
              {projects.map((p) => {
                const ts = tasks.filter((t) => t.projectId === p.id);
                const total = ts.reduce((a, t) => a + t.weight * t.estimate, 0);
                const completed = ts
                  .filter((t) => t.status === "done")
                  .reduce((a, t) => a + t.weight * t.estimate, 0);
                return (
                  <section key={p.id}>
                    <div className="sectionhead">
                      <FolderKanban color="#73d69a" />
                      <button
                        className="icon"
                        aria-label="Архивировать проект"
                        onClick={() => void remove(p)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <h2>
                      <button
                        className="textbutton"
                        onClick={() => setEditing(p)}
                      >
                        {p.title}
                      </button>
                    </h2>
                    <p className="muted">
                      {p.description || "Добавьте описание проекта"}
                    </p>
                    <div className="progress">
                      <i
                        style={{
                          width: (total ? (completed / total) * 100 : 0) + "%",
                        }}
                      />
                    </div>
                    <div className="row between">
                      <span>
                        {total
                          ? Math.round((completed / total) * 100) + "%"
                          : "Нет оценённых задач"}
                      </span>
                      <small>
                        {ts.filter((t) => t.status === "done").length} /{" "}
                        {ts.length} задач
                      </small>
                    </div>
                    <p className="muted">
                      Осталось{" "}
                      {ts
                        .filter((t) => t.status !== "done")
                        .reduce((a, t) => a + t.estimate, 0)}{" "}
                      мин · прогноз требует истории
                    </p>
                    {ts.map(card)}
                    <button
                      onClick={() =>
                        setEditing({ ...newItem("task", ""), projectId: p.id })
                      }
                    >
                      + Задача проекта
                    </button>
                  </section>
                );
              })}
              {!projects.length && (
                <Empty>Создайте проект, чтобы объединить задачи</Empty>
              )}
            </div>
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
          {page === 8 && <Notes s={s} command={command} remove={remove} />}
          {page === 9 && <Preferences s={s} command={command} />}
        </main>
        <footer>
          <span className="dot" /> SQLite · Сохранение автоматически{" "}
          <span>FOCUS OS PRO / 0.1.0</span>
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
