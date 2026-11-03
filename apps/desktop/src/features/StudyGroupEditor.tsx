import { useState } from "react";
import type { StudyGroup } from "../../../../packages/contracts";
import type { PageProps } from "../shared/model";
import { Modal, Field } from "../shared/ui";
export function StudyGroupEditor({
  group,
  s,
  command,
  close,
}: PageProps & { group: StudyGroup; close: () => void }) {
  const [draft, setDraft] = useState<StudyGroup>(structuredClone(group));
  return (
    <Modal
      title="Редактировать группу работ"
      dirty={JSON.stringify(draft) !== JSON.stringify(group)}
      onClose={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await command({ type: "studyGroup", group: draft });
          close();
        }}
      >
        <Field label="Название группы">
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Количество работ">
          <input
            type="number"
            min={group.values[0].length}
            max="100"
            value={draft.values[0].length}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n < group.values[0].length || n > 100) return;
              setDraft({
                ...draft,
                values: draft.values.map((row) =>
                  Array.from({ length: n }, (_, c) => row[c] ?? "unknown"),
                ),
              });
            }}
          />
        </Field>
        {draft.stages.map((name, r) => (
          <Field key={r} label={`Этап ${r + 1}`}>
            <input
              required
              value={name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  stages: draft.stages.map((x, i) =>
                    i === r ? e.target.value : x,
                  ),
                })
              }
            />
          </Field>
        ))}
        <button
          type="button"
          disabled={draft.stages.length >= 20}
          onClick={() =>
            setDraft({
              ...draft,
              stages: [...draft.stages, "Новый этап"],
              values: [
                ...draft.values,
                Array(draft.values[0].length).fill("unknown"),
              ],
            })
          }
        >
          + Добавить этап
        </button>
        <p className="hint">
          Существующие работы и статусы сохраняются. Новые ячейки получают
          «неизвестно». Удаления старых этапов нет.
        </p>
        <button className="primary">Сохранить группу</button>
      </form>
      <h3 style={{ marginTop: 24 }}>Автоматический пересчёт РК / ДЗ</h3>
      <p className="hint">
        По умолчанию исходные агрегаты независимы. Привязка — явное изменение
        правила учёта; счётчик станет равен выбранному этапу этой группы.
      </p>
      {(["rk", "hw"] as const).map((kind) => {
        const current = s.studyBindings?.find(
          (b) => b.subjectId === group.subjectId && b.kind === kind,
        );
        return (
          <Field
            key={kind}
            label={
              kind === "rk" ? "РК: источник счётчика" : "ДЗ: источник счётчика"
            }
          >
            <select
              value={
                current?.groupId === group.id ? current.stageRow : "manual"
              }
              onChange={(e) => {
                const value = e.target.value;
                if (
                  !window.confirm(
                    value === "manual"
                      ? "Отключить автоматический пересчёт? Последние значения сохранятся."
                      : "Пересчитать агрегат по этому этапу? Исходный ручной счётчик будет изменён; действие можно отменить.",
                  )
                )
                  return;
                void command({
                  type: "studyBinding",
                  subjectId: group.subjectId,
                  kind,
                  groupId: value === "manual" ? null : group.id,
                  stageRow: value === "manual" ? 0 : Number(value),
                });
              }}
            >
              <option value="manual">Ручной / другой источник</option>
              {group.stages.map((stage, r) => (
                <option value={r} key={r}>
                  {stage}
                </option>
              ))}
            </select>
          </Field>
        );
      })}
    </Modal>
  );
}
