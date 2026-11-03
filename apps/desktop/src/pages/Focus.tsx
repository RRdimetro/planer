import { useState } from "react";
import { Maximize2, Leaf, Coffee, Target } from "lucide-react";
import { MetricCard, EmptyState } from "../design/components";
import { dateInZone } from "../../../../packages/core";
import type { PageProps } from "../shared/model";
export function Focus({ s, command }: PageProps) {
  const current = s.sessions.find((x) =>
    ["running", "paused", "interrupted"].includes(x.state),
  );
  const [task, setTask] = useState("");
  const mode = String(s.settings.focusMode ?? "pomodoro");
  const zone = String(s.settings.timezone ?? "Europe/Moscow");
  const today = dateInZone(zone);
  const work = s.sessions.filter((x) => x.kind !== "break");
  const todayWork = work.filter(
    (x) => dateInZone(zone, new Date(x.startedAt)) === today,
  );
  const minutes = (xs: typeof work) =>
    Math.floor(xs.reduce((a, x) => a + x.seconds, 0) / 60);
  const seconds = current
    ? current.target
      ? Math.max(0, current.target - current.seconds)
      : current.seconds
    : Number(
        mode === "break"
          ? (s.settings.breakMinutes ?? 5)
          : mode === "free"
            ? 0
            : (s.settings.pomodoro ?? 25),
      ) * 60;
  const setting = (
    key: "focusMode" | "breakMinutes" | "pomodoro",
    value: string | number,
  ) => void command({ type: "settings", key, value });
  return (
    <div className="obs-focus-layout">
      <section className="obs-focus-stage">
        <div className="sectionhead">
          <span className="eyebrow">DEEP WORK / ОДНА ЗАДАЧА</span>
          <button
            aria-label="Полноэкранный фокус"
            onClick={() => void command({ type: "file", action: "fullscreen" })}
          >
            <Maximize2 size={16} />
          </button>
        </div>
        <div className="obs-focus-mark">
          {(current?.kind ?? (mode === "break" ? "break" : "work")) ===
          "break" ? (
            <Coffee size={30} />
          ) : (
            <Leaf size={30} />
          )}
        </div>
        <h2>
          {current?.kind === "break" || (!current && mode === "break")
            ? "Время выдохнуть"
            : "Пространство для главного"}
        </h2>
        <div className="toolbar" style={{ justifyContent: "center" }}>
          <select
            aria-label="Режим фокуса"
            disabled={!!current}
            value={mode}
            onChange={(e) => setting("focusMode", e.target.value)}
          >
            <option value="pomodoro">Pomodoro</option>
            <option value="free">Свободный таймер</option>
            <option value="break">Перерыв</option>
          </select>
          {mode !== "free" && (
            <label>
              Минут{" "}
              <input
                aria-label="Длительность фокуса"
                type="number"
                min="1"
                max={mode === "break" ? 60 : 180}
                disabled={!!current}
                value={Number(
                  mode === "break"
                    ? (s.settings.breakMinutes ?? 5)
                    : (s.settings.pomodoro ?? 25),
                )}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n <= (mode === "break" ? 60 : 180))
                    setting(mode === "break" ? "breakMinutes" : "pomodoro", n);
                }}
              />
            </label>
          )}
        </div>
        <div
          className="obs-focus-dial"
          style={
            {
              "--focus-angle": `${current?.target ? Math.min(360, (current.seconds / current.target) * 360) : 0}deg`,
            } as React.CSSProperties
          }
        >
          <div className="clock" role="timer" aria-label="Время сессии">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}
            <span>:</span>
            {String(Math.floor(seconds % 60)).padStart(2, "0")}
          </div>
        </div>
        <p className="muted">
          {current
            ? current.state === "running"
              ? "Сессия идёт"
              : current.state === "interrupted"
                ? "Сессия прервана — продолжите или завершите"
                : "Пауза"
            : "Отключите лишнее. Начните с одного шага."}
        </p>
        {current ? (
          <p className="obs-focus-task">
            <Target size={15} />
            {s.items.find((t) => t.id === current.taskId)?.title ??
              (current.kind === "break" ? "Восстановление" : "Свободный фокус")}
          </p>
        ) : (
          mode !== "break" && (
            <select
              aria-label="Задача фокуса"
              value={task}
              onChange={(e) => setTask(e.target.value)}
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
          )
        )}
        <div
          className="row"
          style={{ marginTop: 24, justifyContent: "center" }}
        >
          {!current ? (
            <button
              className="primary"
              onClick={() =>
                void command({
                  type: "focusStart",
                  taskId: mode === "break" ? null : task || null,
                  target:
                    mode === "free"
                      ? 0
                      : Number(
                          mode === "break"
                            ? (s.settings.breakMinutes ?? 5)
                            : (s.settings.pomodoro ?? 25),
                        ) * 60,
                  kind: mode === "break" ? "break" : "work",
                })
              }
            >
              {mode === "break" ? "Начать перерыв" : "Начать фокус"}
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
          Таймер работает при переходах и сворачивании. Сон компьютера
          исключается. После закрытия незавершённую сессию можно продолжить.
        </p>
      </section>
      <div className="obs-focus-insights">
        <div className="kpis">
          <MetricCard
            label="Фокус сегодня"
            value={`${minutes(todayWork)} мин`}
            hint={`${todayWork.filter((x) => x.state === "done").length} завершённых сессий`}
          />
          <MetricCard
            label="Накоплено"
            value={`${minutes(work)} мин`}
            hint="Перерывы исключены"
          />
        </div>
        <section>
          <div className="sectionhead">
            <h3>Журнал концентрации</h3>
            <span className="badge">{s.sessions.length}</span>
          </div>
          <div className="obs-session-history">
            {s.sessions
              .slice()
              .reverse()
              .map((x) => (
                <div className="sessionrow" key={x.id}>
                  <div>
                    <strong>
                      {x.kind === "break"
                        ? "Перерыв"
                        : (s.items.find((t) => t.id === x.taskId)?.title ??
                          "Свободный фокус")}
                    </strong>
                    <small>
                      {new Date(x.startedAt).toLocaleString("ru-RU", {
                        timeZone: zone,
                      })}{" "}
                      ·{" "}
                      {
                        {
                          done: "Завершена",
                          interrupted: "Прервана",
                          paused: "Пауза",
                          running: "Идёт",
                        }[x.state]
                      }
                    </small>
                  </div>
                  <strong>
                    {Math.floor(x.seconds / 60)}:
                    {String(Math.floor(x.seconds % 60)).padStart(2, "0")}
                  </strong>
                </div>
              ))}
            {!s.sessions.length && (
              <EmptyState
                title="Первый тихий час"
                action={() =>
                  void command({
                    type: "focusStart",
                    taskId: null,
                    target: 1500,
                  })
                }
                label="Начать 25 минут"
              >
                Время появится после начала реальной сессии.
              </EmptyState>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
