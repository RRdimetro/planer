import { useState } from "react";
import {
  Dumbbell,
  Plus,
  Flame,
  Route,
  Trophy,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type {
  Item,
  Program,
  WorkoutSet,
  State,
  Command,
} from "../../../../packages/contracts";
import {
  newItem,
  localDate,
  weekDays,
  addDays,
} from "../../../../packages/core";
import { fitnessMetrics } from "../../../../packages/analytics/fitness";
import { Empty, Modal, Field } from "../shared/ui";
import type { PageProps } from "../shared/model";
const tooltipStyle = {
  background: "#192b21",
  border: "1px solid #36513e",
  borderRadius: 8,
};
export function WorkoutForm({
  item,
  s,
  command,
  onClose,
}: {
  item: Item;
  s: State;
  command: (c: Command) => Promise<State | undefined>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Item>({
    ...item,
    date: item.date ?? localDate(),
    category: item.category || "strength",
    status: item.status === "done" ? "done" : "week",
  });
  const [programId, setProgramId] = useState(s.workoutPrograms[item.id] ?? "");
  const [sets, setSets] = useState<Omit<WorkoutSet, "workoutId">[]>(
    s.workoutSets.filter((x) => x.workoutId === item.id),
  );
  const [exerciseId, setExerciseId] = useState(s.exercises[0]?.id ?? "");
  const [error, setError] = useState("");
  const [newExercise, setNewExercise] = useState("");
  const set = (key: keyof Item, value: unknown) =>
    setDraft({ ...draft, [key]: value });
  const applyProgram = (id: string) => {
    if (
      sets.length &&
      !window.confirm(
        "Заменить текущий список подходов программой? Отметки выполнения не переносятся.",
      )
    )
      return;
    setProgramId(id);
    const program = s.programs.find((p) => p.id === id);
    if (program)
      setSets(
        program.exercises.flatMap((x) =>
          Array.from({ length: x.sets }, () => ({
            id: crypto.randomUUID(),
            exerciseId: x.exerciseId,
            reps: x.reps,
            weight: x.weight,
            done: false,
          })),
        ),
      );
  };
  return (
    <Modal title="Тренировка · план и факт" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await command({
              type: "saveWorkout",
              item: draft,
              programId: programId || null,
              sets,
            });
            onClose();
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <Field label="Название">
          <input
            autoFocus
            required
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <div className="formgrid">
          <Field label="Тип тренировки">
            <select
              value={draft.category || "strength"}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="strength">Силовая</option>
              <option value="running">Бег</option>
              <option value="other">Другое</option>
              {draft.category &&
                !["strength", "running", "other"].includes(draft.category) && (
                  <option value={draft.category}>{draft.category}</option>
                )}
            </select>
          </Field>
          <Field label="Состояние">
            <select
              aria-label="Состояние тренировки"
              value={draft.status === "done" ? "done" : "week"}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="week">Запланирована</option>
              <option value="done">Выполнена</option>
            </select>
          </Field>
          <Field label="Дата тренировки">
            <input
              required
              type="date"
              value={draft.date ?? localDate()}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Время тренировки">
            <input
              type="time"
              value={draft.time ?? ""}
              onChange={(e) => set("time", e.target.value || null)}
            />
          </Field>
          <Field label="План, минут">
            <input
              type="number"
              min="0"
              max="1440"
              value={draft.estimate}
              onChange={(e) => set("estimate", Number(e.target.value))}
            />
          </Field>
          <Field label="Факт, минут">
            <input
              aria-label="Факт, минут"
              type="number"
              min="0"
              max="10000"
              step="0.1"
              value={draft.duration}
              onChange={(e) => set("duration", Number(e.target.value))}
            />
          </Field>
          <Field label="Дистанция, км">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.distance ?? ""}
              onChange={(e) =>
                set(
                  "distance",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </Field>
          <Field label="Программа">
            <select
              aria-label="Программа тренировки"
              value={programId}
              onChange={(e) => applyProgram(e.target.value)}
            >
              <option value="">Без программы</option>
              {s.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {draft.distance && draft.duration > 0 ? (
          <p className="hint">
            Средний темп: {Math.floor(draft.duration / draft.distance)}:
            {String(
              Math.round(((draft.duration / draft.distance) % 1) * 60),
            ).padStart(2, "0")}{" "}
            мин/км
          </p>
        ) : (
          <p className="hint">
            Темп рассчитывается при наличии дистанции и фактического времени.
          </p>
        )}
        <h3 style={{ marginTop: 25 }}>Упражнения и подходы</h3>
        <div className="set-header">
          <span>Упражнение</span>
          <span>Повт.</span>
          <span>Вес, кг</span>
          <span>Факт</span>
          <span />
        </div>
        {sets.map((x, index) => (
          <div className="set-row" key={x.id}>
            <span>
              {s.exercises.find((e) => e.id === x.exerciseId)?.name ??
                "Упражнение"}{" "}
              <small>
                #
                {
                  sets
                    .slice(0, index + 1)
                    .filter((y) => y.exerciseId === x.exerciseId).length
                }
              </small>
            </span>
            <input
              aria-label={"Повторы " + (index + 1)}
              type="number"
              min="0"
              max="1000"
              value={x.reps}
              onChange={(e) =>
                setSets(
                  sets.map((y) =>
                    y.id === x.id ? { ...y, reps: Number(e.target.value) } : y,
                  ),
                )
              }
            />
            <input
              aria-label={"Вес " + (index + 1)}
              type="number"
              min="0"
              max="2000"
              step="0.5"
              value={x.weight}
              onChange={(e) =>
                setSets(
                  sets.map((y) =>
                    y.id === x.id
                      ? { ...y, weight: Number(e.target.value) }
                      : y,
                  ),
                )
              }
            />
            <input
              aria-label={"Подход выполнен " + (index + 1)}
              type="checkbox"
              checked={x.done}
              onChange={(e) =>
                setSets(
                  sets.map((y) =>
                    y.id === x.id ? { ...y, done: e.target.checked } : y,
                  ),
                )
              }
            />
            <button
              type="button"
              className="icon"
              aria-label={"Удалить подход " + (index + 1)}
              onClick={() => setSets(sets.filter((y) => y.id !== x.id))}
            >
              ×
            </button>
          </div>
        ))}
        <div className="row wrap" style={{ marginTop: 14 }}>
          <select
            aria-label="Выбрать упражнение"
            value={exerciseId || s.exercises[0]?.id || ""}
            onChange={(e) => setExerciseId(e.target.value)}
          >
            <option value="">Упражнение…</option>
            {s.exercises.map((e) => (
              <option value={e.id} key={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!exerciseId && !s.exercises.length}
            onClick={() =>
              setSets([
                ...sets,
                {
                  id: crypto.randomUUID(),
                  exerciseId: exerciseId || s.exercises[0].id,
                  reps: 10,
                  weight: 0,
                  done: false,
                },
              ])
            }
          >
            + Подход
          </button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <input
            placeholder="Новое упражнение…"
            aria-label="Новое упражнение"
            value={newExercise}
            onChange={(e) => setNewExercise(e.target.value)}
          />
          <button
            type="button"
            disabled={!newExercise.trim()}
            onClick={async () => {
              const id = crypto.randomUUID();
              await command({
                type: "exercise",
                value: { id, name: newExercise, muscleGroup: "" },
              });
              setExerciseId(id);
              setNewExercise("");
            }}
          >
            Создать упражнение
          </button>
        </div>
        <p className="hint">
          Программа заполняет только план подходов. Для статистики отметьте
          фактически выполненные подходы и завершите тренировку.
        </p>
        <Field label="Заметки о тренировке">
          <textarea
            rows={3}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" className="overdue">
            {error}
          </p>
        )}
        <button className="primary" type="submit">
          Сохранить тренировку
        </button>
      </form>
    </Modal>
  );
}
export function Fitness({
  s,
  command,
  edit,
  remove,
}: PageProps & {
  edit: (i: Item) => void;
  remove: (i: Item) => Promise<void>;
}) {
  const [date, setDate] = useState(localDate());
  const [range, setRange] = useState(90);
  const [program, setProgram] = useState<Program | null>(null);
  const [library, setLibrary] = useState(false);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseGroup, setExerciseGroup] = useState("");
  const [chosenExercise, setChosenExercise] = useState("");
  const m = fitnessMetrics(s, addDays(localDate(), 1 - range), localDate());
  const all = s.items.filter((i) => i.kind === "workout");
  const days = weekDays(date);
  const week = all.filter((w) => w.date && days.includes(w.date));
  const add = () =>
    edit({
      ...newItem("workout", ""),
      category: "strength",
      date,
      status: "week",
      estimate: 60,
    });
  const workout = (w: Item) => (
    <div className="fitness-log-row" key={w.id}>
      <div
        className={"workout-symbol " + (w.distance ? "running" : "strength")}
      >
        {w.distance ? <Route size={19} /> : <Dumbbell size={19} />}
      </div>
      <button className="textbutton grow" onClick={() => edit(w)}>
        <strong>{w.title}</strong>
        <small>
          {w.date ?? "Без даты"} · {w.duration} мин
          {w.distance ? " · " + w.distance + " км" : ""}
          {s.workoutPrograms[w.id]
            ? " · " +
              s.programs.find((p) => p.id === s.workoutPrograms[w.id])?.name
            : ""}
        </small>
      </button>
      <span className={"badge " + (w.status === "done" ? "" : "planned")}>
        {w.status === "done" ? "Выполнена" : "В плане"}
      </span>
      <button
        className="icon"
        aria-label={"Изменить тренировку " + w.title}
        onClick={() => edit(w)}
      >
        <Pencil size={14} />
      </button>
      <button
        className="icon"
        aria-label={"Удалить тренировку " + w.title}
        onClick={() => void remove(w)}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
  const chartExercise = m.chart.map((day) => {
    const ids = new Set(
      m.done.filter((w) => w.date === day.date).map((w) => w.id),
    );
    const sets = m.sets.filter(
      (x) =>
        ids.has(x.workoutId) &&
        (!chosenExercise || x.exerciseId === chosenExercise),
    );
    return {
      ...day,
      volume: sets.reduce((a, x) => a + x.reps * x.weight, 0),
      max: sets.length ? Math.max(...sets.map((x) => x.weight)) : 0,
    };
  });
  return (
    <>
      <div className="fitness-hero">
        <div>
          <span className="eyebrow">FITNESS STUDIO / ВАШ РИТМ</span>
          <h2>Сила в последовательности.</h2>
          <p>
            Планируйте нагрузку. Записывайте факт. Наблюдайте свой прогресс.
          </p>
        </div>
        <Activity size={94} />
        <button className="primary" onClick={add}>
          <Plus size={17} /> Записать тренировку
        </button>
      </div>
      <div className="toolbar">
        <select
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
        >
          {[7, 30, 90].map((n) => (
            <option key={n} value={n}>
              Последние {n} дней
            </option>
          ))}
        </select>
        <button onClick={() => setLibrary(true)}>
          <Dumbbell size={15} /> Упражнения
        </button>
        <button
          onClick={() =>
            setProgram({
              id: crypto.randomUUID(),
              name: "",
              description: "",
              exercises: [],
            })
          }
        >
          + Программа
        </button>
      </div>
      <div className="kpis fitness-kpis">
        {[
          [
            Flame,
            "Тренировок",
            m.done.length + " / " + m.planned.length,
            "факт / план",
          ],
          [
            Route,
            "Дистанция",
            m.distance.toFixed(1) + " км",
            "только завершённые",
          ],
          [
            Dumbbell,
            "Объём",
            Math.round(m.volume).toLocaleString("ru-RU") + " кг",
            "сумма вес × повторы",
          ],
          [
            Clock3Icon,
            "Время",
            m.duration + " мин",
            "фактическая длительность",
          ],
        ].map(([Icon, label, value, hint]) => {
          const I = Icon as typeof Flame;
          return (
            <div className="kpi" key={String(label)}>
              <span>
                <I size={17} />
                {String(label)}
              </span>
              <strong>{String(value)}</strong>
              <small>{String(hint)}</small>
            </div>
          );
        })}
      </div>
      <div className="fitness-layout">
        <section>
          <div className="sectionhead">
            <h3>
              <CalendarDays size={16} /> Неделя движения
            </h3>
            <div className="row">
              <button
                className="icon"
                aria-label="Предыдущая неделя тренировок"
                onClick={() => setDate(addDays(date, -7))}
              >
                <ChevronLeft size={17} />
              </button>
              <span className="muted">
                {days[0].slice(5)} — {days[6].slice(5)}
              </span>
              <button
                className="icon"
                aria-label="Следующая неделя тренировок"
                onClick={() => setDate(addDays(date, 7))}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
          <div className="fitness-week">
            {days.map((d) => (
              <div key={d} className={d === localDate() ? "is-today" : ""}>
                <span>
                  {new Date(d + "T12:00:00Z").toLocaleDateString("ru-RU", {
                    weekday: "short",
                    timeZone: "UTC",
                  })}
                </span>
                <strong>{Number(d.slice(-2))}</strong>
                {week
                  .filter((w) => w.date === d)
                  .map((w) => (
                    <button
                      key={w.id}
                      className={
                        w.status === "done" ? "workout-done" : "workout-planned"
                      }
                      onClick={() => edit(w)}
                      title={w.title}
                    >
                      {w.distance ? (
                        <Route size={14} />
                      ) : (
                        <Dumbbell size={14} />
                      )}
                      <small>{w.title}</small>
                    </button>
                  ))}
                {!week.some((w) => w.date === d) && (
                  <button
                    className="rest-day"
                    onClick={() =>
                      edit({
                        ...newItem("workout", ""),
                        date: d,
                        status: "week",
                        category: "strength",
                        estimate: 60,
                      })
                    }
                  >
                    + План
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="hint">
            Дни без запланированной тренировки — отдых. Они не считаются
            пропусками.
          </p>
        </section>
        <section className="program-panel">
          <div className="sectionhead">
            <h3>Мои программы</h3>
            <button
              className="icon"
              aria-label="Добавить программу"
              onClick={() =>
                setProgram({
                  id: crypto.randomUUID(),
                  name: "",
                  description: "",
                  exercises: [],
                })
              }
            >
              <Plus size={16} />
            </button>
          </div>
          {s.programs.map((p) => (
            <div className="program-card" key={p.id}>
              <button className="textbutton grow" onClick={() => setProgram(p)}>
                <Dumbbell size={18} />
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.exercises.length} упражнений ·{" "}
                    {p.exercises.reduce((a, x) => a + x.sets, 0)} подходов
                  </small>
                </div>
              </button>
              <button
                className="icon"
                aria-label={"Удалить программу " + p.name}
                onClick={() => {
                  if (
                    window.confirm(
                      "Удалить программу? История тренировок и подходов сохранится.",
                    )
                  )
                    void command({ type: "removeProgram", id: p.id });
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!s.programs.length && (
            <>
              <Empty>
                Сохраните набор упражнений и план подходов для следующих
                тренировок.
              </Empty>
              <button
                onClick={() =>
                  setProgram({
                    id: crypto.randomUUID(),
                    name: "",
                    description: "",
                    exercises: [],
                  })
                }
              >
                Создать программу
              </button>
            </>
          )}
        </section>
        <section>
          <div className="sectionhead">
            <h3>Объём силовой работы</h3>
            <select
              aria-label="График упражнения"
              value={chosenExercise}
              onChange={(e) => setChosenExercise(e.target.value)}
            >
              <option value="">Все упражнения</option>
              {s.exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          {m.sets.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartExercise}>
                  <CartesianGrid stroke="#294031" vertical={false} />
                  <XAxis dataKey="label" stroke="#7f9a89" fontSize={10} />
                  <YAxis stroke="#7f9a89" fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="volume"
                    name="Объём, кг"
                    fill="#73d69a"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>
              Запишите выполненные подходы — здесь появится график объёма.
            </Empty>
          )}
        </section>
        <section>
          <h3>Беговая дистанция</h3>
          {m.distance > 0 ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.chart}>
                  <CartesianGrid stroke="#294031" vertical={false} />
                  <XAxis dataKey="label" stroke="#7f9a89" fontSize={10} />
                  <YAxis stroke="#7f9a89" fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    dataKey="distance"
                    name="Дистанция, км"
                    stroke="#e8bd6a"
                    fill="#514226"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>Добавьте фактическую дистанцию завершённой пробежки.</Empty>
          )}
        </section>
        <section>
          <div className="sectionhead">
            <h3>Журнал тренировок</h3>
            <small>{all.length} записей</small>
          </div>
          {all
            .slice()
            .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
            .map(workout)}
          {!all.length && (
            <>
              <Empty>
                Запланируйте первую тренировку или запишите уже выполненную.
              </Empty>
              <button className="primary" onClick={add}>
                Добавить тренировку
              </button>
            </>
          )}
        </section>
        <section>
          <div className="sectionhead">
            <h3>
              <Trophy size={17} /> Персональные рекорды
            </h3>
            <span className="badge">Факт</span>
          </div>
          {m.records.map((r) => (
            <div className="record-row" key={r.exerciseId}>
              <div className="record-icon">
                <Trophy size={17} />
              </div>
              <div className="grow">
                <strong>{r.name}</strong>
                <small>
                  {r.bestReps} повт. · {r.sets} выполненных подходов
                </small>
                {r.estimated1RM && (
                  <small>
                    Расчётный 1ПМ: {r.estimated1RM.toFixed(1)} кг (Эпли, ≤12
                    повторов)
                  </small>
                )}
              </div>
              <strong>
                {r.maxWeight} <small>кг</small>
              </strong>
            </div>
          ))}
          {!m.records.length && (
            <Empty>
              Рекорды появятся после завершённой силовой тренировки с
              выполненными подходами.
            </Empty>
          )}
          <p className="hint">
            Рекорд — максимальный записанный вес. Расчётный 1ПМ является
            оценкой, а не измерением.
          </p>
        </section>
      </div>
      {library && (
        <Modal title="Справочник упражнений" onClose={() => setLibrary(false)}>
          {s.exercises.map((e) => (
            <div className="sessionrow" key={e.id}>
              <span>{e.name}</span>
              <small>{e.muscleGroup || "Группа не указана"}</small>
              <button
                className="icon"
                aria-label={"Переименовать " + e.name}
                onClick={() => {
                  const name = window.prompt("Название упражнения", e.name);
                  if (name?.trim())
                    void command({ type: "exercise", value: { ...e, name } });
                }}
              >
                <Pencil size={13} />
              </button>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await command({
                type: "exercise",
                value: {
                  id: crypto.randomUUID(),
                  name: exerciseName,
                  muscleGroup: exerciseGroup,
                },
              });
              setExerciseName("");
              setExerciseGroup("");
            }}
          >
            <Field label="Название упражнения">
              <input
                required
                value={exerciseName}
                onChange={(e) => setExerciseName(e.target.value)}
              />
            </Field>
            <Field label="Группа мышц">
              <input
                value={exerciseGroup}
                onChange={(e) => setExerciseGroup(e.target.value)}
              />
            </Field>
            <button className="primary">Добавить упражнение</button>
          </form>
        </Modal>
      )}
      {program && (
        <Modal title="Тренировочная программа" onClose={() => setProgram(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await command({ type: "program", value: program });
              setProgram(null);
            }}
          >
            <Field label="Название программы">
              <input
                required
                value={program.name}
                onChange={(e) =>
                  setProgram({ ...program, name: e.target.value })
                }
              />
            </Field>
            <Field label="Описание программы">
              <textarea
                value={program.description}
                onChange={(e) =>
                  setProgram({ ...program, description: e.target.value })
                }
              />
            </Field>
            {program.exercises.map((x, index) => (
              <div className="program-edit-row" key={x.id}>
                <Field label="Упражнение">
                  <select
                    value={x.exerciseId}
                    onChange={(e) =>
                      setProgram({
                        ...program,
                        exercises: program.exercises.map((y) =>
                          y.id === x.id
                            ? { ...y, exerciseId: e.target.value }
                            : y,
                        ),
                      })
                    }
                  >
                    {s.exercises.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {(["sets", "reps", "weight"] as const).map((k, i) => (
                  <Field key={k} label={["Подходы", "Повторы", "Кг"][i]}>
                    <input
                      type="number"
                      min={k === "weight" ? 0 : 1}
                      value={x[k]}
                      onChange={(e) =>
                        setProgram({
                          ...program,
                          exercises: program.exercises.map((y) =>
                            y.id === x.id
                              ? { ...y, [k]: Number(e.target.value) }
                              : y,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
                <button
                  type="button"
                  className="icon"
                  aria-label={"Удалить упражнение программы " + (index + 1)}
                  onClick={() =>
                    setProgram({
                      ...program,
                      exercises: program.exercises.filter((y) => y.id !== x.id),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            {!s.exercises.length && (
              <p className="hint">
                Сначала добавьте упражнения в справочник. Можно сохранить пустую
                программу и наполнить её позднее.
              </p>
            )}
            <button
              type="button"
              disabled={!s.exercises.length}
              onClick={() =>
                setProgram({
                  ...program,
                  exercises: [
                    ...program.exercises,
                    {
                      id: crypto.randomUUID(),
                      exerciseId: s.exercises[0].id,
                      sets: 3,
                      reps: 10,
                      weight: 0,
                    },
                  ],
                })
              }
            >
              + Упражнение программы
            </button>
            <button className="primary" style={{ marginTop: 18 }}>
              Сохранить программу
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Clock3Icon(props: { size?: number }) {
  return <Activity {...props} />;
}
