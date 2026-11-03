import { projectMetrics } from "../../../../../packages/analytics/projects";
import { BentoPanel as Panel } from "../../design/components";
import { useState, useId, cloneElement, type ReactElement } from "react";
import {
  WidgetSettings,
  widgetOrder,
  type WidgetLayout,
} from "../../features/WidgetSettings";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Play,
  Pause,
  Check,
  CalendarDays,
  Mountain,
  PanelTop,
  FolderKanban,
  Dumbbell,
  Headphones,
  GraduationCap,
  Undo2,
} from "lucide-react";
import type { Item } from "../../../../../packages/contracts";
import type { HomeConcept } from "../../../../../packages/core/design-preview";
import { newItem } from "../../../../../packages/core";
import { dashboardData } from "../../../../../packages/analytics/dashboard";
import type { PageProps } from "../../shared/model";
import "./forest-noir.css";

type Props = PageProps & {
  concept: HomeConcept;
  go: (page: number) => void;
  edit: (item: Item) => void;
};
const names = {
  A: "Editorial Forest",
  B: "Obsidian Command Center",
  C: "Atmospheric Bento",
};
const shortDate = (date: string) =>
  new Date(date.slice(0, 10) + "T12:00:00Z").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const plural = (n: number, words: [string, string, string]) =>
  words[
    n % 100 >= 11 && n % 100 <= 14
      ? 2
      : n % 10 === 1
        ? 0
        : n % 10 >= 2 && n % 10 <= 4
          ? 1
          : 2
  ];

