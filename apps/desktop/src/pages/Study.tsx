import { StudyGroupEditor } from "../features/StudyGroupEditor";
import type { StudyGroup } from "../../../../packages/contracts";
import { useState } from "react";
import { Empty, Modal } from "../shared/ui";
import type { PageProps } from "../shared/model";
export function Study({ s, command }: PageProps) {
  const [editingGroup, setEditingGroup] = useState<StudyGroup | null>(null);
  const [filter, setFilter] = useState("all");
  const [subject, setSubject] = useState<
    import("../../../../packages/contracts").Subject | null
  >(null);
  const [group, setGroup] = useState(false);
  const [groupSubject, setGroupSubject] = useState(s.subjects[0]?.id ?? "");
  const [groupName, setGroupName] = useState("");
  const [stageNames, setStageNames] = useState("Выполнена,Защищена");
  const [count, setCount] = useState(1);
  const all = s.groups.flatMap((g) => g.values.flat());
  return (
    <>
      <div className="toolbar">
        <button
          className="primary"
          onClick={() =>
            setSubject({
              id: crypto.randomUUID(),
              name: "",
              rkDone: 0,
              rkTotal: 0,
              hwDone: 0,
              hwTotal: 0,
              exam: null,
              grade: null,
            })
          }
        >
          + Добавить предмет
        </button>
        <button onClick={() => setGroup(true)} disabled={!s.subjects.length}>
          + Добавить работы
        </button>
        <button
          onClick={() => void command({ type: "file", action: "studyExport" })}
        >
          Экспорт Excel
        </button>
        <button
          onClick={() => void command({ type: "file", action: "studyImport" })}
        >
          Импорт Excel
        </button>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Все этапы</option>
          <option value="unfinished">Только незавершённые</option>
          <option value="defend">Нуждаются в защите</option>
        </select>
        <button onClick={() => void command({ type: "undo" })}>
          Отменить отметку
        </button>
        {!s.subjects.length && (
          <button onClick={() => void command({ type: "importStudy" })}>
            Импортировать референс
          </button>
        )}
      </div>
      <div className="studyinfo">
        <span>✓ Выполнено: {all.filter((x) => x === "done").length}</span>
        <span>
          − Известно не выполнено: {all.filter((x) => x === "not_done").length}
        </span>
        <span>? Неизвестно: {all.filter((x) => x === "unknown").length}</span>
        <small>Клик: ✓ / − · Alt+клик или правая кнопка: ?</small>
      </div>
      <div className="studygrid">
        <section>
          <div className="sectionhead">
            <h3>Сводка по предметам</h3>
            <small>РК / ДЗ — исходные агрегаты</small>
          </div>
          <div className="tablewrap">
            <table className="summary">
              <thead>
                <tr>
                  {[
                    "Предмет",
                    "РК написано",
                    "РК всего",
                    "ДЗ сдано",
                    "ДЗ всего",
                    "Экз",
                    "Итог",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.subjects.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <button
                        className="textbutton subjectname"
                        onClick={() => setSubject(x)}
                      >
                        {x.name}
                      </button>
                      <div className="progress">
                        <i
                          style={{
                            width:
                              (x.rkTotal + x.hwTotal
                                ? ((x.rkDone + x.hwDone) /
                                    (x.rkTotal + x.hwTotal)) *
                                  100
                                : 0) + "%",
                          }}
                        />
                      </div>
                    </td>
                    {(["rkDone", "rkTotal", "hwDone", "hwTotal"] as const).map(
                      (k) => (
                        <td key={k}>
                          <button
                            className="cellcount"
                            aria-label={`${x.name} ${k}`}
                            onClick={() => setSubject(x)}
                          >
                            {x[k]}
                          </button>
                        </td>
                      ),
                    )}
                    <td>{x.exam ?? "—"}</td>
                    <td>{x.grade ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!s.subjects.length && (
            <Empty>Добавьте предмет или импортируйте учебный прогресс</Empty>
          )}
          <p className="hint">
            Нажмите на предмет или число, чтобы изменить количество и оценки.
            Детальные этапы справа не прибавляются к исходным агрегатам.
          </p>
        </section>
        <div className="studydetails">
          {s.groups.map((g) => (
            <section key={g.id}>
              <div className="sectionhead">
                <h3>{g.name}</h3>
                <div className="row">
                  <small>
                    {g.values.flat().filter((v) => v === "done").length}/
                    {g.values.flat().length} этапов
                  </small>
                  <button
                    aria-label={"Редактировать " + g.name}
                    onClick={() => setEditingGroup(g)}
                  >
                    Изменить
                  </button>
                </div>
              </div>
              <div className="tablewrap">
                <table className="stages">
                  <thead>
                    <tr>
                      <th>Этап / работа</th>
                      {g.values[0]?.map((_, i) => (
                        <th key={i}>№{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.stages.map((stage, row) => {
                      if (
                        filter === "defend" &&
                        !stage.toLowerCase().includes("защи")
                      )
                        return null;
                      if (
                        filter !== "all" &&
                        g.values[row].every((x) => x === "done")
                      )
                        return null;
                      return (
                        <tr key={row}>
                          <th>{stage}</th>
                          {g.values[row].map((v, col) => (
                            <td key={col}>
                              <button
                                title={`${g.name} №${col + 1} — ${stage}: ${v === "done" ? "выполнено" : v === "not_done" ? "не выполнено" : "неизвестно"}`}
                                aria-label={`${g.name} №${col + 1} ${stage}`}
                                data-cell={`${g.id}-${row}-${col}`}
                                aria-description={
                                  v === "done"
                                    ? "Выполнено"
                                    : v === "not_done"
                                      ? "Не выполнено"
                                      : "Неизвестно"
                                }
                                onKeyDown={(e) => {
                                  const shifts: Record<
                                    string,
                                    [number, number]
                                  > = {
                                    ArrowUp: [-1, 0],
                                    ArrowDown: [1, 0],
                                    ArrowLeft: [0, -1],
                                    ArrowRight: [0, 1],
                                  };
                                  const shift = shifts[e.key];
                                  if (shift) {
                                    e.preventDefault();
                                    document
                                      .querySelector<HTMLButtonElement>(
                                        `[data-cell="${g.id}-${Math.min(g.stages.length - 1, Math.max(0, row + shift[0]))}-${Math.min(g.values[0].length - 1, Math.max(0, col + shift[1]))}"]`,
                                      )
                                      ?.focus();
                                  }
                                  if (e.key === "?") {
                                    e.preventDefault();
                                    void command({
                                      type: "stage",
                                      groupId: g.id,
                                      row,
                                      column: col,
                                      status: "unknown",
                                    });
                                  }
                                }}
                                className={"stage " + v}
                                onClick={(e) =>
                                  void command({
                                    type: "stage",
                                    groupId: g.id,
                                    row,
                                    column: col,
                                    status: e.altKey
                                      ? "unknown"
                                      : v === "done"
                                        ? "not_done"
                                        : "done",
                                  })
                                }
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  void command({
                                    type: "stage",
                                    groupId: g.id,
                                    row,
                                    column: col,
                                    status: "unknown",
                                  });
                                }}
                              >
                                {v === "done"
                                  ? "✓"
                                  : v === "not_done"
                                    ? "−"
                                    : "?"}
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
      {editingGroup && (
        <StudyGroupEditor
          s={s}
          command={command}
          group={editingGroup}
          close={() => setEditingGroup(null)}
        />
      )}
      {subject && (
        <Modal
          title="Предмет · количество и оценки"
          onClose={() => setSubject(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                subject.rkDone > subject.rkTotal ||
                subject.hwDone > subject.hwTotal
              )
                return;
              await command({ type: "subject", subject });
              setSubject(null);
            }}
          >
            <label className="field">
              Название
              <input
                required
                value={subject.name}
                onChange={(e) =>
                  setSubject({ ...subject, name: e.target.value })
                }
              />
            </label>
            <div className="formgrid">
              {(["rkDone", "rkTotal", "hwDone", "hwTotal"] as const).map(
                (k, i) => (
                  <label className="field" key={k}>
                    {["РК написано", "РК всего", "ДЗ сдано", "ДЗ всего"][i]}
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={subject[k]}
                      onChange={(e) =>
                        setSubject({ ...subject, [k]: Number(e.target.value) })
                      }
                    />
                  </label>
                ),
              )}
              {(["exam", "grade"] as const).map((k, i) => (
                <label key={k} className="field">
                  {i ? "Итог" : "Экзамен"}
                  <input
                    value={subject[k] ?? ""}
                    onChange={(e) =>
                      setSubject({ ...subject, [k]: e.target.value || null })
                    }
                  />
                </label>
              ))}
            </div>
            <button className="primary">Сохранить</button>
            <button
              type="button"
              className="danger"
              onClick={async () => {
                if (
                  window.confirm("Удалить предмет и все его детальные работы?")
                ) {
                  await command({ type: "removeSubject", id: subject.id });
                  setSubject(null);
                }
              }}
            >
              Удалить предмет
            </button>
          </form>
        </Modal>
      )}
      {group && (
        <Modal
          title="Новая группа подробных работ"
          onClose={() => setGroup(false)}
        >
          <p className="hint">
            Это самостоятельные этапы. Они не меняют исходные агрегаты РК/ДЗ и
            не удваивают их.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await command({
                type: "addGroup",
                subjectId: groupSubject || s.subjects[0].id,
                name: groupName,
                stages: stageNames
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                count,
              });
              setGroup(false);
            }}
          >
            <label className="field">
              Предмет
              <select
                value={groupSubject || s.subjects[0]?.id}
                onChange={(e) => setGroupSubject(e.target.value)}
              >
                {s.subjects.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Название группы
              <input
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </label>
            <label className="field">
              Этапы через запятую
              <input
                required
                value={stageNames}
                onChange={(e) => setStageNames(e.target.value)}
              />
            </label>
            <label className="field">
              Количество работ
              <input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <button className="primary">
              Создать с неизвестными статусами
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
