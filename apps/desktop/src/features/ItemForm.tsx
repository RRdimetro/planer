import { weekDays } from "../../../../packages/core";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  recordSchema,
  emptyTaskDetails,
  type TaskDetails,
  type State,
  type Command,
  type Item,
} from "../../../../packages/contracts";
import { ActivityHistory } from "../design/ActivityHistory";
import { ContextDrawer } from "../design/components";
import { Field, Modal } from "../shared/ui";
export function ItemForm({
  item,
  projects,
  onSave,
  onClose,
  state,
  command,
  presentation,
}: {
  item: Item;
  projects: Item[];
  onSave: (i: Item, details?: TaskDetails) => void | Promise<void>;
  state: State;
  command: (c: Command) => Promise<State | undefined>;
  onClose: () => void;
  presentation?: "sheet";
}) {
  const [eventFrequency, setEventFrequency] = useState<
    "none" | "daily" | "weekly" | "monthly"
  >("none");
  const [eventCount, setEventCount] = useState(4);
  const [eventInterval, setEventInterval] = useState(1);
  const [eventUntil, setEventUntil] = useState("");
  const EditorDialog = presentation ? ContextDrawer : Modal;
  const [details, setDetails] = useState<TaskDetails>(
    state.taskDetails[item.id] ?? {
      ...emptyTaskDetails(),
      weeklyWeek:
        item.status === "week"
          ? (safeDraftWeek(item.data) ?? weekDays()[0])
          : null,
    },
  );
  const initialDetails = useRef(JSON.stringify(details));
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Item>({
    resolver: zodResolver(recordSchema) as never,
    defaultValues: item,
  });
  return (
    <EditorDialog
      presentation={presentation}
      title={
        item.kind === "task"
          ? "Задача"
          : item.kind === "project"
            ? "Проект"
            : item.kind === "workout"
              ? "Тренировка"
              : "Событие"
      }
      busy={isSubmitting}
      dirty={
        isDirty ||
        JSON.stringify(details) !== initialDetails.current ||
        eventFrequency !== "none"
      }
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit(async (i) => {
          if (i.kind === "event" && eventFrequency !== "none") {
            await command({
              type: "saveEvent",
              item: i,
              recurrence: {
                frequency: eventFrequency,
                interval: eventInterval,
                until: eventUntil || null,
              },
              count: eventCount,
            });
            onClose();
          } else await onSave(i, item.kind === "task" ? details : undefined);
        })}
      >
        <Field label="Название">
          <input autoFocus {...register("title")} />
        </Field>
        <Field
          label={
            item.kind === "project"
              ? "Цель и описание проекта"
              : item.kind === "task"
                ? "Описание задачи"
                : "Описание события"
          }
        >
          <textarea rows={3} {...register("description")} />
        </Field>
        <div className="formgrid">
          <Field label="Статус">
            <select aria-label="Статус" {...register("status")}>
              {Object.entries({
                backlog: "Backlog",
                week: "На неделе",
                today: "Сегодня",
                active: "В процессе",
                done: "Готово",
              }).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Проект">
            <select
              aria-label="Проект"
              {...register("projectId", { setValueAs: (v) => v || null })}
            >
              <option value="">Без проекта</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Дата">
            <input
              type="date"
              {...register("date", { setValueAs: (v) => v || null })}
            />
          </Field>
          <Field label="Время">
            <input
              type="time"
              {...register("time", { setValueAs: (v) => v || null })}
            />
          </Field>
          <Field label="Дедлайн">
            <input
              type="date"
              {...register("due", { setValueAs: (v) => v || null })}
            />
          </Field>
          <Field label="Оценка, мин">
            <input
              type="number"
              min="0"
              {...register("estimate", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Приоритет 1–4">
            <input
              type="number"
              min="1"
              max="4"
              {...register("priority", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Вес">
            <input
              type="number"
              min="0.1"
              step="0.1"
              {...register("weight", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label={
              item.kind === "event"
                ? "Тип события"
                : "Категория / тип тренировки"
            }
          >
            {item.kind === "event" ? (
              <select aria-label="Тип события" {...register("category")}>
                <option value="personal">Личное событие</option>
                <option value="university">Пара</option>
                <option value="commute">Дорога</option>
                <option value="workout">Тренировка</option>
                <option value="focus">Фокус-блок</option>
              </select>
            ) : (
              <input {...register("category")} />
            )}
          </Field>
          <Field label="Теги">
            <input {...register("tags")} />
          </Field>
          {item.kind === "workout" && (
            <>
              <Field label="Фактическое время, мин">
                <input
                  type="number"
                  min="0"
                  {...register("duration", { valueAsNumber: true })}
                />
              </Field>
              <Field label="Дистанция, км">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("distance", {
                    setValueAs: (v) => (v === "" ? null : Number(v)),
                  })}
                />
              </Field>
            </>
          )}
        </div>
        {item.kind === "event" && (
          <section className="obs-event-repeat">
            <h3>Повторяющиеся события</h3>
            <label className="field">
              Повтор события
              <select
                aria-label="Повтор события"
                value={eventFrequency}
                onChange={(e) =>
                  setEventFrequency(e.target.value as typeof eventFrequency)
                }
              >
                <option value="none">Только это событие</option>
                <option value="daily">Каждый день</option>
                <option value="weekly">Каждую неделю</option>
                <option value="monthly">Каждый месяц</option>
              </select>
            </label>
            {eventFrequency !== "none" && (
              <div className="formgrid">
                <label className="field">
                  Интервал повторения
                  <input
                    aria-label="Интервал повторения событий"
                    type="number"
                    min="1"
                    max="365"
                    value={eventInterval}
                    onChange={(e) => setEventInterval(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Последняя дата серии
                  <input
                    aria-label="Последняя дата серии"
                    type="date"
                    min={watch("date") ?? undefined}
                    value={eventUntil}
                    onChange={(e) => setEventUntil(e.target.value)}
                  />
                </label>
              </div>
            )}
            {eventFrequency !== "none" && (
              <label className="field">
                Количество встреч
                <input
                  aria-label="Количество встреч"
                  type="number"
                  min="2"
                  max="104"
                  value={eventCount}
                  onChange={(e) => setEventCount(Number(e.target.value))}
                />
              </label>
            )}
            <p className="hint">
              При сохранении создаются отдельные встречи. Их можно переносить
              независимо; серия не перезаписывает исключения.
            </p>
          </section>
        )}
        {item.kind === "task" && (
          <div className="task-details-editor">
            <h3>Структура и повторение</h3>
            <div className="formgrid">
              <Field label="Родительская задача">
                <select
                  aria-label="Родительская задача"
                  value={details.parentId ?? ""}
                  onChange={(e) =>
                    setDetails({ ...details, parentId: e.target.value || null })
                  }
                >
                  <option value="">Самостоятельная задача</option>
                  {state.items
                    .filter((t) => t.kind === "task" && t.id !== item.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Недельный список">
                <input
                  type="date"
                  value={details.weeklyWeek ?? ""}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      weeklyWeek: e.target.value || null,
                    })
                  }
                />
              </Field>
              <Field label="Повтор">
                <select
                  value={details.recurrence?.frequency ?? "none"}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      recurrence:
                        e.target.value === "none"
                          ? null
                          : {
                              frequency: e.target.value as
                                "daily" | "weekly" | "monthly",
                              interval: 1,
                              until: null,
                            },
                    })
                  }
                >
                  <option value="none">Не повторять</option>
                  <option value="daily">По дням</option>
                  <option value="weekly">По неделям</option>
                  <option value="monthly">По месяцам</option>
                </select>
              </Field>
              {details.recurrence && (
                <>
                  <Field label="Интервал">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={details.recurrence.interval}
                      onChange={(e) =>
                        setDetails({
                          ...details,
                          recurrence: {
                            ...details.recurrence!,
                            interval: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Повторять до">
                    <input
                      type="date"
                      value={details.recurrence.until ?? ""}
                      onChange={(e) =>
                        setDetails({
                          ...details,
                          recurrence: {
                            ...details.recurrence!,
                            until: e.target.value || null,
                          },
                        })
                      }
                    />
                  </Field>
                </>
              )}
            </div>
            <Field label="Зависит от завершения">
              <select
                aria-label="Зависимости"
                multiple
                value={details.dependencies}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    dependencies: Array.from(e.target.selectedOptions).map(
                      (o) => o.value,
                    ),
                  })
                }
              >
                {state.items
                  .filter(
                    (t) =>
                      t.kind === "task" && t.id !== item.id && !t.deletedAt,
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            </Field>
            <h3>Чек-лист</h3>
            {details.checklist.map((c, index) => (
              <div className="row" key={c.id}>
                <input
                  type="checkbox"
                  aria-label={"Выполнен пункт " + (index + 1)}
                  checked={c.done}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      checklist: details.checklist.map((x) =>
                        x.id === c.id ? { ...x, done: e.target.checked } : x,
                      ),
                    })
                  }
                />
                <input
                  aria-label={"Пункт " + (index + 1)}
                  className="grow"
                  value={c.title}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      checklist: details.checklist.map((x) =>
                        x.id === c.id ? { ...x, title: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Удалить пункт"
                  onClick={() =>
                    setDetails({
                      ...details,
                      checklist: details.checklist.filter((x) => x.id !== c.id),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDetails({
                  ...details,
                  checklist: [
                    ...details.checklist,
                    { id: crypto.randomUUID(), title: "", done: false },
                  ],
                })
              }
            >
              + Пункт чек-листа
            </button>
            <p className="hint">
              Повтор создаёт новое выполнение после завершения текущего. История
              сохраняется.
            </p>
          </div>
        )}
        <div className="attachment-editor">
          <h3>Вложения</h3>
          {state.attachments
            .filter((a) => a.entityId === item.id)
            .map((a) => (
              <div className="row" key={a.id}>
                <span className="grow">
                  {a.name} <small>{(a.size / 1024).toFixed(1)} КБ</small>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void command({
                      type: "file",
                      action: "exportAttachment",
                      id: a.id,
                    })
                  }
                >
                  Сохранить файл
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Удалить вложение?"))
                      void command({ type: "removeAttachment", id: a.id });
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          <button
            type="button"
            disabled={!state.items.some((i) => i.id === item.id)}
            onClick={() =>
              void command({ type: "file", action: "attach", id: item.id })
            }
          >
            Прикрепить файл
          </button>
          {!state.items.some((i) => i.id === item.id) && (
            <p className="hint">
              Сначала сохраните запись, затем добавьте вложения. До 25 МБ на
              файл.
            </p>
          )}
        </div>
        {Object.keys(errors).length > 0 && (
          <p role="alert">Проверьте поля: {Object.keys(errors).join(", ")}</p>
        )}
        <button className="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Сохраняется…" : "Сохранить"}
        </button>
      </form>
      {item.kind === "task" && state.items.some((t) => t.id === item.id) && (
        <div className="rc-task-focus">
          <h3>Работа над задачей</h3>
          <button
            type="button"
            className="primary"
            disabled={state.sessions.some(
              (x) =>
                ["running", "paused", "interrupted"].includes(x.state) &&
                x.taskId !== item.id,
            )}
            onClick={() => {
              const active = state.sessions.find((x) =>
                ["running", "paused", "interrupted"].includes(x.state),
              );
              void command(
                active
                  ? {
                      type: "focusAction",
                      action: active.state === "running" ? "pause" : "resume",
                    }
                  : {
                      type: "focusStart",
                      taskId: item.id,
                      target: Number(state.settings.pomodoro ?? 25) * 60,
                    },
              );
            }}
          >
            {state.sessions.some(
              (x) => x.taskId === item.id && x.state === "running",
            )
              ? "Пауза фокуса"
              : state.sessions.some(
                    (x) =>
                      x.taskId === item.id &&
                      ["paused", "interrupted"].includes(x.state),
                  )
                ? "Продолжить фокус"
                : "Начать фокус"}
          </button>
          <p className="hint">
            Таймер связан с сохранённой задачей. Другую активную сессию сначала
            завершите в разделе «Фокус».
          </p>
        </div>
      )}
      {state.items.some((i) => i.id === item.id) && (
        <ActivityHistory id={item.id} />
      )}
    </EditorDialog>
  );
}

function safeDraftWeek(raw: string): string | undefined {
  try {
    const value = JSON.parse(raw)?.weeklyWeekDraft;
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
