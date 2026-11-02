import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { State } from "../../../../packages/contracts";
import { metrics } from "../../../../packages/analytics";
import { localDate } from "../../../../packages/core";
import { Empty } from "../shared/ui";
export function Analytics({ s }: { s: State }) {
  const [range, setRange] = useState(30);
  const [end, setEnd] = useState(localDate());
  const [start, setStart] = useState(
    localDate(new Date(Date.now() - 29 * 86400000)),
  );
  const m = metrics(s, start, end);
  const days = Array.from(
    {
      length: Math.min(
        90,
        Math.max(
          1,
          Math.floor((Date.parse(end) - Date.parse(start)) / 86400000) + 1,
        ),
      ),
    },
    (_, i) => {
      const day = new Date(Date.parse(start) + i * 86400000)
        .toISOString()
        .slice(0, 10);
      return {
        day: day.slice(5),
        done: m.done.filter((t) => t.completedAt?.startsWith(day)).length,
        focus: Math.round(
          m.sessions
            .filter((x) => x.startedAt.startsWith(day))
            .reduce((a, x) => a + x.seconds / 60, 0),
        ),
      };
    },
  );
  return (
    <>
      <div className="toolbar">
        <select
          value={range}
          onChange={(e) => {
            const v = Number(e.target.value);
            setRange(v);
            setEnd(localDate());
            setStart(localDate(new Date(Date.now() - (v - 1) * 86400000)));
          }}
        >
          {[7, 30, 90].map((n) => (
            <option key={n} value={n}>
              {n} дней
            </option>
          ))}
        </select>
        <input
          type="date"
          value={start}
          max={end}
          onChange={(e) => setStart(e.target.value)}
        />
        <input
          type="date"
          value={end}
          min={start}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <div className="kpis">
        {[
          ["Завершено", m.done.length],
          ["Фокус", m.focusMinutes + " мин"],
          [
            "Тренировки",
            m.workouts.filter((w) => w.status === "done").length +
              " / " +
              m.workouts.length,
          ],
          ["Efficiency Score", m.score ?? "Недостаточно данных"],
        ].map(([k, v]) => (
          <div className="kpi" key={k}>
            <span>{k}</span>
            <strong
              style={{
                fontSize: typeof v === "string" && v.length > 15 ? 17 : 27,
              }}
            >
              {v}
            </strong>
          </div>
        ))}
      </div>
      <div className="chartgrid">
        <section>
          <h3>Завершённые задачи</h3>
          <p className="hint">
            Количество по дате завершения в выбранном диапазоне
          </p>
          {m.done.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days}>
                  <CartesianGrid stroke="#294031" vertical={false} />
                  <XAxis dataKey="day" stroke="#6f8a79" fontSize={10} />
                  <YAxis stroke="#6f8a79" allowDecimals={false} fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: "#192b21",
                      borderColor: "#2a4133",
                    }}
                  />
                  <Bar
                    dataKey="done"
                    name="Завершено"
                    fill="#73d69a"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>За этот период ещё нет завершённых задач</Empty>
          )}
        </section>
        <section>
          <h3>Фокус по дням</h3>
          {m.focusMinutes ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days}>
                  <CartesianGrid stroke="#294031" vertical={false} />
                  <XAxis dataKey="day" stroke="#6f8a79" fontSize={10} />
                  <YAxis stroke="#6f8a79" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: "#192b21",
                      borderColor: "#2a4133",
                    }}
                  />
                  <Area
                    dataKey="focus"
                    name="Минуты"
                    stroke="#73d69a"
                    fill="#234b31"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>Проведите первую фокус-сессию</Empty>
          )}
        </section>
        <section>
          <h3>Компоненты эффективности</h3>
          {[
            "Исходный план",
            "Своевременность",
            "Фокус / цель",
            "Точность оценки",
            "Запланированные тренировки",
          ].map((label, i) => (
            <div className="sessionrow" key={label}>
              <span>{label}</span>
              <span>
                {m.components[i] === null
                  ? "Нет наблюдений"
                  : Math.round(m.components[i]! * 100) + "%"}
              </span>
            </div>
          ))}
          <p className="hint">
            Веса:{" "}
            {((s.settings.weights as number[]) ?? [35, 25, 20, 10, 10]).join(
              " / ",
            )}
            . Компоненты без наблюдений исключаются; остальные веса
            перенормируются. Фокус — фактическое время / цель сессии.
          </p>
        </section>
        <section>
          <h3>Календарь завершений</h3>
          <div className="heatmap">
            {days.map((d) => (
              <span
                key={d.day}
                className={d.done ? "filled" : ""}
                title={`${d.day}: ${d.done}`}
              />
            ))}
          </div>
          <h3>Учебные этапы</h3>
          {s.groups.map((g) => (
            <div className="sessionrow" key={g.id}>
              <span>{g.name}</span>
              <span>
                {g.values.flat().filter((x) => x === "done").length} /{" "}
                {g.values.flat().length} · ?{" "}
                {g.values.flat().filter((x) => x === "unknown").length}
              </span>
            </div>
          ))}
          {!s.groups.length && <p className="muted">Нет учебных данных</p>}
        </section>
      </div>
    </>
  );
}
