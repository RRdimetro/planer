import React, { useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  LockKeyhole,
  Sparkles,
  GripHorizontal,
  Trash2,
} from "lucide-react";
import type { Item, PlanningConstraint } from "../../../../packages/contracts";
import {
  dateInZone,
  weekDays,
  addDays,
  newItem,
  distribute,
  minutes,
  timeLabel,
  availableMinutes,
  interval,
  type PlannerOptions,
} from "../../../../packages/core";
import { Empty, Modal, Field } from "../shared/ui";
import type { PageProps } from "../shared/model";
const types: Record<string, string> = {
  university: "Пара",
  commute: "Дорога",
  workout: "Тренировка",
  personal: "Личное",
  focus: "Фокус",
  "personal event": "Личное",
};
export function Planner({
  s,
  card,
  save,
  command,
  edit,
}: PageProps & {
  card: (i: Item) => React.ReactNode;
  save: (i: Item) => Promise<void>;
  edit: (i: Item) => void;
}) {
  const zone = String(
    s.settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const today = dateInZone(zone);
  const [date, setDate] = useState(today);
  const [view, setView] = useState("week");
  const [rules, setRules] = useState(false);
  const [constraint, setConstraint] = useState<PlanningConstraint | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof distribute> | null>(
    null,
  );
  const [previewRevision, setPreviewRevision] = useState(s.revision);
  const [resizeSize, setResizeSize] = useState<{
    id: string;
    value: number;
  } | null>(null);
  const resize = useRef<{ item: Item; y: number } | null>(null);
  const skipClick = useRef(false);
  const week = weekDays(date);
  const tasks = s.items.filter((t) => t.kind === "task");
  const occupied = s.items.filter((t) =>
    ["task", "event", "workout"].includes(t.kind),
  );
  const options: PlannerOptions = {
    workDays: (s.settings.workDays as number[]) ?? [1, 2, 3, 4, 5],
    lectureWork: !!s.settings.lectureWork,
    afterWorkoutMinutes: Number(s.settings.afterWorkoutMinutes ?? 0),
    complexPriority: Number(s.settings.complexPriority ?? 3),
    constraints: s.constraints,
    taskDetails: s.taskDetails,
    allTasks: tasks,
  };
  const start = Number(s.settings.workStart ?? 9),
    end = Number(s.settings.workEnd ?? 18),
    capacity = Number(s.settings.dailyCapacity ?? 360);
  const days = view === "day" ? [date] : week;
  const monthFirst = date.slice(0, 8) + "01";
  const monthStart = weekDays(monthFirst)[0];
  const monthDays = Array.from({ length: 42 }, (_, i) =>
    addDays(monthStart, i),
  );
  const snapshot = s.items.find(
    (i) => i.kind === "snapshot" && i.date === week[0],
  );
  const weekly = tasks.filter(
    (t) =>
      !t.date &&
      t.status !== "done" &&
      (s.taskDetails[t.id]?.weeklyWeek === week[0] ||
        (!s.taskDetails[t.id]?.weeklyWeek && t.status === "week")),
  );
  const backlog = tasks.filter(
    (t) => !t.date && t.status !== "done" && !weekly.some((w) => w.id === t.id),
  );
  const dayItems = (day: string) =>
    occupied
      .filter((i) => {
        const a = interval(i);
        if (!a) return i.date === day;
        const base = Date.parse(day + "T00:00:00Z") / 60000;
        return a.start < base + 1440 && a.end > base;
      })
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const shift = (delta: number) => {
    if (view === "month") {
      const d = new Date(monthFirst + "T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + delta);
      setDate(d.toISOString().slice(0, 10));
    } else setDate(addDays(date, delta * (view === "week" ? 7 : 1)));
  };
  const drop = (e: React.DragEvent, day: string, time?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const item = occupied.find(
      (i) => i.id === e.dataTransfer.getData("text/plain"),
    );
    if (item)
      void save({
        ...item,
        date: day,
        time: time ?? item.time ?? "09:00",
        status:
          item.kind === "task" && item.status !== "done"
            ? "today"
            : item.status,
      });
  };
  const newEvent = (day: string, time = "09:00") =>
    edit({
      ...newItem("event", ""),
      date: day,
      time,
      category: "personal",
      estimate: 60,
    });
  const slots = Array.from({ length: 72 }, (_, i) => 360 + i * 15);
  const duration = (i: Item) =>
    resizeSize?.id === i.id ? resizeSize.value : i.estimate;
  const currentMinutes = () => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    return (
      Number(parts.find((p) => p.type === "hour")?.value) * 60 +
      Number(parts.find((p) => p.type === "minute")?.value)
    );
  };
  return (
    <>
      <div className="planner-command">
        <div className="row">
          <div className="calendar-mark">
            <CalendarDays size={24} />
          </div>
          <div>
            <h2>
              {new Date(date + "T12:00:00Z").toLocaleDateString("ru-RU", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </h2>
            <span className="muted">
              Неделя {week[0].slice(5)} — {week[6].slice(5)} · {zone}
            </span>
          </div>
        </div>
        <div className="row">
          <button
            className="icon"
            aria-label="Предыдущий период"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={19} />
          </button>
          <button onClick={() => setDate(today)}>Сегодня</button>
          <button
            className="icon"
            aria-label="Следующий период"
            onClick={() => shift(1)}
          >
            <ChevronRight size={19} />
          </button>
          <input
            aria-label="Дата календаря"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="segmented">
          {[
            ["day", "День"],
            ["week", "Неделя"],
            ["month", "Месяц"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={view === value ? "active" : ""}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar">
        <button className="primary" onClick={() => newEvent(date)}>
          <Plus size={15} /> Событие
        </button>
        <button onClick={() => setRules(!rules)}>
          <SlidersHorizontal size={15} /> Правила времени
        </button>
        <button
          disabled={!!snapshot}
          onClick={() => void command({ type: "snapshot", week: week[0] })}
        >
          <LockKeyhole size={15} />
          {snapshot ? "Исходный план заморожен" : "Зафиксировать план недели"}
        </button>
        <button
          onClick={() => {
            setPreviewRevision(s.revision);
            setPreview(
              distribute(
                [...weekly, ...backlog],
                occupied,
                week,
                start,
                end,
                capacity,
                options,
              ),
            );
          }}
        >
          <Sparkles size={15} /> Предложить расписание
        </button>
        <button
          className="textbutton"
          onClick={() => void command({ type: "undo" })}
        >
          ↶ Отменить
        </button>
      </div>
      {rules && (
        <section className="planning-rules">
          <div className="sectionhead">
            <h3>Рабочая ёмкость и ограничения</h3>
            <button
              onClick={() =>
                setConstraint({
                  id: crypto.randomUUID(),
                  label: "",
                  date,
                  weekday: null,
                  start: 540,
                  end: 600,
                  kind: "blocked",
                })
              }
            >
              + Ограничение
            </button>
          </div>
          <div className="filter-panel">
            <label>
              Начало
              <input
                aria-label="Рабочий день с"
                type="time"
                value={timeLabel(start * 60)}
                onChange={(e) =>
                  void command({
                    type: "settings",
                    key: "workStart",
                    value: minutes(e.target.value) / 60,
                  })
                }
              />
            </label>
            <label>
              Конец
              <input
                type="time"
                value={timeLabel(end * 60)}
                onChange={(e) =>
                  void command({
                    type: "settings",
                    key: "workEnd",
                    value: minutes(e.target.value) / 60,
                  })
                }
              />
            </label>
            <label>
              Максимум задач, мин
              <input
                type="number"
                min="15"
                max="1080"
                value={capacity}
                onChange={(e) =>
                  void command({
                    type: "settings",
                    key: "dailyCapacity",
                    value: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Без сложных задач после тренировки, мин
              <input
                type="number"
                min="0"
                max="360"
                value={options.afterWorkoutMinutes}
                onChange={(e) =>
                  void command({
                    type: "settings",
                    key: "afterWorkoutMinutes",
                    value: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <div className="row wrap">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((name, index) => (
              <label className="inline-check" key={name}>
                <input
                  type="checkbox"
                  checked={options.workDays!.includes(index + 1)}
                  onChange={(e) =>
                    void command({
                      type: "settings",
                      key: "workDays",
                      value: e.target.checked
                        ? [...options.workDays!, index + 1]
                        : options.workDays!.filter((x) => x !== index + 1),
                    })
                  }
                />
                {name}
              </label>
            ))}
            <label className="inline-check">
              <input
                type="checkbox"
                checked={options.lectureWork}
                onChange={(e) =>
                  void command({
                    type: "settings",
                    key: "lectureWork",
                    value: e.target.checked,
                  })
                }
              />
              Разрешать задачи во время лекций
            </label>
          </div>
          <p className="hint">
            Сложные задачи: приоритет P{options.complexPriority} и выше. Дорога
            и тренировки всегда блокируют время. Пары задаются событиями типа
            «Пара».
          </p>
          {s.constraints.map((c) => (
            <div className="rule-row" key={c.id}>
              <button
                className="textbutton grow"
                onClick={() => setConstraint(c)}
              >
                {c.label} ·{" "}
                {c.date ??
                  ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][
                    c.weekday! - 1
                  ]}{" "}
                · {timeLabel(c.start)}–{timeLabel(c.end)} ·{" "}
                {c.kind === "blocked" ? "Занято" : "Без сложных задач"}
              </button>
              <button
                className="icon"
                aria-label="Удалить ограничение"
                onClick={() =>
                  void command({ type: "removeConstraint", id: c.id })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </section>
      )}
      <div className="planner-layout">
        <section className="backlog-pro">
          <div className="sectionhead">
            <h3>Недельный backlog</h3>
            <span className="badge">{weekly.length}</span>
          </div>
          <p className="hint">
            Задачи на неделю без назначения на день. Перетащите в свободный
            интервал.
          </p>
          {weekly.map(card)}
          {!weekly.length && (
            <div className="empty-mini">Недельный список пуст</div>
          )}
          <button
            className="addcolumn"
            onClick={() =>
              edit({
                ...newItem("task", ""),
                status: "week",
                data: JSON.stringify({ weeklyWeekDraft: week[0] }),
              })
            }
          >
            + Задача на неделю
          </button>
          <h3 style={{ marginTop: 28 }}>
            Незапланированные <small>{backlog.length}</small>
          </h3>
          {backlog.map(card)}
          {!backlog.length && (
            <div className="empty-mini">Всё распределено</div>
          )}
          <div className="calendar-legend">
            {Object.entries(types)
              .filter(([k]) => k !== "personal event")
              .map(([type, label]) => (
                <span key={type}>
                  <i className={"event-color " + type} />
                  {label}
                </span>
              ))}
          </div>
        </section>
        <section className="calendar-pro">
          {view === "month" ? (
            <>
              <div className="month-weekdays">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
              <div className="month-grid">
                {monthDays.map((d) => (
                  <div
                    key={d}
                    className={
                      "month-cell " +
                      (d.slice(0, 7) !== date.slice(0, 7) ? "outside " : "") +
                      (d === today ? "is-today" : "")
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => drop(e, d)}
                  >
                    <button
                      className="month-day"
                      onClick={() => {
                        setDate(d);
                        setView("day");
                      }}
                    >
                      {Number(d.slice(-2))}
                    </button>
                    <button
                      className="month-add"
                      aria-label={"Добавить событие " + d}
                      onClick={() => newEvent(d)}
                    >
                      +
                    </button>
                    {dayItems(d)
                      .slice(0, 3)
                      .map((t) => (
                        <button
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/plain", t.id)
                          }
                          onClick={() => edit(t)}
                          className={
                            "month-event " +
                            (t.kind === "workout"
                              ? "workout"
                              : t.category || t.kind)
                          }
                          key={t.id}
                        >
                          {t.time && <small>{t.time}</small>} {t.title}
                        </button>
                      ))}
                    {dayItems(d).length > 3 && (
                      <button
                        className="textbutton more-events"
                        onClick={() => {
                          setDate(d);
                          setView("day");
                        }}
                      >
                        Ещё {dayItems(d).length - 3}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div
                className="time-grid-head"
                style={{
                  gridTemplateColumns: `52px repeat(${days.length},minmax(0,1fr))`,
                }}
              >
                <div className="zone-label">
                  UTC
                  {new Intl.DateTimeFormat("en", {
                    timeZone: zone,
                    timeZoneName: "shortOffset",
                  })
                    .formatToParts(new Date())
                    .find((p) => p.type === "timeZoneName")
                    ?.value.replace("GMT", "")}
                </div>
                {days.map((d) => {
                  const planned = tasks
                    .filter((t) => t.date === d)
                    .reduce((a, t) => a + t.estimate, 0);
                  const free = availableMinutes(
                    d,
                    occupied.filter((i) => i.kind !== "task"),
                    start,
                    end,
                    capacity,
                    options,
                  );
                  return (
                    <div
                      key={d}
                      className={
                        "time-day-head " + (d === today ? "is-today" : "")
                      }
                    >
                      <button
                        onClick={() => {
                          setDate(d);
                          setView("day");
                        }}
                      >
                        <span>
                          {new Date(d + "T12:00:00Z").toLocaleDateString(
                            "ru-RU",
                            { weekday: "short", timeZone: "UTC" },
                          )}
                        </span>
                        <strong>{Number(d.slice(-2))}</strong>
                      </button>
                      <small className={planned > free ? "overdue" : ""}>
                        {planned} / {Math.round(free)} мин
                      </small>
                      <div className="progress">
                        <i
                          style={{
                            width:
                              Math.min(100, free ? (planned / free) * 100 : 0) +
                              "%",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="timeline-scroll">
                <div
                  className="timeline-grid"
                  style={{
                    gridTemplateColumns: `52px repeat(${days.length},minmax(0,1fr))`,
                  }}
                >
                  <div className="time-ruler">
                    {Array.from({ length: 18 }, (_, i) => (
                      <span key={i} style={{ top: i * 64 }}>
                        {String(i + 6).padStart(2, "0")}:00
                      </span>
                    ))}
                  </div>
                  {days.map((d) => (
                    <div
                      key={d}
                      className={
                        "timeline-day " + (d === today ? "is-today" : "")
                      }
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        drop(
                          e,
                          d,
                          timeLabel(
                            Math.min(
                              1425,
                              Math.max(
                                360,
                                360 +
                                  Math.floor((e.clientY - rect.top) / 16) * 15,
                              ),
                            ),
                          ),
                        );
                      }}
                    >
                      {slots.map((t) => (
                        <button
                          key={t}
                          className={
                            "time-slot " + (t % 60 === 0 ? "hour" : "")
                          }
                          style={{ top: ((t - 360) * 64) / 60 }}
                          aria-label={
                            "Создать событие " + d + " " + timeLabel(t)
                          }
                          onClick={() => newEvent(d, timeLabel(t))}
                        />
                      ))}
                      {s.constraints
                        .filter(
                          (c) =>
                            c.kind === "blocked" &&
                            (c.date
                              ? c.date === d
                              : c.weekday ===
                                (new Date(d + "T12:00:00Z").getUTCDay() || 7)),
                        )
                        .map((c) => (
                          <div
                            key={c.id}
                            className="blocked-time"
                            style={{
                              top: ((Math.max(360, c.start) - 360) * 64) / 60,
                              height:
                                (Math.max(
                                  0,
                                  Math.min(1440, c.end) -
                                    Math.max(360, c.start),
                                ) *
                                  64) /
                                60,
                            }}
                          >
                            {c.label}
                          </div>
                        ))}
                      {dayItems(d)
                        .filter((i) => i.time)
                        .map((i) => {
                          const a = interval({ ...i, estimate: duration(i) })!;
                          const base = Date.parse(d + "T00:00:00Z") / 60000;
                          const from = Math.max(360, a.start - base),
                            to = Math.min(1440, a.end - base);
                          if (to <= from) return null;
                          return (
                            <div
                              key={i.id}
                              className={
                                "calendar-event " +
                                (i.kind === "workout"
                                  ? "workout"
                                  : i.kind === "task"
                                    ? "task"
                                    : i.category || "personal") +
                                (i.status === "done" ? " event-done" : "")
                              }
                              style={{
                                top: ((from - 360) * 64) / 60,
                                height: Math.max(
                                  27,
                                  ((to - from) * 64) / 60 - 3,
                                ),
                              }}
                              draggable
                              onDragStart={(e) => {
                                if (resize.current) {
                                  e.preventDefault();
                                  return;
                                }
                                e.dataTransfer.setData("text/plain", i.id);
                              }}
                            >
                              <button
                                className="event-main"
                                onClick={() => {
                                  if (skipClick.current) {
                                    skipClick.current = false;
                                    return;
                                  }
                                  edit(i);
                                }}
                              >
                                <span>{i.title}</span>
                                <small>
                                  {i.time} · {duration(i)} мин
                                </small>
                              </button>
                              <div
                                className="event-resize"
                                role="button"
                                tabIndex={0}
                                aria-label={"Изменить длительность " + i.title}
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.currentTarget.setPointerCapture(
                                    e.pointerId,
                                  );
                                  resize.current = { item: i, y: e.clientY };
                                  setResizeSize({
                                    id: i.id,
                                    value: i.estimate,
                                  });
                                }}
                                onPointerMove={(e) => {
                                  if (resize.current?.item.id === i.id) {
                                    const n = Math.max(
                                      15,
                                      Math.min(
                                        1440 - minutes(i.time!),
                                        Math.round(
                                          (resize.current.item.estimate +
                                            ((e.clientY - resize.current.y) *
                                              60) /
                                              64) /
                                            15,
                                        ) * 15,
                                      ),
                                    );
                                    setResizeSize({ id: i.id, value: n });
                                  }
                                }}
                                onPointerUp={(e) => {
                                  if (resize.current?.item.id === i.id) {
                                    e.stopPropagation();
                                    resize.current = null;
                                    skipClick.current = true;
                                    void save({
                                      ...i,
                                      estimate: duration(i),
                                    }).finally(() => setResizeSize(null));
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "ArrowDown" ||
                                    e.key === "ArrowUp"
                                  ) {
                                    e.preventDefault();
                                    void save({
                                      ...i,
                                      estimate: Math.max(
                                        15,
                                        i.estimate +
                                          (e.key === "ArrowDown" ? 15 : -15),
                                      ),
                                    });
                                  }
                                }}
                              >
                                <GripHorizontal size={13} />
                              </div>
                            </div>
                          );
                        })}
                      {d === today && currentMinutes() >= 360 && (
                        <div
                          className="now-line"
                          style={{ top: ((currentMinutes() - 360) * 64) / 60 }}
                        >
                          <i />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="unslotted">
                <span className="muted">Без времени</span>
                {occupied
                  .filter((i) => days.includes(i.date ?? "") && !i.time)
                  .map(card)}
              </div>
            </>
          )}
        </section>
      </div>
      {preview && (
        <Modal title="Предпросмотр расписания" onClose={() => setPreview(null)}>
          <p className="muted">
            Изменения ещё не применены. Учитываются занятые интервалы, рабочие
            дни, ёмкость, дедлайны и зависимости.
          </p>
          <div className="preview-summary">
            <Sparkles size={20} />
            <strong>{preview.result.length} назначений</strong>
            <span>{preview.rejected.length} требуют решения</span>
          </div>
          {preview.result.map((t) => (
            <div className="sessionrow" key={t.id}>
              <span>{t.title}</span>
              <span>
                {t.date} · {t.time} · {t.estimate} мин
              </span>
            </div>
          ))}
          {preview.rejected.map((t) => (
            <p className="hint" key={t.id}>
              ⚠ {t.title}: {preview.reasons[t.id]}
            </p>
          ))}
          {!preview.result.length && (
            <Empty>
              Свободных подходящих интервалов нет. Измените оценки, дни или
              ограничения.
            </Empty>
          )}
          <button
            className="primary"
            disabled={!preview.result.length}
            onClick={async () => {
              await command({
                type: "applySchedule",
                items: preview.result,
                expectedRevision: previewRevision,
              });
              setPreview(null);
            }}
          >
            Применить расписание
          </button>
        </Modal>
      )}
      {constraint && (
        <Modal title="Ограничение времени" onClose={() => setConstraint(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await command({ type: "constraint", value: constraint });
              setConstraint(null);
            }}
          >
            <Field label="Название">
              <input
                required
                value={constraint.label}
                onChange={(e) =>
                  setConstraint({ ...constraint, label: e.target.value })
                }
              />
            </Field>
            <Field label="Повтор">
              <select
                value={
                  constraint.date ? "date" : String(constraint.weekday ?? 1)
                }
                onChange={(e) =>
                  setConstraint(
                    e.target.value === "date"
                      ? { ...constraint, date, weekday: null }
                      : {
                          ...constraint,
                          date: null,
                          weekday: Number(e.target.value),
                        },
                  )
                }
              >
                <option value="date">Одна дата</option>
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((n, i) => (
                  <option key={n} value={i + 1}>
                    Каждый {n}
                  </option>
                ))}
              </select>
            </Field>
            {constraint.date && (
              <Field label="Дата">
                <input
                  type="date"
                  value={constraint.date}
                  onChange={(e) =>
                    setConstraint({ ...constraint, date: e.target.value })
                  }
                />
              </Field>
            )}
            <div className="formgrid">
              <Field label="С">
                <input
                  type="time"
                  value={timeLabel(constraint.start)}
                  onChange={(e) =>
                    setConstraint({
                      ...constraint,
                      start: minutes(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="До">
                <input
                  type="time"
                  value={timeLabel(constraint.end)}
                  onChange={(e) =>
                    setConstraint({
                      ...constraint,
                      end: minutes(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Тип">
              <select
                value={constraint.kind}
                onChange={(e) =>
                  setConstraint({
                    ...constraint,
                    kind: e.target.value as PlanningConstraint["kind"],
                  })
                }
              >
                <option value="blocked">Полностью занято</option>
                <option value="no_complex">Без сложных задач</option>
              </select>
            </Field>
            <button className="primary">Сохранить ограничение</button>
          </form>
        </Modal>
      )}
    </>
  );
}
