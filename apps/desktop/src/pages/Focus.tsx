import { useState } from "react";
import { Empty } from "../shared/ui";
import type { PageProps } from "../shared/model";
export function Focus({ s, command }: PageProps) {
  const current = s.sessions.find((x) =>
    ["running", "paused", "interrupted"].includes(x.state),
  );
  const [task, setTask] = useState("");
  const [mode, setMode] = useState("pomodoro");
  const seconds = current
    ? current.target
      ? Math.max(0, current.target - current.seconds)
      : current.seconds
    : Number(s.settings.pomodoro ?? 25) * 60;
  return (
    <div className="chartgrid">
      <section className="timer">
        <div className="eyebrow">DEEP WORK / ВРЕМЯ ДЛЯ ГЛАВНОГО</div>
        <h2>В потоке</h2>
        <div className="toolbar" style={{ justifyContent: "center" }}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={!!current}
          >
            <option value="pomodoro">Pomodoro</option>
            <option value="free">Свободный режим</option>
          </select>
          <select
            value={task}
            onChange={(e) => setTask(e.target.value)}
            disabled={!!current}
          >
            <option value="">Без задачи</option>
            {s.items
              .filter((t) => t.kind === "task" && t.status !== "done")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </div>
        <div className="clock">
          {String(Math.floor(seconds / 60)).padStart(2, "0")}
          <span>:</span>
          {String(Math.floor(seconds % 60)).padStart(2, "0")}
        </div>
        <p className="muted">
          {current
            ? current.state === "running"
              ? "Сессия идёт"
              : current.state === "interrupted"
                ? "Сессия прервана — продолжить или завершить?"
                : "Пауза"
            : "Выберите задачу и начните с малого"}
        </p>
        <div className="row" style={{ marginTop: 28 }}>
          {!current ? (
            <button
              className="primary"
              onClick={() =>
                void command({
                  type: "focusStart",
                  taskId: task || null,
                  target:
                    mode === "free"
                      ? 0
                      : Number(s.settings.pomodoro ?? 25) * 60,
                })
              }
            >
              Начать фокус
            </button>
          ) : (
            <>
              <button
                className="primary"
                onClick={() =>
                  void command({
                    type: "focusAction",
                    action: current.state === "running" ? "pause" : "resume",
                  })
                }
              >
                {current.state === "running" ? "Пауза" : "Продолжить"}
              </button>
              <button
                onClick={() =>
                  void command({ type: "focusAction", action: "finish" })
                }
              >
                Завершить
              </button>
            </>
          )}
        </div>
        <p className="hint">
          Сон и длительные провалы системного таймера не добавляются к сессии.
          После закрытия незавершённая сессия помечается прерванной.
        </p>
      </section>
      <section>
        <h3>Последние сессии</h3>
        {s.sessions.length ? (
          s.sessions
            .slice()
            .reverse()
            .map((x) => (
              <div className="sessionrow" key={x.id}>
                <div>
                  {s.items.find((t) => t.id === x.taskId)?.title ??
                    "Свободный фокус"}
                  <small style={{ display: "block", marginTop: 5 }}>
                    {new Date(x.startedAt).toLocaleString("ru-RU")} ·{" "}
                    {x.state === "done"
                      ? "Завершена"
                      : x.state === "interrupted"
                        ? "Прервана"
                        : x.state === "paused"
                          ? "Пауза"
                          : "Идёт"}
                  </small>
                </div>
                <strong>{Math.floor(x.seconds / 60)} мин</strong>
              </div>
            ))
        ) : (
          <Empty>Здесь появится история реальных сессий</Empty>
        )}
      </section>
    </div>
  );
}
