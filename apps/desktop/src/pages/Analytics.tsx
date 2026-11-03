import { useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { State } from "../../../../packages/contracts";
import {
  insights,
  insightState,
} from "../../../../packages/analytics/insights";
import { dateInZone, addDays } from "../../../../packages/core";
import { MetricCard, EmptyState, ProgressRing } from "../design/components";
const tooltip = {
  background: "#14251b",
  border: "1px solid #3b5644",
  borderRadius: 10,
  color: "#dce9df",
};
const colors = [
  "#8cdaac",
  "#debd79",
  "#7798bf",
  "#527b60",
  "#aa9fb8",
  "#c47f7c",
];
function activityColor(done: number, focus: number) {
  if (!done && !focus) return { background: "#203226", color: "#c9dbce" };
  const alpha = Math.min(0.95, 0.2 + done * 0.15 + focus / 300);
  const rgb = [16, 27, 21].map((v, i) =>
    Math.round(v + ([132, 210, 160][i] - v) * alpha),
  );
  const luminance = rgb
    .map((v) => {
      const n = v / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    })
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  return {
    background: `rgb(${rgb.join(",")})`,
    color: luminance > 0.179 ? "#000000" : "#ffffff",
  };
}
export function Analytics({ s }: { s: State }) {
  const animate = !useReducedMotion() && s.settings.animations !== false;
  const today = dateInZone(String(s.settings.timezone ?? "Europe/Moscow"));
  const [start, setStart] = useState(addDays(today, -29)),
    [end, setEnd] = useState(today),
    [project, setProject] = useState(""),
    [category, setCategory] = useState("");
  const valid =
    !!start &&
    !!end &&
    start <= end &&
    (Date.parse(end) - Date.parse(start)) / 86400000 < 366;
  const seconds = s.sessions.reduce((a, x) => a + Math.floor(x.seconds), 0);
  const filtered = useMemo(
    () => insightState(s, project, category),
    [s.revision, seconds, project, category],
  );
  const data = useMemo(
    () => (valid ? insights(filtered, start, end) : null),
    [filtered, start, end, valid, today],
  );
  const projects = s.items.filter((p) => p.kind === "project");
  const categories = Array.from(
    new Set(
      [
        ...s.items.filter((i) => i.kind === "task"),
        ...s.completions.map((c) => c.task),
      ].map((t) => t.category),
    ),
  )
    .filter(Boolean)
    .sort();
  const pct = (n: number | null) =>
    n === null ? "—" : `${Math.round(n * 100)}%`;
  const summary = data?.m;
  const breakdown = Array.from(
    new Set(summary?.done.map((t) => t.category || "Без категории")),
  ).map((name) => ({
    name,
    value: summary!.done.filter((t) => (t.category || "Без категории") === name)
      .length,
  }));
  return (
    <>
      <section className="obs-insights-header">
        <div>
          <span className="eyebrow">INSIGHTS / РЕАЛЬНЫЙ РИТМ</span>
          <h2>От наблюдений к решениям.</h2>
          <p className="muted">
            История завершений, рабочие сессии и нагрузка — в одном контексте.
          </p>
        </div>
        <span className="badge">
          {(s.settings.timezone as string) || "Europe/Moscow"}
        </span>
      </section>
      <div className="toolbar obs-insights-filter">
        <select
          aria-label="Период аналитики"
          value=""
          onChange={(e) => {
            const n = Number(e.target.value);
            if (n) {
              setEnd(today);
              setStart(addDays(today, 1 - n));
            }
          }}
        >
          <option value="">Выбрать период</option>
          {[7, 30, 90, 365].map((n) => (
            <option key={n} value={n}>
              {n} дней
            </option>
          ))}
        </select>
        <label>
          С{" "}
          <input
            aria-label="Аналитика с"
            type="date"
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          По{" "}
          <input
            aria-label="Аналитика по"
            type="date"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <select
          aria-label="Проект аналитики"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="">Все проекты</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Категория аналитики"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {!valid && <p role="alert">Выберите период от 1 до 366 дней.</p>}
      {data && summary && (
        <>
          <div className="kpis obs-insights-kpis">
            <MetricCard
              label="Завершено"
              value={summary.done.length}
              hint={`Предыдущий период: ${data.previous.done.length}`}
            />
            <MetricCard
              label="Фокус"
              value={`${summary.focusMinutes} мин`}
              hint={`Было ${data.previous.focusMinutes} мин · без перерывов`}
            />
            <MetricCard
              label="Переносы задач"
              value={data.moves}
              hint="Из фактического журнала изменений"
            />
            <MetricCard
              label="Просрочено"
              value={data.overdue.length}
              hint="Открытые задачи со сроком в периоде"
            />
          </div>
          <div className="obs-insights-grid">
            <section className="obs-efficiency">
              <div>
                <span className="eyebrow">EFFICIENCY / ВЗВЕШЕННЫЙ ИНДЕКС</span>
                <h3>Эффективность</h3>
                <p className="hint">
                  За день {end} и неделю, в которую он входит.
                </p>
              </div>
              <div className="obs-score-pair">
                <div>
                  <ProgressRing
                    value={data.daily.score}
                    label="Daily Efficiency Score"
                  />
                  <strong>Daily Score</strong>
                  <small>Текущий план дня</small>
                </div>
                <div>
                  <ProgressRing
                    value={data.weekly.score}
                    label="Weekly Efficiency Score"
                  />
                  <strong>Weekly Score</strong>
                  <small>Исходный план недели</small>
                </div>
              </div>
              <div className="sessionrow">
                <span>Индекс за весь период</span>
                <strong>{summary.score ?? "—"} / 100</strong>
              </div>
              {[
                "Исходный план",
                "Соблюдение сроков",
                "Фокус / цель",
                "Точность оценки",
                "Тренировки",
              ].map((label, i) => (
                <div className="sessionrow" key={label}>
                  <span>{label}</span>
                  <strong>{pct(summary.components[i])}</strong>
                </div>
              ))}
              <details>
                <summary>Как рассчитывается</summary>
                <p className="hint">
                  Веса:{" "}
                  {(
                    (s.settings.weights as number[]) ?? [35, 25, 20, 10, 10]
                  ).join(" / ")}
                  . Компоненты без наблюдений исключаются, остальные веса
                  перенормируются. Недельный план фиксируется пользователем в
                  задачах. Daily использует текущие датированные задачи.
                  Точность = min(оценка, рабочее время) / max. Тренировки
                  учитываются после наступления планового окончания или
                  завершения.
                </p>
              </details>
            </section>
            <section className="obs-insight-wide">
              <h3>Завершения и эффективность</h3>
              <p className="hint">
                Задачи — по сохранённой дате завершения, индекс — 0–100.
                Отсутствие наблюдений оставляет разрыв.
              </p>
              {summary.done.length ||
              data.days.some((d) => d.score !== null) ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.days}>
                      <CartesianGrid stroke="#293d30" vertical={false} />
                      <XAxis dataKey="label" stroke="#8ca294" fontSize={11} />
                      <YAxis
                        yAxisId="tasks"
                        allowDecimals={false}
                        stroke="#8ca294"
                      />
                      <YAxis
                        yAxisId="score"
                        orientation="right"
                        domain={[0, 100]}
                        stroke="#b5a476"
                      />
                      <Tooltip contentStyle={tooltip} />
                      <Legend />
                      <Line
                        isAnimationActive={animate}
                        animationDuration={220}
                        yAxisId="tasks"
                        dataKey="done"
                        name="Задачи, шт"
                        stroke="#8cdaac"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        isAnimationActive={animate}
                        animationDuration={220}
                        yAxisId="score"
                        dataKey="score"
                        name="Daily Score"
                        stroke="#debd79"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Ритм ещё не записан">
                  Завершите задачу или начните фокус-сессию.
                </EmptyState>
              )}
            </section>
            <section className="obs-insight-wide">
              <h3>Нагрузка: оценка и фокус</h3>
              <p className="hint">
                План — суммарная оценка датированных задач. Факт — рабочие
                сессии по дню начала, в минутах.
              </p>
              {data.days.some((d) => d.focus || d.planned) ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.days}>
                      <CartesianGrid stroke="#293d30" vertical={false} />
                      <XAxis dataKey="label" stroke="#8ca294" fontSize={11} />
                      <YAxis stroke="#8ca294" />
                      <Tooltip contentStyle={tooltip} />
                      <Legend />
                      <Bar
                        isAnimationActive={animate}
                        animationDuration={220}
                        dataKey="planned"
                        name="План, мин"
                        fill="#658872"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        isAnimationActive={animate}
                        animationDuration={220}
                        dataKey="focus"
                        name="Фокус, мин"
                        fill="#94dbae"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Свободный горизонт">
                  Назначьте дату задаче и её длительность.
                </EmptyState>
              )}
            </section>
            <section>
              <h3>Эффективность по дням недели</h3>
              <p className="hint">
                Среднее Daily Score по дням с наблюдениями; будущие дни
                исключены.
              </p>
              {data.weekdays.some((d) => d.score !== null) ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weekdays}>
                      <XAxis dataKey="name" stroke="#8ca294" />
                      <YAxis domain={[0, 100]} stroke="#8ca294" />
                      <Tooltip contentStyle={tooltip} />
                      <Bar
                        isAnimationActive={animate}
                        animationDuration={220}
                        dataKey="score"
                        name="Средний индекс"
                        fill="#92cba3"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Нужны наблюдения" />
              )}
            </section>
            <section>
              <h3>Что получает внимание</h3>
              {breakdown.length ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        isAnimationActive={animate}
                        animationDuration={220}
                        data={breakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={3}
                      >
                        {breakdown.map((b, i) => (
                          <Cell key={b.name} fill={colors[i % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltip} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Категории без завершений" />
              )}
            </section>
            <section className="obs-insight-full">
              <div className="sectionhead">
                <h3>Календарь активности</h3>
                <small>Наведите на день для подробностей</small>
              </div>
              <div className="obs-months">
                {data.months.map((month) => (
                  <div key={month.month}>
                    <strong>
                      {new Date(month.month + "-01T12:00Z").toLocaleDateString(
                        "ru-RU",
                        { month: "long", year: "numeric", timeZone: "UTC" },
                      )}
                    </strong>
                    <div className="obs-heatmap">
                      {month.days.map((d) => (
                        <span
                          key={d.date}
                          tabIndex={0}
                          title={`${d.date}: ${d.done} задач, ${d.focus} мин фокуса`}
                          aria-label={`${d.date}: ${d.done} задач, ${d.focus} минут фокуса`}
                          style={activityColor(d.done, d.focus)}
                        >
                          {Number(d.date.slice(-2))}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3>Проекты · текущий прогресс</h3>
              <p className="hint">
                Взвешен по оценке × весу задачи; с учётом выбранной категории.
              </p>
              {projects
                .filter((p) => !project || p.id === project)
                .map((p) => {
                  const tasks = filtered.items.filter(
                    (t) => t.kind === "task" && t.projectId === p.id,
                  );
                  const total = tasks.reduce(
                      (a, t) => a + t.estimate * t.weight,
                      0,
                    ),
                    done = tasks
                      .filter((t) => t.status === "done")
                      .reduce((a, t) => a + t.estimate * t.weight, 0);
                  return (
                    <div className="obs-project-progress" key={p.id}>
                      <div className="sectionhead">
                        <strong>{p.title}</strong>
                        <span>
                          {total ? Math.round((done / total) * 100) + "%" : "—"}
                        </span>
                      </div>
                      <div className="progress">
                        <i
                          style={{
                            width: `${total ? (done / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <small>
                        {tasks
                          .filter((t) => t.status !== "done")
                          .reduce((a, t) => a + t.estimate, 0)}{" "}
                        мин осталось · {p.due ?? "без срока"}
                      </small>
                    </div>
                  );
                })}
              {!projects.length && <EmptyState title="Проекты ещё впереди" />}
            </section>
            <section>
              <h3>Движение за период</h3>
              <div className="obs-comparisons">
                <div>
                  <small>Тренировки</small>
                  <strong>
                    {data.fitness.done.length} / {data.fitness.planned.length}
                  </strong>
                </div>
                <div>
                  <small>Дистанция</small>
                  <strong>{data.fitness.distance.toFixed(1)} км</strong>
                </div>
                <div>
                  <small>Объём</small>
                  <strong>{Math.round(data.fitness.volume)} кг</strong>
                </div>
                <div>
                  <small>Время</small>
                  <strong>{data.fitness.duration} мин</strong>
                </div>
              </div>
              <p className="hint">
                Факт только завершённых тренировок и подтверждённых подходов.
                При фильтре проекта/категории тренировки без этой связи
                исключаются.
              </p>
              <h3>Ближайшая точка внимания</h3>
              {data.overdue.slice(0, 8).map((t) => (
                <div className="sessionrow" key={t.id}>
                  <strong>{t.title}</strong>
                  <span className="overdue">{t.due}</span>
                </div>
              ))}
              {!data.overdue.length && (
                <p className="muted">
                  Нет открытых просроченных задач со сроком в выбранном периоде.
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
