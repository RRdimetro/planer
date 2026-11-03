import { TaskCard } from "../design/domain";
import { VirtualList } from "../design/components";
import { DataTable } from "../design/components";
import { WeeklyTasks } from "../features/WeeklyTasks";
import { useEffect, useState } from "react";
import {
  Check,
  Plus,
  Trash2,
  Paperclip,
  Repeat2,
  GitBranch,
  Search,
  ListChecks,
  GripVertical,
} from "lucide-react";
import type { Item, Command } from "../../../../packages/contracts";
import { emptyTaskDetails } from "../../../../packages/contracts";
import {
  newItem,
  localDate,
  weekDays,
  addDays,
} from "../../../../packages/core";
import type { PageProps } from "../shared/model";
import { Empty } from "../shared/ui";
const labels = {
  backlog: "Backlog",
  week: "На неделе",
  today: "Сегодня",
  active: "В процессе",
  done: "Готово",
};
const initial = {
  query: "",
  category: "",
  status: "",
  priority: 0,
  from: "",
  to: "",
  due: "",
};
export function Tasks({
  s,
  command,
  edit,
  save,
}: PageProps & { edit: (i: Item) => void; save: (i: Item) => Promise<void> }) {
  const [filters, setFilters] = useState({
    ...initial,
    ...(s.settings.taskAdvancedFilter as Partial<typeof initial>),
  });
  const [selection, setSelection] = useState<string[]>([]);
  const [bulkDate, setBulkDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const tasks = s.items.filter((i) => i.kind === "task");
  const projects = s.items.filter((i) => i.kind === "project");
  useEffect(() => {
    if (
      JSON.stringify(filters) ===
      JSON.stringify(s.settings.taskAdvancedFilter ?? initial)
    )
      return;
    const timer = setTimeout(
      () =>
        void command({
          type: "settings",
          key: "taskAdvancedFilter",
          value: filters,
        }),
      500,
    );
    return () => clearTimeout(timer);
  }, [filters, s.settings.taskAdvancedFilter, command]);
  const filtered = tasks.filter(
    (t) =>
      [t.title, t.description, t.tags]
        .join(" ")
        .toLowerCase()
        .includes(filters.query.toLowerCase()) &&
      (!filters.category || t.category === filters.category) &&
      (!filters.status || t.status === filters.status) &&
      (!filters.priority || t.priority === filters.priority) &&
      (!filters.from || (!!t.date && t.date >= filters.from)) &&
      (!filters.to || (!!t.date && t.date <= filters.to)) &&
      (!filters.due || (!!t.due && t.due <= filters.due)) &&
      (!s.settings.taskFilter || t.projectId === s.settings.taskFilter),
  );
  const selected = selection.filter((id) => tasks.some((t) => t.id === id));
  const view = String(s.settings.taskView ?? "kanban");
  const bulk = async (
    patch: Extract<Command, { type: "bulkTasks" }>["patch"],
  ) => {
    await command({ type: "bulkTasks", ids: selected, patch });
    setSelection([]);
  };
  const createChild = async (parent: Item) => {
    const item = {
      ...newItem("task", "Новая подзадача"),
      projectId: parent.projectId,
    };
    await command({
      type: "saveTask",
      item,
      details: { ...emptyTaskDetails(), parentId: parent.id },
    });
    edit(item);
  };
  const row = (t: Item, depth = 0) => {
    const d = s.taskDetails[t.id] ?? emptyTaskDetails();
    const children = tasks.filter(
      (x) => s.taskDetails[x.id]?.parentId === t.id,
    );
    const checked = d.checklist.filter((x) => x.done).length;
    return (
      <TaskCard
        item={t}
        key={t.id}
        className={
          "taskcard taskcard-pro " + (t.status === "done" ? "task-done" : "")
        }
        style={{ marginLeft: view === "list" ? Math.min(depth, 8) * 20 : 0 }}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
      >
        <div className="row">
          <span
            className="obs-drag-handle"
            role="button"
            tabIndex={0}
            draggable
            aria-label={"Переместить " + t.title}
            title="Перетащите или используйте стрелки ← / →"
            onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
            onKeyDown={(e) => {
              if (t.date && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                void save({
                  ...t,
                  date: addDays(t.date, e.key === "ArrowRight" ? 1 : -1),
                });
              }
            }}
          >
            <GripVertical size={14} />
          </span>
          <input
            type="checkbox"
            aria-label={"Выбрать " + t.title}
            checked={selected.includes(t.id)}
            onChange={(e) =>
              setSelection(
                e.target.checked
                  ? [...selected, t.id]
                  : selected.filter((id) => id !== t.id),
              )
            }
          />
          <button
            className={"check " + (t.status === "done" ? "checked" : "")}
            aria-label={"Завершить " + t.title}
            onClick={() =>
              void save({
                ...t,
                status: t.status === "done" ? "today" : "done",
              })
            }
          >
            {t.status === "done" && <Check size={13} />}
          </button>
          <button className="textbutton grow" onClick={() => edit(t)}>
            {t.title}
          </button>
          <button
            className="icon"
            title="Подзадача"
            aria-label={"Подзадача для " + t.title}
            onClick={() => void createChild(t)}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="meta">
          <span className={"priority p" + t.priority}>P{t.priority}</span>
          <span>{t.estimate} мин</span>
          {t.date && (
            <span
              className={
                t.due && t.due < localDate() && t.status !== "done"
                  ? "overdue"
                  : ""
              }
            >
              {t.date.slice(5)}
            </span>
          )}
          {t.projectId && (
            <span>{projects.find((p) => p.id === t.projectId)?.title}</span>
          )}
          {d.parentId && (
            <span>
              <GitBranch size={11} />{" "}
              {tasks.find((p) => p.id === d.parentId)?.title}
            </span>
          )}
          {d.recurrence && (
            <span>
              <Repeat2 size={11} /> Повтор
            </span>
          )}
          {d.dependencies.length > 0 && (
            <span>↳ {d.dependencies.length} завис.</span>
          )}
          {children.length > 0 && (
            <span>
              {children.filter((c) => c.status === "done").length}/
              {children.length} подзадач
            </span>
          )}
          {d.checklist.length > 0 && (
            <span>
              <ListChecks size={11} /> {checked}/{d.checklist.length}
            </span>
          )}
          {s.attachments.some((a) => a.entityId === t.id) && (
            <span>
              <Paperclip size={11} />
              {s.attachments.filter((a) => a.entityId === t.id).length}
            </span>
          )}
        </div>
        {view === "list" &&
          d.checklist.map((c) => (
            <label className="inline-check" key={c.id}>
              <input
                type="checkbox"
                checked={c.done}
                onChange={(e) =>
                  void command({
                    type: "saveTask",
                    item: t,
                    details: {
                      ...d,
                      checklist: d.checklist.map((x) =>
                        x.id === c.id ? { ...x, done: e.target.checked } : x,
                      ),
                    },
                  })
                }
              />
              {c.title}
            </label>
          ))}
      </TaskCard>
    );
  };
  function tree(t: Item, depth = 0): React.ReactNode {
    return (
      <div key={t.id}>
        {row(t, depth)}
        {filtered
          .filter((c) => s.taskDetails[c.id]?.parentId === t.id)
          .map((c) => tree(c, depth + 1))}
      </div>
    );
  }
  return (
    <>
      <div className="page-strip">
        <div>
          <span className="eyebrow">ЗАДАЧИ / ОБЗОР</span>
          <strong>
            {tasks.filter((t) => t.status !== "done").length}
            <small> активных задач</small>
          </strong>
        </div>
        <div>
          <strong>{tasks.filter((t) => t.status === "done").length}</strong>
          <small>завершено</small>
        </div>
        <div>
          <strong>
            {
              tasks.filter(
                (t) => t.due && t.due < localDate() && t.status !== "done",
              ).length
            }
          </strong>
          <small>требуют внимания</small>
        </div>
        <button className="primary" onClick={() => edit(newItem("task", ""))}>
          <Plus size={16} /> Новая задача
        </button>
      </div>
      <div className="toolbar">
        <div className="input-icon">
          <Search size={15} />
          <input
            placeholder="Поиск задач, тегов, описаний…"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          />
        </div>
        <select
          aria-label="Вид задач"
          value={view}
          onChange={(e) =>
            void command({
              type: "settings",
              key: "taskView",
              value: e.target.value,
            })
          }
        >
          <option value="kanban">Канбан</option>
          <option value="table">Таблица</option>
          <option value="week">Недельный список</option>
          <option value="list">Иерархический список</option>
        </select>
        <select
          aria-label="Фильтр проекта"
          value={String(s.settings.taskFilter ?? "")}
          onChange={(e) =>
            void command({
              type: "settings",
              key: "taskFilter",
              value: e.target.value,
            })
          }
        >
          <option value="">Все проекты</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <button onClick={() => setShowFilters(!showFilters)}>
          Фильтры {Object.values(filters).some((x) => !!x) ? "●" : ""}
        </button>
        <button onClick={() => void command({ type: "undo" })}>
          ↶ Отменить
        </button>
      </div>
      {showFilters && (
        <section className="filter-panel">
          <label>
            Статус
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">Все</option>
              {Object.entries(labels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Приоритет
            <select
              value={filters.priority}
              onChange={(e) =>
                setFilters({ ...filters, priority: Number(e.target.value) })
              }
            >
              <option value="0">Все</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  P{n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Категория
            <select
              value={filters.category}
              onChange={(e) =>
                setFilters({ ...filters, category: e.target.value })
              }
            >
              <option value="">Все</option>
              {Array.from(
                new Set(tasks.map((t) => t.category).filter(Boolean)),
              ).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            С даты
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </label>
          <label>
            По дату
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </label>
          <label>
            Дедлайн до
            <input
              type="date"
              value={filters.due}
              onChange={(e) => setFilters({ ...filters, due: e.target.value })}
            />
          </label>
          <button onClick={() => setFilters(initial)}>Сбросить</button>
        </section>
      )}
      <div className="selection-bar">
        <label className="inline-check">
          <input
            type="checkbox"
            aria-label="Выбрать все задачи"
            checked={
              !!filtered.length &&
              filtered.every((t) => selected.includes(t.id))
            }
            onChange={(e) =>
              setSelection(e.target.checked ? filtered.map((t) => t.id) : [])
            }
          />{" "}
          {selected.length
            ? `Выбрано ${selected.length}`
            : `Найдено ${filtered.length}`}
        </label>
        {selected.length > 0 && (
          <>
            <button onClick={() => void bulk({ status: "done" })}>
              Завершить
            </button>
            <button
              onClick={() =>
                void bulk({ status: "week", weeklyWeek: weekDays()[0] })
              }
            >
              На неделю
            </button>
            <select
              aria-label="Массовый приоритет"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value)
                  void bulk({ priority: Number(e.target.value) });
              }}
            >
              <option value="">Приоритет…</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  P{n}
                </option>
              ))}
            </select>
            <input
              aria-label="Массовая дата"
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
            />
            <button
              disabled={!bulkDate}
              onClick={() => void bulk({ date: bulkDate })}
            >
              Назначить
            </button>
            <button
              className="danger"
              onClick={() => {
                if (
                  window.confirm(
                    `Удалить выбранные задачи (${selected.length})?`,
                  )
                )
                  void bulk({ deleted: true });
              }}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      {!tasks.length ? (
        <section>
          <Empty>
            Соберите первый рабочий список: добавьте задачу, оцените время и
            выберите день.
          </Empty>
          <button className="primary" onClick={() => edit(newItem("task", ""))}>
            Создать первую задачу
          </button>
        </section>
      ) : view === "kanban" ? (
        <div className="kanban">
          {Object.entries(labels).map(([status, label]) => (
            <div
              className="column"
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const task = tasks.find(
                  (t) => t.id === e.dataTransfer.getData("text/plain"),
                );
                if (task)
                  void save({ ...task, status: status as Item["status"] });
              }}
            >
              <h3>
                <span className={"status-dot " + status} />
                {label}
                <small>
                  {filtered.filter((t) => t.status === status).length}
                </small>
              </h3>
              <VirtualList
                rows={filtered.filter((t) => t.status === status)}
                rowKey={(t) => t.id}
                render={(t) => row(t)}
              />
              <button
                className="addcolumn"
                onClick={() =>
                  edit({
                    ...newItem("task", ""),
                    status: status as Item["status"],
                  })
                }
              >
                + Добавить задачу
              </button>
            </div>
          ))}
        </div>
      ) : view === "week" ? (
        <WeeklyTasks s={s} command={command} edit={edit} row={row} />
      ) : view === "list" ? (
        <section>
          {filtered
            .filter(
              (t) =>
                !s.taskDetails[t.id]?.parentId ||
                !filtered.some((p) => p.id === s.taskDetails[t.id]?.parentId),
            )
            .map((t) => tree(t))}
          {!filtered.length && <Empty>Нет задач с такими фильтрами</Empty>}
        </section>
      ) : (
        <section className="tablewrap">
          <DataTable
            rows={filtered}
            rowKey={(t) => t.id}
            columns={[
              {
                title: "Выбор",
                render: (t) => (
                  <input
                    type="checkbox"
                    aria-label={"Выбрать " + t.title}
                    checked={selected.includes(t.id)}
                    onChange={(e) =>
                      setSelection(
                        e.target.checked
                          ? [...selected, t.id]
                          : selected.filter((id) => id !== t.id),
                      )
                    }
                  />
                ),
              },
              {
                title: "Задача",
                render: (t) => (
                  <button className="textbutton" onClick={() => edit(t)}>
                    {t.title}
                  </button>
                ),
              },
              {
                title: "Статус / P",
                render: (t) => `${labels[t.status]} · P${t.priority}`,
              },
              {
                title: "Проект / категория",
                render: (t) =>
                  `${projects.find((p) => p.id === t.projectId)?.title ?? "—"} / ${t.category || "—"}`,
              },
              {
                title: "Дата / срок",
                render: (t) => (
                  <>
                    {t.date ?? "—"}
                    <br />
                    {t.due ?? "—"}
                  </>
                ),
              },
              {
                title: "План / факт, мин",
                render: (t) =>
                  `${t.estimate} / ${Math.round(s.sessions.filter((x) => x.taskId === t.id && x.kind !== "break").reduce((a, x) => a + x.seconds / 60, 0))}`,
              },
            ]}
          />
        </section>
      )}
    </>
  );
}
