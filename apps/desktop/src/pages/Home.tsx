import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Plus,
  ListTodo,
  Target,
  CalendarClock,
  Dumbbell,
  Timer,
  ChartNoAxesCombined,
  FolderKanban,
  GraduationCap,
  GripVertical,
  ArrowDownUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Item } from "../../../../packages/contracts";
import type { PageProps } from "../shared/model";
import {
  newItem,
  dateInZone,
  weekDays,
  addDays,
} from "../../../../packages/core";
import { metrics } from "../../../../packages/analytics";
import { Empty } from "../shared/ui";
const defaults = [
  "Сегодня",
  "Расписание",
  "Активные проекты",
  "Учебный прогресс",
];
export function Home({
  s,
  command,
  go,
  edit,
  save,
}: PageProps & {
  go: (page: number) => void;
  edit: (item: Item) => void;
  save: (item: Item) => Promise<void>;
}) {
  const zone = String(
    s.settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const today = dateInZone(zone);
  const days = weekDays(today);
  const tasks = s.items.filter((t) => t.kind === "task");
  const todayTasks = tasks.filter((t) => t.date === today);
  const projects = s.items.filter((t) => t.kind === "project");
  const m = metrics(s, days[0], days[6]);
  const previous = metrics(s, addDays(days[0], -7), addDays(days[0], -1));
  const focusToday = s.sessions
    .filter((x) => dateInZone(zone, new Date(x.startedAt)) === today)
    .reduce((a, x) => a + x.seconds / 60, 0);
  const deadlines = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.due &&
      t.due.slice(0, 10) >= today &&
      t.due.slice(0, 10) <= addDays(today, 7),
  );
  const workouts = s.items.filter(
    (t) => t.kind === "workout" && t.date && days.includes(t.date),
  );
  const [showAll, setShowAll] = useState(false);
  const timeline = s.items
    .filter(
      (t) =>
        ["task", "event", "workout"].includes(t.kind) &&
        t.date === today &&
        t.time,
    )
    .sort((a, b) => a.time!.localeCompare(b.time!));
  const layout = (s.settings.dashboard as string[]) ?? defaults;
  const weekly = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(
    (day) => ({
      day: new Date(day + "T12:00:00Z").toLocaleDateString("ru-RU", {
        weekday: "short",
        timeZone: "UTC",
      }),
      completed: s.completions.filter(
        (x) => dateInZone(zone, new Date(x.at)) === day,
      ).length,
      focus: Math.round(
        s.sessions
          .filter((x) => dateInZone(zone, new Date(x.startedAt)) === day)
          .reduce((a, x) => a + x.seconds / 60, 0),
      ),
    }),
  );
  const hasActivity = weekly.some((d) => d.completed || d.focus);
  const priority = tasks
    .filter((t) => t.status !== "done")
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        (a.due ?? "9999").localeCompare(b.due ?? "9999"),
    )
    .slice(0, 3);
  const reorder = (from: number, to: number) => {
    const next = [...layout];
    [next[from], next[to]] = [next[to], next[from]];
    void command({ type: "settings", key: "dashboard", value: next });
  };
  const kpis = [
    {
      title: "Сегодня",
      value: `${todayTasks.filter((t) => t.status === "done").length} / ${todayTasks.length}`,
      hint: "выполнено / запланировано",
      icon: ListTodo,
      target: 2,
    },
    {
      title: "Исходный план",
      value:
        m.components[0] === null
          ? "Нет снимка"
          : Math.round(m.components[0] * 100) + "%",
      hint: "взвешенное выполнение недели",
      icon: Target,
      target: 6,
    },
    {
      title: "Дедлайны",
      value: String(deadlines.length),
      hint: "в ближайшие 7 дней",
      icon: CalendarClock,
      target: 2,
    },
    {
      title: "Тренировки",
      value: `${workouts.filter((w) => w.status === "done").length} / ${workouts.length}`,
      hint: "факт / план недели",
      icon: Dumbbell,
      target: 5,
    },
    {
      title: "Фокус сегодня",
      value: Math.floor(focusToday) + " мин",
      hint: "по дате начала сессии",
      icon: Timer,
      target: 7,
    },
    {
      title: "Эффективность",
      value: m.score === null ? "Нет данных" : m.score + "%",
      hint:
        m.score !== null && previous.score !== null
          ? `${m.score - previous.score >= 0 ? "+" : ""}${m.score - previous.score} п.п. к прошлой неделе`
          : "недостаточно данных для тренда",
      icon: ChartNoAxesCombined,
      target: 6,
    },
  ];
  return (
    <>
      <div className="command-hero">
        <div>
          <span className="eyebrow">ВАШ ЛИЧНЫЙ COMMAND CENTER</span>
          <h2>
            Больше ясности. <em>Больше фокуса.</em>
          </h2>
          <p>
            {todayTasks.length
              ? `${todayTasks.length} задач в плане на сегодня. Двигайтесь в своём темпе.`
              : "Начните с одного осмысленного шага — добавьте задачу на сегодня."}
          </p>
          <button
            className="primary"
            onClick={() =>
              edit({ ...newItem("task", ""), date: today, status: "today" })
            }
          >
            <Plus size={15} /> Запланировать день
          </button>
        </div>
        <svg
          className="mountain-scene"
          viewBox="0 0 460 190"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="mountain-far" x2="0" y2="1">
              <stop stopColor="#47674b" />
              <stop offset="1" stopColor="#1b3425" />
            </linearGradient>
            <linearGradient id="mountain-near" x2="0" y2="1">
              <stop stopColor="#31563c" />
              <stop offset="1" stopColor="#0d1d14" />
            </linearGradient>
            <radialGradient id="forest-glow">
              <stop stopColor="#73965b" stopOpacity=".4" />
              <stop offset="1" stopColor="#73965b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse
            cx="300"
            cy="80"
            rx="160"
            ry="100"
            fill="url(#forest-glow)"
          />
          <path
            d="M0 190 100 87 151 132 248 20 321 109 374 58 460 154V190Z"
            fill="url(#mountain-far)"
          />
          <path
            d="m224 49 24-29 40 49-32-14-10 8-8-15Z"
            fill="#81977c"
            opacity=".45"
          />
          <path
            d="M0 190 68 148 120 165 214 90 289 156 347 107 460 181V190Z"
            fill="url(#mountain-near)"
          />
          {[80, 118, 155, 311, 344, 381, 415, 435].map((x, i) => (
            <path
              key={x}
              d={`M${x} 190v-${28 + (i % 3) * 9}m-9 20 9-17 9 17h-18m-3 9 12-23 12 23`}
              fill="#0a1b11"
              stroke="#0a1b11"
              strokeWidth="3"
            />
          ))}
        </svg>
      </div>
      <div className="command-kpis">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.title}
              className="command-kpi"
              onClick={() => go(k.target)}
            >
              <span>
                <Icon size={16} />
                {k.title}
                <ArrowUpRight size={13} />
              </span>
              <strong>{k.value}</strong>
              <small>{k.hint}</small>
            </button>
          );
        })}
      </div>
      <div className="command-overview">
        <section>
          <div className="sectionhead">
            <div>
              <span className="eyebrow">НЕДЕЛЬНЫЙ РИТМ</span>
              <h3>Работа, которую видно</h3>
            </div>
            <button className="textbutton" onClick={() => go(6)}>
              Аналитика <ArrowUpRight size={13} />
            </button>
          </div>
          {hasActivity ? (
            <div className="chart overview-chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weekly}>
                  <CartesianGrid stroke="#294031" vertical={false} />
                  <XAxis dataKey="day" stroke="#7c9986" fontSize={10} />
                  <YAxis
                    yAxisId="tasks"
                    stroke="#7c9986"
                    allowDecimals={false}
                    fontSize={9}
                    width={24}
                  />
                  <YAxis
                    yAxisId="focus"
                    orientation="right"
                    stroke="#6f8978"
                    fontSize={9}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#192b21",
                      borderColor: "#36513e",
                      borderRadius: 9,
                    }}
                  />
                  <Area
                    yAxisId="focus"
                    dataKey="focus"
                    name="Фокус, мин"
                    stroke="#90b786"
                    fill="#263f2a"
                    fillOpacity={0.65}
                  />
                  <Bar
                    yAxisId="tasks"
                    dataKey="completed"
                    name="Завершено задач"
                    fill="#73d69a"
                    radius={[4, 4, 0, 0]}
                    barSize={23}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="overview-empty">
              <ChartNoAxesCombined size={33} />
              <div>
                <h3>Ваша неделя начинается здесь</h3>
                <p>
                  Завершайте задачи и сохраняйте фокус-сессии. График будет
                  отражать только ваши записи.
                </p>
              </div>
              <button onClick={() => go(7)}>Начать фокус</button>
            </div>
          )}
        </section>
        <section className="priority-panel">
          <div className="sectionhead">
            <div>
              <span className="eyebrow">НАПРАВЛЕНИЕ ДНЯ</span>
              <h3>Три приоритета</h3>
            </div>
            <Target size={20} />
          </div>
          {priority.map((t, i) => (
            <button
              key={t.id}
              className="priority-item"
              onClick={() => edit(t)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <strong>{t.title}</strong>
                <small>
                  P{t.priority} · {t.estimate} мин
                  {t.due ? " · до " + t.due.slice(5) : ""}
                </small>
              </div>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {!priority.length && (
            <>
              <p className="muted">
                Выберите важное: начните с первой задачи или вернитесь к
                проекту.
              </p>
              <button
                className="addcolumn"
                onClick={() => edit(newItem("task", ""))}
              >
                Добавить приоритет
              </button>
            </>
          )}
        </section>
      </div>
      <div className="dashboard command-widgets">
        {layout.map((name, index) => (
          <section
            key={name}
            className="widget"
            style={{
              height: (
                s.settings.widgetSizes as Record<string, number> | undefined
              )?.[name],
            }}
            draggable
            onDragStart={(e) => {
              if (e.target !== e.currentTarget) return;
              e.dataTransfer.setData("widget", String(index));
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("widget")) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes("widget")) return;
              e.preventDefault();
              reorder(Number(e.dataTransfer.getData("widget")), index);
            }}
            onMouseUp={(e) => {
              if (e.target !== e.currentTarget) return;
              const height = Math.min(
                1000,
                Math.max(
                  230,
                  Math.round(e.currentTarget.getBoundingClientRect().height),
                ),
              );
              const sizes =
                (s.settings.widgetSizes as Record<string, number>) ?? {};
              if (sizes[name] !== height)
                void command({
                  type: "settings",
                  key: "widgetSizes",
                  value: { ...sizes, [name]: height },
                });
            }}
          >
            <div className="sectionhead">
              <h3>
                <GripVertical size={14} />
                {name}
              </h3>
              <div className="row">
                <button
                  className="icon"
                  aria-label={"Переместить виджет " + name}
                  onClick={() => reorder(index, (index + 1) % layout.length)}
                >
                  <ArrowDownUp size={13} />
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
                  Открыть <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
            {name === "Сегодня" ? (
              <>
                {(showAll ? todayTasks : todayTasks.slice(0, 5)).map((t) => (
                  <div className="today-task" key={t.id}>
                    <button
                      className={
                        "check " + (t.status === "done" ? "checked" : "")
                      }
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
                      <small>
                        {projects.find((p) => p.id === t.projectId)?.title ??
                          "Личная задача"}
                      </small>
                    </button>
                    <span className={"priority p" + t.priority}>
                      P{t.priority}
                    </span>
                    <small>{t.estimate} мин</small>
                  </div>
                ))}
                {todayTasks.length > 5 && (
                  <button
                    className="textbutton"
                    onClick={() => setShowAll(!showAll)}
                  >
                    {showAll ? "Свернуть" : "Показать все " + todayTasks.length}
                  </button>
                )}
                {!todayTasks.length && (
                  <>
                    <Empty>День открыт для ваших планов</Empty>
                    <button
                      className="addcolumn"
                      onClick={() =>
                        edit({
                          ...newItem("task", ""),
                          date: today,
                          status: "today",
                        })
                      }
                    >
                      + Задача на сегодня
                    </button>
                  </>
                )}
              </>
            ) : name === "Расписание" ? (
              <>
                {timeline.map((t) => (
                  <button
                    className={
                      "timeline-summary " +
                      (t.kind === "workout" ? "workout" : t.category || t.kind)
                    }
                    key={t.id}
                    onClick={() => edit(t)}
                  >
                    <time>{t.time}</time>
                    <i />
                    <div>
                      <strong>{t.title}</strong>
                      <small>
                        {t.estimate} мин ·{" "}
                        {t.kind === "task"
                          ? "Задача"
                          : t.kind === "workout"
                            ? "Тренировка"
                            : t.category === "university"
                              ? "Пара"
                              : t.category === "commute"
                                ? "Дорога"
                                : "Событие"}
                      </small>
                    </div>
                  </button>
                ))}
                {!timeline.length && (
                  <>
                    <Empty>
                      Выделите время для главного. Добавьте событие или
                      перенесите задачу в календарь.
                    </Empty>
                    <button className="addcolumn" onClick={() => go(1)}>
                      Открыть календарь
                    </button>
                  </>
                )}
              </>
            ) : name === "Активные проекты" ? (
              <>
                {projects.slice(0, 4).map((p) => {
                  const ts = tasks.filter((t) => t.projectId === p.id);
                  const total = ts.reduce(
                    (a, t) => a + t.weight * t.estimate,
                    0,
                  );
                  const done = ts
                    .filter((t) => t.status === "done")
                    .reduce((a, t) => a + t.weight * t.estimate, 0);
                  return (
                    <button
                      className="home-project"
                      key={p.id}
                      onClick={() => go(3)}
                    >
                      <div className="row">
                        <FolderKanban size={17} />
                        <strong>{p.title}</strong>
                        <small>
                          {total ? Math.round((done / total) * 100) + "%" : "—"}
                        </small>
                      </div>
                      <div className="progress">
                        <i
                          style={{
                            width: (total ? (done / total) * 100 : 0) + "%",
                          }}
                        />
                      </div>
                      <small>
                        {ts.filter((t) => t.status === "done").length} из{" "}
                        {ts.length} задач
                      </small>
                    </button>
                  );
                })}
                {!projects.length && (
                  <>
                    <Empty>Объедините связанные задачи в проект.</Empty>
                    <button
                      className="addcolumn"
                      onClick={() => edit(newItem("project", ""))}
                    >
                      + Создать проект
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {s.subjects.slice(0, 5).map((subject) => {
                  const total = subject.rkTotal + subject.hwTotal,
                    done = subject.rkDone + subject.hwDone;
                  return (
                    <button
                      className="home-subject"
                      key={subject.id}
                      onClick={() => go(4)}
                    >
                      <GraduationCap size={16} />
                      <span>{subject.name}</span>
                      <div className="progress">
                        <i
                          style={{
                            width: (total ? (done / total) * 100 : 0) + "%",
                          }}
                        />
                      </div>
                      <small>
                        {done}/{total}
                      </small>
                    </button>
                  );
                })}
                {!!s.subjects.length && (
                  <p className="hint">
                    РК и ДЗ — агрегаты. Статусы подробных работ учитываются
                    отдельно; неизвестные не считаются выполненными.
                  </p>
                )}
                {!s.subjects.length && (
                  <>
                    <Empty>
                      Добавьте предметы или импортируйте известный учебный
                      прогресс.
                    </Empty>
                    <button className="addcolumn" onClick={() => go(4)}>
                      Открыть учебный трекер
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
