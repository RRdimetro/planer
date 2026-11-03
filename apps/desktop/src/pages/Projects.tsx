import { ProjectCard } from "../design/domain";
import { ProjectGantt } from "../features/ProjectGantt";
import { ActivityHistory } from "../design/ActivityHistory";
import { useState, useEffect } from "react";
import {
  FolderKanban,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Flag,
  Paperclip,
  NotebookPen,
  GitBranch,
  Trash2,
  CalendarClock,
  Check,
  Target,
} from "lucide-react";
import type { Item, Milestone } from "../../../../packages/contracts";
import { newItem, addDays, localDate } from "../../../../packages/core";
import { Empty, Modal, Field } from "../shared/ui";
import type { PageProps } from "../shared/model";
function projectStats(s: PageProps["s"], project: Item) {
  const tasks = s.items.filter(
    (t) => t.kind === "task" && t.projectId === project.id,
  );
  const total = tasks.reduce((a, t) => a + t.weight * t.estimate, 0),
    done = tasks
      .filter((t) => t.status === "done")
      .reduce((a, t) => a + t.weight * t.estimate, 0),
    remaining = tasks
      .filter((t) => t.status !== "done")
      .reduce((a, t) => a + t.estimate, 0);
  const facts = s.completions.filter(
    (f) =>
      f.task.projectId === project.id &&
      f.at.slice(0, 10) >= addDays(localDate(), -14),
  );
  const pace = facts.reduce((a, f) => a + f.task.estimate, 0) / 14;
  return {
    tasks,
    total,
    done,
    remaining,
    percent: total ? Math.round((done / total) * 100) : null,
    forecast:
      remaining > 0 && pace > 0 && facts.length >= 3
        ? addDays(localDate(), Math.ceil(remaining / pace))
        : null,
  };
}
export function Projects({
  s,
  command,
  edit,
  remove,
  card,
  requestedId,
}: PageProps & {
  edit: (item: Item) => void;
  remove: (item: Item) => Promise<void>;
  requestedId?: string | null;
  card: (item: Item) => React.ReactNode;
}) {
  const projects = s.items.filter((i) => i.kind === "project");
  const [selected, setSelected] = useState<string | null>(requestedId ?? null);
  useEffect(() => {
    if (requestedId) setSelected(requestedId);
  }, [requestedId]);
  const [tab, setTab] = useState("tasks");
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [query, setQuery] = useState("");
  const active = projects.find((p) => p.id === selected);
  const stat = active ? projectStats(s, active) : null;
  const milestoneForm = milestone && (
    <Modal title="Этап проекта" onClose={() => setMilestone(null)}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await command({ type: "milestone", value: milestone });
          setMilestone(null);
        }}
      >
        <Field label="Название этапа">
          <input
            required
            value={milestone.title}
            onChange={(e) =>
              setMilestone({ ...milestone, title: e.target.value })
            }
          />
        </Field>
        <Field label="Дедлайн этапа">
          <input
            type="date"
            value={milestone.due ?? ""}
            onChange={(e) =>
              setMilestone({ ...milestone, due: e.target.value || null })
            }
          />
        </Field>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={milestone.done}
            onChange={(e) =>
              setMilestone({ ...milestone, done: e.target.checked })
            }
          />
          Этап завершён
        </label>
        <button className="primary">Сохранить этап</button>
      </form>
    </Modal>
  );
  if (active && stat) {
    const stages = s.milestones.filter((m) => m.projectId === active.id);
    const notes = s.items.filter(
      (i) => i.kind === "note" && i.projectId === active.id,
    );
    const files = s.attachments.filter((a) => a.entityId === active.id);
    return (
      <>
        <div className="toolbar">
          <button className="textbutton" onClick={() => setSelected(null)}>
            <ArrowLeft size={15} /> Все проекты
          </button>
          <button onClick={() => edit(active)}>Изменить проект</button>
          <button className="danger" onClick={() => void remove(active)}>
            Архивировать
          </button>
        </div>
        <section className="project-detail-hero">
          <div className="project-symbol">
            <FolderKanban size={32} />
          </div>
          <div className="grow">
            <span className="eyebrow">PROJECT HUB / ОБЗОР ПРОЕКТА</span>
            <h2>{active.title}</h2>
            <p className="muted">
              {active.description ||
                "Добавьте описание, чтобы сохранить цель проекта."}
            </p>
          </div>
          <div
            className="project-ring"
            style={{
              background: `conic-gradient(#73d69a ${(stat.percent ?? 0) * 3.6}deg,#294232 0)`,
            }}
          >
            <span>
              {stat.percent ?? "—"}
              {stat.percent !== null && <small>%</small>}
            </span>
          </div>
        </section>
        <div className="project-stats">
          <div>
            <Target size={17} />
            <strong>
              {stat.tasks.filter((t) => t.status === "done").length} /{" "}
              {stat.tasks.length}
            </strong>
            <small>задач завершено</small>
          </div>
          <div>
            <CalendarClock size={17} />
            <strong>{stat.remaining} мин</strong>
            <small>оценка остатка</small>
          </div>
          <div>
            <Flag size={17} />
            <strong>
              {stages.filter((m) => m.done).length} / {stages.length}
            </strong>
            <small>этапов завершено</small>
          </div>
          <div>
            <CalendarClock size={17} />
            <strong>{stat.forecast ?? "Нет прогноза"}</strong>
            <small>
              {stat.forecast
                ? "Прогноз по темпу последних 14 дней"
                : "Нужно ≥3 завершений за 14 дней"}
            </small>
          </div>
        </div>
        <div className="toolbar">
          <div className="segmented">
            {[
              ["tasks", "Задачи"],
              ["board", "Kanban"],
              ["gantt", "Гантт"],
              ["history", "Активность"],
              ["roadmap", "Дорожная карта"],
              ["knowledge", "Заметки и файлы"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="primary"
            onClick={() =>
              edit({ ...newItem("task", ""), projectId: active.id })
            }
          >
            <Plus size={15} /> Задача проекта
          </button>
        </div>
        {tab === "gantt" && (
          <section>
            <h3>Гантт проекта</h3>
            <ProjectGantt tasks={stat.tasks} s={s} edit={edit} />
          </section>
        )}
        {tab === "history" && (
          <section>
            <h3>Изменения проекта и его задач</h3>
            <ActivityHistory id={active.id} />
          </section>
        )}
        {tab === "board" && (
          <section className="obs-project-board">
            <div className="kanban">
              {(["backlog", "week", "today", "active", "done"] as const).map(
                (status, index) => (
                  <div
                    className="column"
                    key={status}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const item = stat.tasks.find(
                        (t) => t.id === e.dataTransfer.getData("text/plain"),
                      );
                      if (item)
                        void command({
                          type: "save",
                          item: { ...item, status },
                        });
                    }}
                  >
                    <h3>
                      {["Идеи", "План", "Сегодня", "В работе", "Готово"][index]}
                    </h3>
                    {stat.tasks.filter((t) => t.status === status).map(card)}
                  </div>
                ),
              )}
            </div>
          </section>
        )}
        {tab === "tasks" && (
          <div className="project-detail-grid">
            <section>
              <div className="sectionhead">
                <h3>Работа в проекте</h3>
                <small>Прогресс взвешен по оценке × весу</small>
              </div>
              {stat.tasks.map(card)}
              {!stat.tasks.length && (
                <>
                  <Empty>Разбейте проект на конкретные задачи.</Empty>
                  <button
                    onClick={() =>
                      edit({ ...newItem("task", ""), projectId: active.id })
                    }
                  >
                    Добавить первую задачу
                  </button>
                </>
              )}
            </section>
            <section>
              <h3>
                <GitBranch size={16} /> Зависимости задач
              </h3>
              {stat.tasks
                .filter((t) => s.taskDetails[t.id]?.dependencies.length)
                .map((t) => (
                  <div className="dependency-map" key={t.id}>
                    <button className="textbutton" onClick={() => edit(t)}>
                      {t.title}
                    </button>
                    {s.taskDetails[t.id].dependencies.map((id) => (
                      <small key={id}>
                        ↳{" "}
                        {s.items.find((i) => i.id === id)?.title ??
                          "Задача недоступна"}
                      </small>
                    ))}
                  </div>
                ))}
              {!stat.tasks.some(
                (t) => s.taskDetails[t.id]?.dependencies.length,
              ) && (
                <p className="muted">
                  Свяжите задачи в редакторе, чтобы планировщик учитывал порядок
                  выполнения.
                </p>
              )}
              <p className="hint">
                Прогноз использует текущий остаток и среднюю оценённую
                трудоёмкость завершённых задач за 14 дней. Он не является
                обещанием срока.
              </p>
            </section>
          </div>
        )}
        {tab === "roadmap" && (
          <section>
            <div className="sectionhead">
              <h3>Этапы и контрольные точки</h3>
              <button
                onClick={() =>
                  setMilestone({
                    id: crypto.randomUUID(),
                    projectId: active.id,
                    title: "",
                    due: null,
                    done: false,
                  })
                }
              >
                <Plus size={15} /> Добавить этап
              </button>
            </div>
            <div className="roadmap">
              {stages
                .slice()
                .sort((a, b) =>
                  (a.due ?? "9999").localeCompare(b.due ?? "9999"),
                )
                .map((m) => (
                  <div
                    className={"milestone-row " + (m.done ? "done" : "")}
                    key={m.id}
                  >
                    <button
                      className={"check " + (m.done ? "checked" : "")}
                      aria-label={"Завершить этап " + m.title}
                      onClick={() =>
                        void command({
                          type: "milestone",
                          value: { ...m, done: !m.done },
                        })
                      }
                    >
                      {m.done && <Check size={13} />}
                    </button>
                    <button
                      className="textbutton grow"
                      onClick={() => setMilestone(m)}
                    >
                      <strong>{m.title}</strong>
                      <small>{m.due ?? "Без срока"}</small>
                    </button>
                    <span className="badge">
                      {m.done ? "Готово" : "В плане"}
                    </span>
                    <button
                      className="icon"
                      aria-label={"Удалить этап " + m.title}
                      onClick={() => {
                        if (window.confirm("Удалить этап?"))
                          void command({ type: "removeMilestone", id: m.id });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
            {!stages.length && (
              <Empty>
                Создайте этапы проекта с датами и отмечайте достигнутые
                результаты.
              </Empty>
            )}
          </section>
        )}
        {tab === "knowledge" && (
          <div className="project-detail-grid">
            <section>
              <div className="sectionhead">
                <h3>
                  <NotebookPen size={16} /> Заметки проекта
                </h3>
                <button
                  onClick={async () => {
                    const note = {
                      ...newItem("note", "Новая заметка проекта"),
                      projectId: active.id,
                    };
                    await command({ type: "save", item: note });
                    edit(note);
                  }}
                >
                  + Заметка
                </button>
              </div>
              {notes.map((n) => (
                <button
                  className="linked-note"
                  key={n.id}
                  onClick={() => edit(n)}
                >
                  <NotebookPen size={17} />
                  <span>
                    {n.title}
                    <small>
                      {n.description.slice(0, 100) || "Открыть редактор"}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              {!notes.length && (
                <Empty>Сохраните контекст и решения рядом с проектом.</Empty>
              )}
            </section>
            <section>
              <div className="sectionhead">
                <h3>
                  <Paperclip size={16} /> Файлы
                </h3>
                <button
                  onClick={() =>
                    void command({
                      type: "file",
                      action: "attach",
                      id: active.id,
                    })
                  }
                >
                  Прикрепить
                </button>
              </div>
              {files.map((a) => (
                <div className="rule-row" key={a.id}>
                  <button
                    className="textbutton grow"
                    onClick={() =>
                      void command({
                        type: "file",
                        action: "exportAttachment",
                        id: a.id,
                      })
                    }
                  >
                    {a.name}
                    <small>{(a.size / 1024).toFixed(1)} КБ</small>
                  </button>
                  <button
                    className="icon"
                    aria-label={"Удалить файл " + a.name}
                    onClick={() => {
                      if (window.confirm("Удалить вложение?"))
                        void command({ type: "removeAttachment", id: a.id });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {!files.length && (
                <Empty>
                  Прикрепите локальные материалы. Они попадут в резервную копию.
                </Empty>
              )}
            </section>
          </div>
        )}
        {milestoneForm}
      </>
    );
  }
  return (
    <>
      <div className="project-overview-strip">
        <div>
          <span className="eyebrow">ОТ ИДЕИ К РЕЗУЛЬТАТУ</span>
          <h2>
            Большие планы.
            <br />
            <em>Понятные шаги.</em>
          </h2>
          <p>Проекты объединяют задачи, этапы, решения и материалы.</p>
        </div>
        <div className="project-overview-count">
          <strong>{projects.length}</strong>
          <span>проектов в пространстве</span>
        </div>
        <button
          className="primary"
          onClick={() => edit(newItem("project", ""))}
        >
          <Plus size={15} /> Новый проект
        </button>
      </div>
      <div className="toolbar">
        <input
          aria-label="Поиск проектов"
          placeholder="Найти проект…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <small>
          {
            projects.filter((p) =>
              p.title.toLowerCase().includes(query.toLowerCase()),
            ).length
          }{" "}
          проектов
        </small>
      </div>
      <div className="projectgrid premium-projects">
        {projects
          .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
          .map((p, index) => {
            const stats = projectStats(s, p),
              stages = s.milestones.filter((m) => m.projectId === p.id);
            return (
              <ProjectCard
                item={p}
                key={p.id}
                className={"project-tile tone-" + (index % 3)}
              >
                <div className="sectionhead">
                  <div className="project-symbol">
                    <FolderKanban size={22} />
                  </div>
                  <span className="project-category">
                    {p.category || "Личный проект"}
                  </span>
                  <button
                    className="icon"
                    aria-label={"Изменить проект " + p.title}
                    onClick={() => edit(p)}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <button
                  className="project-tile-title textbutton"
                  onClick={() => setSelected(p.id)}
                >
                  {p.title}
                </button>
                <p>
                  {p.description ||
                    "Опишите цель и добавьте первые шаги проекта."}
                </p>
                <div className="project-progress-heading">
                  <span>Взвешенный прогресс</span>
                  <strong>
                    {stats.percent === null ? "—" : stats.percent + "%"}
                  </strong>
                </div>
                <div className="progress">
                  <i style={{ width: (stats.percent ?? 0) + "%" }} />
                </div>
                <div className="project-tile-meta">
                  <span>
                    {stats.tasks.filter((t) => t.status === "done").length}/
                    {stats.tasks.length} задач
                  </span>
                  <span>{stats.remaining} мин осталось</span>
                </div>
                <div className="project-milestone-mini">
                  <Flag size={13} />
                  {stages.length
                    ? `${stages.filter((m) => m.done).length}/${stages.length} этапов`
                    : "Этапы не добавлены"}
                  {p.due && <time>до {p.due.slice(5)}</time>}
                </div>
                <button
                  className="project-open"
                  onClick={() => setSelected(p.id)}
                >
                  Открыть проект <ArrowUpRight size={14} />
                </button>
              </ProjectCard>
            );
          })}
      </div>
      {!projects.length && (
        <section className="project-empty">
          <Empty>
            Создайте проект для важной идеи. Добавьте задачи, контрольные точки
            и материалы — всё останется на вашем компьютере.
          </Empty>
          <button
            className="primary"
            onClick={() => edit(newItem("project", ""))}
          >
            Создать первый проект
          </button>
        </section>
      )}
      {milestoneForm}
    </>
  );
}
