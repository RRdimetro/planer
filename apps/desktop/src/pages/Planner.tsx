import React, { useState } from "react";
import type { Item } from "../../../../packages/contracts";
import {
  localDate,
  weekDays,
  newItem,
  distribute,
} from "../../../../packages/core";
import { Empty, Modal } from "../shared/ui";
import type { PageProps } from "../shared/model";
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
  const [date, setDate] = useState(localDate());
  const [view, setView] = useState("week");
  const [preview, setPreview] = useState<ReturnType<typeof distribute> | null>(
    null,
  );
  const days =
    view === "day"
      ? [date]
      : view === "month"
        ? Array.from(
            {
              length: new Date(
                Number(date.slice(0, 4)),
                Number(date.slice(5, 7)),
                0,
              ).getDate(),
            },
            (_, i) => date.slice(0, 8) + String(i + 1).padStart(2, "0"),
          )
        : weekDays(date);
  const tasks = s.items.filter((i) => i.kind === "task");
  return (
    <>
      <div className="toolbar">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select value={view} onChange={(e) => setView(e.target.value)}>
          <option value="day">День</option>
          <option value="week">Неделя</option>
          <option value="month">Месяц</option>
        </select>
        <button
          onClick={() =>
            edit({ ...newItem("event", ""), date, category: "personal event" })
          }
        >
          + Событие
        </button>
        <button
          onClick={() =>
            void command({ type: "snapshot", week: weekDays(date)[0] })
          }
        >
          Зафиксировать план недели
        </button>
        <button
          className="primary"
          onClick={() =>
            setPreview(
              distribute(
                tasks.filter((t) => !t.date && t.status !== "done"),
                s.items.filter(
                  (i) =>
                    i.date && ["task", "event", "workout"].includes(i.kind),
                ),
                weekDays(date),
                Number(s.settings.workStart ?? 9),
                Number(s.settings.workEnd ?? 18),
                Number(s.settings.dailyCapacity ?? 360),
              ),
            )
          }
        >
          Предложить распределение
        </button>
      </div>
      <div className="planner">
        <section className="backlog">
          <h3>На неделе · без дня</h3>
          {tasks.filter((t) => !t.date && t.status === "week").map(card)}
          <h3>Незапланированные</h3>
          {tasks
            .filter(
              (t) => !t.date && t.status !== "week" && t.status !== "done",
            )
            .map(card)}
          {!tasks.length && <Empty>Добавьте задачи в недельный список</Empty>}
        </section>
        <div
          className={"calendar " + (view === "month" ? "month" : "")}
          style={{
            gridTemplateColumns: `repeat(${view === "day" ? 1 : 7},minmax(0,1fr))`,
          }}
        >
          {days.map((d) => (
            <div
              key={d}
              className={"day " + (d === localDate() ? "today" : "")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const t = tasks.find(
                  (t) => t.id === e.dataTransfer.getData("text/plain"),
                );
                if (t) void save({ ...t, date: d, status: "today" });
              }}
            >
              <h3>
                {new Date(d + "T12:00:00").toLocaleDateString("ru-RU", {
                  weekday: "short",
                  day: "numeric",
                })}
              </h3>
              <small>
                {s.items
                  .filter((i) => i.date === d)
                  .reduce((a, t) => a + t.estimate, 0)}{" "}
                / {Number(s.settings.dailyCapacity ?? 360)} мин
              </small>
              {view !== "month" && (
                <div className="timeslots">
                  {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
                    <div
                      className="timeslot"
                      key={h}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        const t = tasks.find(
                          (t) => t.id === e.dataTransfer.getData("text/plain"),
                        );
                        if (t)
                          void save({
                            ...t,
                            date: d,
                            time: String(h).padStart(2, "0") + ":00",
                            status: "today",
                          });
                      }}
                    >
                      <button
                        className="slotlabel"
                        onClick={() =>
                          edit({
                            ...newItem("event", ""),
                            date: d,
                            time: String(h).padStart(2, "0") + ":00",
                          })
                        }
                      >
                        {String(h).padStart(2, "0")}:00
                      </button>
                      {s.items
                        .filter(
                          (t) =>
                            t.date === d &&
                            t.time &&
                            Number(t.time.slice(0, 2)) === h,
                        )
                        .map((t) => (
                          <button
                            key={t.id}
                            className="event"
                            onClick={() => edit(t)}
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData("text/plain", t.id)
                            }
                          >
                            {t.time} {t.title}
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              )}
              {s.items
                .filter((t) => t.date === d && (!t.time || view === "month"))
                .map(card)}
            </div>
          ))}
        </div>
      </div>
      {preview && (
        <Modal
          title="Предварительное распределение"
          onClose={() => setPreview(null)}
        >
          {preview.result.map((t) => (
            <p key={t.id}>
              {t.title} → {t.date} {t.time}
            </p>
          ))}
          <p className="muted">
            Не помещается: {preview.rejected.length}. Ограничения: часы работы,
            загрузка, приоритет, пересечения.
          </p>
          <button
            className="primary"
            onClick={async () => {
              await command({ type: "saveMany", items: preview.result });
              setPreview(null);
            }}
          >
            Применить {preview.result.length} назначений
          </button>
        </Modal>
      )}
    </>
  );
}