function Empty({
  title,
  description,
  action,
  button,
}: {
  title: string;
  description: string;
  action: () => void;
  button: string;
}) {
  return (
    <div className="fn-empty">
      <svg viewBox="0 0 100 46" aria-hidden="true">
        <path
          d="M4 39 30 10l19 22 17-17 30 24M20 39h64M30 10v29"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle cx="78" cy="9" r="5" fill="currentColor" opacity=".5" />
      </svg>
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="fn-link" onClick={action}>
        {button}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

export function ForestHome({ s, command, go, edit, concept }: Props) {
  const d = dashboardData(s);
  const widgetConfig = s.settings.obsidianWidgets as WidgetLayout | undefined;
  const customLayout =
    !!widgetConfig &&
    (widgetConfig.order.join() !== widgetOrder.join() ||
      widgetConfig.hidden.length > 0 ||
      Object.keys(widgetConfig.sizes).length > 0 ||
      Object.keys(widgetConfig.widths ?? {}).length > 0);
  const osReduce = useReducedMotion();
  const reduce = osReduce || s.settings.animations === false;
  const chartId = useId().replaceAll(":", "");
  const [plain, setPlain] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [series, setSeries] = useState<"completed" | "focus">("completed");
  const [hover, setHover] = useState(6);
  const [completed, setCompleted] = useState<number | null>(null);
  const newTask = () =>
    edit({ ...newItem("task", ""), date: d.today, status: "today" });
  const tasks = d.todayTasks.filter(
    (t) =>
      filter === "all" ||
      (filter === "done" ? t.status === "done" : t.status !== "done"),
  );
  const currentSession = s.sessions.find((x) =>
    ["running", "paused", "interrupted"].includes(x.state),
  );
  const focusTask = d.pending[0] ?? d.tasks.find((t) => t.status !== "done");
  const targetSeconds = Number(s.settings.pomodoro ?? 25) * 60;
  const seconds = currentSession
    ? currentSession.target
      ? Math.max(0, currentSession.target - currentSession.seconds)
      : currentSession.seconds
    : targetSeconds;
  const max = Math.max(1, ...d.daily.map((day) => day[series]));
  const totalStudy = s.subjects.reduce((n, x) => n + x.hwTotal + x.rkTotal, 0);
  const doneStudy = s.subjects.reduce((n, x) => n + x.hwDone + x.rkDone, 0);
  const startFocus = () =>
    void command(
      currentSession
        ? {
            type: "focusAction",
            action: currentSession.state === "running" ? "pause" : "resume",
          }
        : {
            type: "focusStart",
            taskId: focusTask?.id ?? null,
            target: targetSeconds,
          },
    );
  const complete = async (item: Item) => {
    const state = await command({
      type: "save",
      item: { ...item, status: item.status === "done" ? "today" : "done" },
    });
    if (state) setCompleted(state.revision);
  };
  const date = new Date(d.today + "T12:00:00Z").toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const score = d.current.score;
  const comparison =
    score !== null && d.previous.score !== null
      ? score - d.previous.score
      : null;
  const completionPercent = d.todayTasks.length
    ? Math.round((d.doneToday / d.todayTasks.length) * 100)
    : 0;

  const taskList = (
    <Panel
      title="Сегодня"
      label="ВАШИ ПРИОРИТЕТЫ"
      className="fn-tasks"
      action={() => go(2)}
    >
      <div className="fn-list-toolbar">
        <div className="fn-tabs" aria-label="Фильтр задач">
          {(
            [
              ["all", "Все"],
              ["pending", "В работе"],
              ["done", "Готово"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
              {key === "all" && <span>{d.todayTasks.length}</span>}
            </button>
          ))}
        </div>
        <button
          className="fn-icon"
          aria-label="Добавить задачу на сегодня"
          onClick={newTask}
        >
          <Plus size={17} />
        </button>
      </div>
      {tasks.length ? (
        <div className="fn-task-rows">
          {tasks.map((t, i) => (
            <div
              className={`fn-task ${t.status === "done" ? "is-done" : ""}`}
              key={t.id}
            >
              <motion.button
                className="fn-checkbox"
                aria-label={`${t.status === "done" ? "Вернуть" : "Завершить"} ${t.title}`}
                aria-pressed={t.status === "done"}
                whileTap={reduce ? undefined : { scale: 0.85 }}
                onClick={() => void complete(t)}
              >
                {t.status === "done" && <Check size={14} />}
              </motion.button>
              <span className="fn-task-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <button className="fn-task-title" onClick={() => edit(t)}>
                <strong>{t.title}</strong>
                <small>
                  {d.projects.find((p) => p.id === t.projectId)?.title ??
                    "Личная задача"}
                  {s.taskDetails[t.id]?.checklist.length
                    ? ` · Чек-лист ${s.taskDetails[t.id].checklist.filter((c) => c.done).length}/${s.taskDetails[t.id].checklist.length}`
                    : ""}
                </small>
              </button>
              <span className={`fn-priority fn-priority-${t.priority}`}>
                P{t.priority}
              </span>
              <span className="fn-duration">{t.estimate} мин</span>
              <button
                className="fn-icon fn-edit"
                aria-label={`Подробнее: ${t.title}`}
                onClick={() => edit(t)}
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title={
            d.todayTasks.length ? "Здесь пока пусто" : "Начните с одного шага"
          }
          description={
            d.todayTasks.length
              ? "В этом фильтре нет задач. Можно выбрать другой или добавить новую."
              : "Выберите то, что действительно важно сегодня."
          }
          action={newTask}
          button="Добавить задачу"
        />
      )}
      <div className="fn-task-footer">
        <span>
          <i />
          {d.doneToday} из {d.todayTasks.length} выполнено
        </span>
        <button className="fn-link" onClick={() => go(2)}>
          Все задачи <ArrowRight size={14} />
        </button>
      </div>
    </Panel>
  );

  const efficiency = (
    <Panel
      title="Эффективность недели"
      label="ПРОГРЕСС, А НЕ ГОНКА"
      className="fn-efficiency"
      action={() => go(6)}
    >
      <div className="fn-score" data-testid="efficiency-score">
        {score ?? "—"}
        {score !== null && <span>%</span>}
      </div>
      <div className="fn-comparison">
        {comparison === null
          ? "Для сравнения пока мало данных"
          : `${comparison >= 0 ? "+" : "−"}${Math.abs(comparison)} п.п. к прошлой неделе`}
      </div>
      <div className="fn-score-baseline">
        <span>
          {shortDate(d.days[0])} — {shortDate(d.days[6])}
        </span>
        <span>
          {d.current.components.filter((v) => v !== null).length}/5 компонентов
        </span>
      </div>
      <div className="fn-component-strip">
        {d.current.components.map((value, i) => (
          <div key={i}>
            <span>{["План", "Сроки", "Фокус", "Оценка", "Спорт"][i]}</span>
            <div>
              <i style={{ width: `${(value ?? 0) * 100}%` }} />
            </div>
            <small>
              {value === null ? "—" : Math.round(value * 100) + "%"}
            </small>
          </div>
        ))}
      </div>
      <details className="fn-definition">
        <summary>Как считается показатель</summary>
        <p>
          Взвешенная оценка первоначального плана, сроков, фокус-сессий,
          точности оценки времени и регулярности тренировок. Неизвестные
          компоненты исключаются, остальные веса нормируются. Весовые настройки
          — в аналитике.
        </p>
      </details>
    </Panel>
  );

  const focus = (
    <Panel
      title={currentSession ? "Ваш фокус" : "Время для главного"}
      label="ОДНА ЗАДАЧА ЗА РАЗ"
      className="fn-focus"
      action={() => go(7)}
    >
      <div className="fn-focus-clock">
        <Headphones size={22} />
        <strong data-testid="focus-clock">
          {String(Math.floor(seconds / 60)).padStart(2, "0")}
          <span>:</span>
          {String(Math.floor(seconds % 60)).padStart(2, "0")}
        </strong>
        <span>
          {currentSession
            ? currentSession.state === "running"
              ? "Сессия идёт"
              : "Сессия на паузе"
            : "Pomodoro"}
        </span>
      </div>
      <p>
        {currentSession
          ? (s.items.find((i) => i.id === currentSession.taskId)?.title ??
            "Свободная сессия")
          : (focusTask?.title ?? "Тихое время без привязки к задаче")}
      </p>
      <button className="fn-focus-action" onClick={startFocus}>
        {currentSession?.state === "running" ? (
          <Pause size={15} />
        ) : (
          <Play size={15} />
        )}{" "}
        {currentSession
          ? currentSession.state === "running"
            ? "Пауза"
            : "Продолжить"
          : "Начать фокус"}
        <ArrowUpRight size={15} />
      </button>
      {currentSession && (
        <button
          className="fn-link"
          onClick={() =>
            void command({ type: "focusAction", action: "finish" })
          }
        >
          Завершить сессию
        </button>
      )}
      <div className="fn-focus-total">
        <span>В фокусе сегодня</span>
        <strong>{d.focusToday} мин</strong>
      </div>
    </Panel>
  );

  const agenda = (
    <Panel
      title="Линия дня"
      label="ВРЕМЯ И КОНТЕКСТ"
      className="fn-agenda"
      action={() => go(1)}
    >
      {d.timeline.length ? (
        <div className="fn-agenda-rows">
          {d.timeline.map((item) => (
            <button
              key={item.id}
              className={`fn-agenda-item fn-kind-${item.kind === "event" ? item.category : item.kind}`}
              onClick={() => edit(item)}
            >
              <time>{item.time}</time>
              <i />
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.estimate} мин ·{" "}
                  {item.kind === "workout"
                    ? "Тренировка"
                    : item.kind === "task"
                      ? "Задача"
                      : item.category === "commute"
                        ? "Дорога"
                        : item.category === "university"
                          ? "Учёба"
                          : "Событие"}
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="День открыт для планов"
          description="Добавьте событие или выделите время для задачи."
          action={() => go(1)}
          button="Открыть планировщик"
        />
      )}
    </Panel>
  );

  const chart = (
    <Panel
      title="Ваш недельный ритм"
      label="ПОСЛЕДНИЕ СЕМЬ ДНЕЙ"
      className="fn-chart-panel"
      action={() => go(6)}
    >
      <div className="fn-chart-toolbar">
        <div className="fn-tabs">
          <button
            aria-pressed={series === "completed"}
            onClick={() => setSeries("completed")}
          >
            Задачи
          </button>
          <button
            aria-pressed={series === "focus"}
            onClick={() => setSeries("focus")}
          >
            Фокус
          </button>
        </div>
        <span>{series === "completed" ? "Завершено, шт." : "Фокус, мин"}</span>
      </div>
      {d.daily.some((day) => day.completed || day.focus) ? (
        <>
          <div
            className="rc-rhythm"
            role="group"
            aria-label={
              series === "completed"
                ? "Завершённые задачи за семь дней"
                : "Минуты фокуса за семь дней"
            }
          >
            <svg
              className="rc-rhythm-svg"
              viewBox="0 0 600 190"
              aria-label="Динамика за семь дней"
            >
              <defs>
                <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8de0ad" stopOpacity=".28" />
                  <stop offset="100%" stopColor="#8de0ad" stopOpacity="0" />
                </linearGradient>
              </defs>
              {Array.from(new Set([0, Math.round(max / 2), max])).map((t) => (
                <g key={t}>
                  <line
                    x1="38"
                    x2="580"
                    y1={150 - (t / max) * 125}
                    y2={150 - (t / max) * 125}
                    stroke="#34513e"
                    strokeDasharray="3 5"
                  />
                  <text
                    x="28"
                    y={154 - (t / max) * 125}
                    textAnchor="end"
                    fill="#b1c5b8"
                    fontSize="13"
                  >
                    {t}
                  </text>
                </g>
              ))}
              {(() => {
                const points = d.daily.map((day, i) => [
                  38 + (i * 542) / 6,
                  150 - (day[series] / max) * 125,
                ]);
                const line = points
                  .map(([x, y], i) => (i ? `L ${x} ${y}` : `M ${x} ${y}`))
                  .join(" ");
                return (
                  <>
                    <path
                      d={`${line} L 580 150 L 38 150 Z`}
                      fill={`url(#${chartId})`}
                    />
                    <motion.path
                      d={line}
                      fill="none"
                      stroke="#9be5b6"
                      strokeWidth="2.5"
                      initial={false}
                      animate={{ opacity: 1 }}
                      transition={{ duration: reduce ? 0 : 0.22 }}
                    />
                    {points.map(([x, y], i) => (
                      <g
                        key={d.daily[i].date}
                        role="button"
                        tabIndex={0}
                        aria-label={`${shortDate(d.daily[i].date)}: ${d.daily[i].completed} задач; ${d.daily[i].focus} минут фокуса`}
                        aria-pressed={hover === i}
                        onFocus={() => setHover(i)}
                        onMouseEnter={() => setHover(i)}
                        onClick={() => setHover(i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setHover(i);
                          }
                        }}
                      >
                        <rect
                          x={x - 30}
                          y="10"
                          width="60"
                          height="155"
                          fill="transparent"
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={hover === i ? 5 : 3}
                          fill={hover === i ? "#c8f5d8" : "#85c99f"}
                          stroke="#14261b"
                          strokeWidth="2"
                        />
                        <text
                          x={x}
                          y="181"
                          textAnchor={
                            i === 0 ? "start" : i === 6 ? "end" : "middle"
                          }
                          fill="#b1c5b8"
                          fontSize="13"
                        >
                          {d.daily[i].label}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="fn-chart-caption" aria-live="polite">
            {shortDate(d.daily[hover].date)}
            <span>
              {d.daily[hover].completed}{" "}
              {plural(d.daily[hover].completed, ["задача", "задачи", "задач"])}{" "}
              · {d.daily[hover].focus} мин фокуса
            </span>
          </div>
        </>
      ) : (
        <Empty
          title="Ритм появится с первым результатом"
          description="График строится по завершениям задач и сохранённым сессиям."
          action={startFocus}
          button="Начать фокус"
        />
      )}
    </Panel>
  );

  const projects = (
    <Panel
      title="Проекты в движении"
      label="БОЛЬШОЕ — МАЛЕНЬКИМИ ШАГАМИ"
      className="fn-projects"
      action={() => go(3)}
    >
      {d.projects.length ? (
        d.projects.map((project, i) => {
          const progress = projectMetrics(s, project.id),
            ts = progress.tasks,
            percent = progress.percent;
          return (
            <button
              className={`fn-project fn-project-${i % 3}`}
              key={project.id}
              onClick={() => go(3)}
            >
              <span className="fn-project-emblem">
                <FolderKanban size={17} />
              </span>
              <span className="fn-project-body">
                <strong>{project.title}</strong>
                <span className="fn-progress">
                  <i style={{ width: `${percent ?? 0}%` }} />
                </span>
                <small>
                  {ts.filter((t) => t.status === "done").length}/{ts.length}{" "}
                  задач ·{" "}
                  {project.due ? "до " + shortDate(project.due) : "Без срока"}
                </small>
              </span>
              <b>{percent === null ? "—" : percent + "%"}</b>
            </button>
          );
        })
      ) : (
        <Empty
          title="Дайте идее направление"
          description="Проект объединит задачи и поможет видеть следующий шаг."
          action={() => edit(newItem("project", ""))}
          button="Создать проект"
        />
      )}
    </Panel>
  );

  const fitness = (
    <Panel
      title="Движение — тоже прогресс"
      label="ТРЕНИРОВКИ НЕДЕЛИ"
      className="fn-fitness"
      action={() => go(5)}
    >
      <div className="fn-training-stat">
        <strong>
          {d.finishedWorkouts.length}
          <span>/{d.workouts.length}</span>
        </strong>
        <Dumbbell size={30} />
      </div>
      <p>завершено из запланированных</p>
      <div className="fn-training-days">
        {d.days.map((day) => {
          const items = d.workouts.filter((w) => w.date === day);
          return (
            <button
              key={day}
              onClick={() => (items[0] ? edit(items[0]) : go(5))}
              aria-label={`${shortDate(day)}: ${items.length ? items.map((w) => w.title).join(", ") : "тренировок не запланировано"}`}
              className={
                items.some((w) => w.status === "done")
                  ? "done"
                  : items.length
                    ? "planned"
                    : ""
              }
            >
              <span>
                {new Date(day + "T12:00:00Z").toLocaleDateString("ru-RU", {
                  weekday: "short",
                  timeZone: "UTC",
                })}
              </span>
              <i>
                {items.some((w) => w.status === "done") ? (
                  <Check size={13} />
                ) : items.length ? (
                  <Dumbbell size={12} />
                ) : (
                  "·"
                )}
              </i>
            </button>
          );
        })}
      </div>
      <div className="fn-training-totals">
        <span>
          <b>{d.workoutMinutes}</b> мин
        </span>
        <span>
          <b>
            {d.runningKm.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}
          </b>{" "}
          км бега
        </span>
      </div>
      <button
        className="fn-link"
        onClick={() => edit({ ...newItem("workout", ""), date: d.today })}
      >
        <Plus size={14} />
        {d.workouts.length ? "Записать тренировку" : "Запланировать движение"}
      </button>
    </Panel>
  );

  const deadlines = (
    <Panel
      title="На горизонте"
      label="БЛИЖАЙШИЕ СРОКИ · 7 ДНЕЙ"
      className="fn-deadlines"
      action={() => go(2)}
    >
      {d.deadlines.length ? (
        d.deadlines.slice(0, 4).map((t) => (
          <button className="fn-deadline" key={t.id} onClick={() => edit(t)}>
            <span className="fn-due-date">{shortDate(t.due!)}</span>
            <strong>{t.title}</strong>
            <ArrowUpRight size={15} />
          </button>
        ))
      ) : (
        <Empty
          title="Сроки не поджимают"
          description="Здесь появятся ближайшие дедлайны ваших задач."
          action={newTask}
          button="Добавить задачу"
        />
      )}
    </Panel>
  );

  const study = (
    <Panel
      title="Учебный маршрут"
      label="РК И ДОМАШНИЕ РАБОТЫ"
      className="fn-study"
      action={() => go(4)}
    >
      {s.subjects.length ? (
        <>
          <div className="fn-study-summary">
            <GraduationCap size={24} />
            <strong>
              {doneStudy}
              <span>/{totalStudy}</span>
            </strong>
            <span>
              выполнено
              <br />
              по агрегатам
            </span>
          </div>
          <div className="fn-progress">
            <i
              style={{
                width: `${totalStudy ? (doneStudy / totalStudy) * 100 : 0}%`,
              }}
            />
          </div>
          <p>
            {s.subjects.length} предметов · {s.groups.length} группы работ.
            Подробные этапы учитываются отдельно.
          </p>
          <button className="fn-link" onClick={() => go(4)}>
            Открыть трекер <ArrowRight size={14} />
          </button>
        </>
      ) : (
        <Empty
          title="Ваш учебный маршрут"
          description="Добавьте предметы или перенесите известные отметки."
          action={() => go(4)}
          button="Открыть учёбу"
        />
      )}
    </Panel>
  );

  const week = (
    <Panel
      title="Неделя в поле зрения"
      label={`${shortDate(d.days[0])} — ${shortDate(d.days[6])}`}
      className="fn-week"
      action={() => go(1)}
    >
      <div className="fn-week-grid">
        {d.days.map((day) => {
          const dayItems = s.items.filter(
            (i) =>
              ["task", "event", "workout"].includes(i.kind) && i.date === day,
          );
          return (
            <button
              key={day}
              className={day === d.today ? "today" : ""}
              onClick={() => go(1)}
              aria-label={`Планировщик: ${shortDate(day)}, ${dayItems.length} записей`}
            >
              <span>
                {new Date(day + "T12:00:00Z").toLocaleDateString("ru-RU", {
                  weekday: "short",
                  timeZone: "UTC",
                })}
              </span>
              <strong>{Number(day.slice(8))}</strong>
              <div>
                {dayItems.slice(0, 4).map((i) => (
                  <i key={i.id} className={`fn-week-${i.kind}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <p>
        <CalendarDays size={14} />
        {
          s.items.filter(
            (i) =>
              ["task", "event", "workout"].includes(i.kind) &&
              i.date &&
              d.days.includes(i.date),
          ).length
        }{" "}
        записей в плане недели
      </p>
    </Panel>
  );

  return (
    <motion.div
      className={`fn-home fn-home-${concept.toLowerCase()} ${plain ? "fn-plain" : ""}`}
      data-testid={`forest-concept-${concept}`}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="fn-page-top">
        <div>
          <span className="fn-kicker">ЛИЧНОЕ ПРОСТРАНСТВО / OBSIDIAN</span>
          <h1>Главная</h1>
        </div>
        <div className="fn-top-actions">
          <span>{date}</span>
          <button
            className="fn-icon fn-plain-switch"
            onClick={() => setPlain(!plain)}
            aria-label="Без пейзажа"
            aria-pressed={plain}
          >
            {plain ? <Mountain size={17} /> : <PanelTop size={17} />}
          </button>
          {concept !== "A" && (
            <button className="fn-primary" onClick={newTask}>
              <Plus size={16} />
              Новая задача
            </button>
          )}
        </div>
      </div>
      {concept === "A" && (
        <div className="fn-masthead">
          <div className="fn-masthead-copy">
            <span className="fn-kicker">МЕСТО ДЛЯ ВАШЕГО ГЛАВНОГО</span>
            <h2>
              Меньше шума.
              <br />
              <em>Больше смысла.</em>
            </h2>
            <p>
              {d.pending.length
                ? `${d.pending.length} ${plural(d.pending.length, ["задача ждёт", "задачи ждут", "задач ждут"])} внимания. Двигайтесь в своём ритме.`
                : "Новый день. Пространство для осмысленного шага."}
            </p>
            <button className="fn-primary" onClick={newTask}>
              Добавить задачу <ArrowUpRight size={16} />
            </button>
          </div>
          <span className="fn-panorama-caption">
            FOREST NOIR / ТИХАЯ ПРОДУКТИВНОСТЬ
          </span>
        </div>
      )}
      {concept === "B" && (
        <div className="fn-command-mast">
          <div>
            <span className="fn-kicker">OBSIDIAN / ОБЗОР ДНЯ</span>
            <h2>План. Контроль. Результат.</h2>
            <p>Все контексты на одной поверхности.</p>
            <button className="fn-link" onClick={() => go(1)}>
              Планировщик недели <ArrowRight size={15} />
            </button>
          </div>
          <div className="fn-command-metric rc-primary-score">
            <span>Эффективность дня</span>
            <strong data-testid="daily-efficiency-score">
              {d.dailyScore ?? "—"}
              <small>{d.dailyScore === null ? "" : " / 100"}</small>
            </strong>
            <small>
              {d.dailyScore === null
                ? "Нет наблюдений для расчёта"
                : "Текущий план и реальные результаты"}
            </small>
            <button className="fn-link" onClick={() => go(6)}>
              Разобрать показатель <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="fn-command-metric rc-secondary-metric">
            <span>Задачи сегодня</span>
            <strong>
              {d.doneToday}
              <small> / {d.todayTasks.length}</small>
            </strong>
            <div className="fn-progress">
              <i style={{ width: `${completionPercent}%` }} />
            </div>
            <small>
              {d.todayTasks.length
                ? `${completionPercent}% плана выполнено`
                : "План пока свободен"}
            </small>
          </div>
          <div className="fn-command-metric">
            <span>Фокус сегодня</span>
            <strong>
              {d.focusToday}
              <small> мин</small>
            </strong>
            <small>по сохранённым сессиям</small>
          </div>
        </div>
      )}
      {concept === "C" && (
        <div className="fn-bento-heading">
          <h2>
            Ваш день,
            <br />
            <span>в хорошем ритме.</span>
          </h2>
          <p>
            Важное — в центре.
            <br />
            Остальному найдётся своё место.
          </p>
        </div>
      )}
      <div className={"fn-layout " + (customLayout ? "fn-custom-layout" : "")}>
        {concept === "B" && customLayout
          ? ((s.settings.obsidianWidgets as WidgetLayout)?.order ?? widgetOrder)
              .filter(
                (id) =>
                  !(
                    (s.settings.obsidianWidgets as WidgetLayout)?.hidden ?? []
                  ).includes(id),
              )
              .map((id) => {
                const config = s.settings.obsidianWidgets as
                  WidgetLayout | undefined;
                const parts: Record<string, ReactElement> = {
                  tasks: taskList,
                  agenda,
                  focus,
                  chart,
                  projects,
                  efficiency,
                  fitness,
                  deadlines,
                  study,
                  week,
                };
                return (
                  <div
                    key={id}
                    className="obs-widget-slot"
                    data-widget={id}
                    style={{
                      gridColumn: `span ${config?.widths?.[id] ?? 6}`,
                      height: config?.sizes[id],
                      overflow: config?.sizes[id] ? "auto" : undefined,
                    }}
                  >
                    {parts[id] ? cloneElement(parts[id]) : null}
                  </div>
                );
              })
          : null}
        {(concept !== "B" || !customLayout) &&
          (concept === "A" ? (
            <>
              {taskList}
              {efficiency}
              {chart}
              {focus}
              {agenda}
              {projects}
              {fitness}
              {deadlines}
              {study}
              {week}
            </>
          ) : concept === "B" ? (
            <>
              {taskList}
              {chart}
              {agenda}
              {focus}
              {efficiency}
              {projects}
              {fitness}
              {deadlines}
              {study}
              {week}
            </>
          ) : (
            <>
              {efficiency}
              {taskList}
              {week}
              {chart}
              {fitness}
              {projects}
              {focus}
              {agenda}
              {deadlines}
              {study}
            </>
          ))}
      </div>
      <WidgetSettings s={s} command={command} />
      <div className="fn-local-status">
        <span>
          <i />
          SQLite ·{" "}
          {s.diagnostics.integrity === "ok"
            ? "Проверка целостности: OK"
            : s.diagnostics.integrity}
        </span>
        <span>
          {names[concept]}
          {s.diagnostics.workspace === "demo" ? " / демо" : " / локально"}
        </span>
        <span>
          Команды <kbd>Ctrl K</kbd> · Новая задача <kbd>Ctrl N</kbd>
        </span>
      </div>
      {completed !== null && completed === s.revision && (
        <div className="fn-complete-toast" role="status">
          <Check size={16} />
          Статус задачи сохранён
          <button
            onClick={() => {
              void command({ type: "undo" });
              setCompleted(null);
            }}
          >
            <Undo2 size={14} />
            Отменить
          </button>
          <button
            aria-label="Скрыть уведомление"
            onClick={() => setCompleted(null)}
          >
            ×
          </button>
        </div>
      )}
    </motion.div>
  );
}
