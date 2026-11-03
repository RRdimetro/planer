import type { Item, State } from "../../../../packages/contracts";
import { addDays } from "../../../../packages/core";
import { EmptyState } from "../design/components";
export function ProjectGantt({
  tasks,
  s,
  edit,
}: {
  tasks: Item[];
  s: State;
  edit: (i: Item) => void;
}) {
  const planned = tasks.filter((t) => t.date);
  if (!planned.length)
    return (
      <EmptyState title="Назначьте даты задачам">
        Диаграмма появится по реальным датам и срокам.
      </EmptyState>
    );
  const min = planned.map((t) => t.date!).sort()[0],
    max = planned
      .map((t) =>
        t.due && t.due.slice(0, 10) > t.date! ? t.due.slice(0, 10) : t.date!,
      )
      .sort()
      .at(-1)!;
  const span = Math.max(1, (Date.parse(max) - Date.parse(min)) / 86400000);
  const x = (date: string) =>
    260 + ((Date.parse(date) - Date.parse(min)) / 86400000 / span) * 720;
  let top = 48;
  const rows = planned.map((t) => {
    const height = Math.max(48, Math.ceil(t.title.length / 30) * 18 + 12);
    const row = { t, top, height };
    top += height;
    return row;
  });
  const positions = new Map(rows.map((r) => [r.t.id, r]));
  return (
    <div className="obs-gantt">
      <p className="hint">
        Полоса: назначенная дата → срок; без срока — назначенный день. Связи
        показывают зависимости, а не автоматический прогноз.
      </p>
      <div className="tablewrap">
        <svg
          viewBox={`0 0 1020 ${top + 20}`}
          style={{ width: "100%", minWidth: 760 }}
          role="img"
          aria-label="Гантт задач проекта"
        >
          <defs>
            <marker
              id="gantt-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0 0 6 3 0 6" fill="#86b8d8" />
            </marker>
          </defs>
          {Array.from({ length: 7 }, (_, i) => {
            const date = addDays(min, Math.round((span * i) / 6));
            return (
              <g key={i}>
                <line
                  x1={x(date)}
                  x2={x(date)}
                  y1="34"
                  y2={top}
                  stroke="#a5cdb214"
                />
                <text
                  x={x(date)}
                  y="20"
                  textAnchor={i === 6 ? "end" : "start"}
                  fill="#9fb7a7"
                  fontSize="12"
                >
                  {date.slice(5)}
                </text>
              </g>
            );
          })}
          {rows.flatMap((r) =>
            (s.taskDetails[r.t.id]?.dependencies ?? []).flatMap((id) => {
              const from = positions.get(id);
              if (!from) return [];
              return (
                <path
                  key={r.t.id + id}
                  d={`M${x(from.t.date!) + 5} ${from.top + from.height / 2} H${x(r.t.date!) - 8} V${r.top + r.height / 2} H${x(r.t.date!)}`}
                  fill="none"
                  stroke="#86b8d880"
                  markerEnd="url(#gantt-arrow)"
                />
              );
            }),
          )}
          {rows.map((r) => (
            <g key={r.t.id}>
              <line
                x1="0"
                x2="1010"
                y1={r.top + r.height}
                y2={r.top + r.height}
                stroke="#a5cdb214"
              />
              <foreignObject x="0" y={r.top} width="245" height={r.height}>
                <div className="obs-gantt-title">
                  <button onClick={() => edit(r.t)}>{r.t.title}</button>
                </div>
              </foreignObject>
              <rect
                x={x(r.t.date!)}
                y={r.top + r.height / 2 - 10}
                width={Math.max(
                  7,
                  x(
                    r.t.due && r.t.due.slice(0, 10) > r.t.date!
                      ? r.t.due.slice(0, 10)
                      : r.t.date!,
                  ) - x(r.t.date!),
                )}
                height="20"
                rx="4"
                fill={r.t.status === "done" ? "#73d99b" : "#52775e"}
                role="button"
                tabIndex={0}
                aria-label={`${r.t.title}: ${r.t.date} — ${r.t.due ?? "без срока"}`}
                onClick={() => edit(r.t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    edit(r.t);
                  }
                }}
              >
                <title>{r.t.title}</title>
              </rect>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
