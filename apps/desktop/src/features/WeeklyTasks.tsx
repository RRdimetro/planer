import type { Item } from "../../../../packages/contracts";
import type { PageProps } from "../shared/model";
import {
  weekDays,
  localDate,
  newItem,
  addDays,
} from "../../../../packages/core";
export function WeeklyTasks({
  s,
  command,
  edit,
  row,
}: PageProps & { edit: (i: Item) => void; row: (i: Item) => React.ReactNode }) {
  const week = weekDays(String(s.settings.taskWeek ?? localDate()));
  const tasks = s.items.filter((i) => i.kind === "task");
  const undated = tasks.filter((i) => !i.date && i.status !== "done");
  const member = undated.filter(
    (i) => s.taskDetails[i.id]?.weeklyWeek === week[0],
  );
  const backlog = undated.filter((i) => !s.taskDetails[i.id]?.weeklyWeek);
  const move = (id: string, date: string) => {
    const item = tasks.find((i) => i.id === id);
    if (item)
      void command({
        type: "save",
        item: {
          ...item,
          date,
          status: item.status === "done" ? "done" : "today",
        },
      });
  };
  return (
    <>
      <div className="obs-toolbar">
        <button
          onClick={() =>
            void command({
              type: "settings",
              key: "taskWeek",
              value: addDays(week[0], -7),
            })
          }
        >
          ← Неделя
        </button>
        <label>
          Неделя{" "}
          <input
            aria-label="Неделя задач"
            type="date"
            value={week[0]}
            onChange={(e) =>
              void command({
                type: "settings",
                key: "taskWeek",
                value: weekDays(e.target.value)[0],
              })
            }
          />
        </label>
        <button
          onClick={() =>
            void command({
              type: "settings",
              key: "taskWeek",
              value: addDays(week[0], 7),
            })
          }
        >
          Неделя →
        </button>
      </div>
      <div className="obs-weekly">
        <section className="obs-week-backlog">
          <h3>Недельный backlog · {member.length}</h3>
          {member.map(row)}
          <button
            onClick={() =>
              edit({
                ...newItem("task", ""),
                status: "week",
                data: JSON.stringify({ weeklyWeekDraft: week[0] }),
              })
            }
          >
            + На неделю
          </button>
          <h3>Без недели · {backlog.length}</h3>
          {backlog.map((i) => (
            <div key={i.id}>
              {row(i)}
              <button
                onClick={() =>
                  void command({
                    type: "bulkTasks",
                    ids: [i.id],
                    patch: { status: "week", weeklyWeek: week[0] },
                  })
                }
              >
                На эту неделю →
              </button>
            </div>
          ))}
        </section>
        <div className="obs-week-days">
          {week.map((day) => (
            <section
              key={day}
              data-day={day}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => {
                e.currentTarget.dataset.dragover = "true";
              }}
              onDragLeave={(e) => {
                delete e.currentTarget.dataset.dragover;
              }}
              onDrop={(e) => {
                e.preventDefault();
                delete e.currentTarget.dataset.dragover;
                move(e.dataTransfer.getData("text/plain"), day);
              }}
            >
              <h3>
                {new Date(day + "T12:00:00Z").toLocaleDateString("ru-RU", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}
              </h3>
              {tasks.filter((i) => i.date === day).map(row)}
              <button
                className="addcolumn"
                onClick={() =>
                  edit({ ...newItem("task", ""), date: day, status: "today" })
                }
              >
                + Задача
              </button>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
