import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import type { Item } from "../../../../packages/contracts";
import { newItem } from "../../../../packages/core";
import { Empty } from "../shared/ui";
import type { PageProps } from "../shared/model";
export function Notes({
  s,
  command,
  remove,
}: PageProps & { remove: (i: Item) => Promise<void> }) {
  const notes = s.items.filter((i) => i.kind === "note");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<Item | null>(null);
  const [preview, setPreview] = useState(false);
  const item = notes.find((i) => i.id === selected) ?? notes[0];
  useEffect(() => {
    setDraft(item ?? null);
  }, [item?.id, item?.description, item?.title, item?.tags]);
  useEffect(() => {
    if (!draft || !item || JSON.stringify(draft) === JSON.stringify(item))
      return;
    const t = setTimeout(
      () => void command({ type: "save", item: draft }).catch(() => {}),
      600,
    );
    return () => clearTimeout(t);
  }, [draft, item, command]);
  return (
    <div className="notesgrid">
      <section className="notelist">
        <button
          className="primary"
          onClick={async () => {
            const n = newItem("note", "Новая заметка");
            await command({ type: "save", item: n });
            setSelected(n.id);
          }}
        >
          + Заметка
        </button>
        <input
          placeholder="Поиск заметок…"
          style={{ width: "100%", margin: "15px 0" }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {notes
          .filter((n) =>
            (n.title + n.description + n.tags)
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .map((n) => (
            <button key={n.id} onClick={() => setSelected(n.id)}>
              {n.title}
            </button>
          ))}
      </section>
      <section>
        {draft ? (
          <>
            <input
              aria-label="Название заметки"
              value={draft.title}
              style={{ width: "100%", fontSize: 20 }}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <div className="toolbar" style={{ marginTop: 16 }}>
              <button onClick={() => setPreview(!preview)}>
                {preview ? "Редактор" : "Предпросмотр"}
              </button>
              <span className="muted">Автосохранение · Markdown</span>
            </div>
            {preview ? (
              <div className="markdown">
                <Markdown
                  skipHtml
                  components={{
                    img: () => null,
                    a: ({ children }) => <span>{children}</span>,
                  }}
                >
                  {draft.description}
                </Markdown>
              </div>
            ) : (
              <textarea
                aria-label="Текст заметки"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            )}
          </>
        ) : (
          <Empty>Создайте заметку. Текст сохраняется автоматически.</Empty>
        )}
      </section>
      <section>
        <h3>Свойства</h3>
        {draft && (
          <>
            <label className="field">
              Теги
              <input
                value={draft.tags}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              />
            </label>
            <label className="field">
              Связанный проект
              <select
                value={draft.projectId ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, projectId: e.target.value || null })
                }
              >
                <option value="">Без проекта</option>
                {s.items
                  .filter((i) => i.kind === "project")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </label>
            <p className="hint">
              HTML и удалённые изображения не исполняются и не загружаются.
            </p>
            <button
              onClick={async () => {
                await command({ type: "save", item: draft });
                await command({
                  type: "file",
                  action: "exportNote",
                  id: draft.id,
                });
              }}
            >
              Экспорт .md
            </button>
            <button className="danger" onClick={() => void remove(draft)}>
              Удалить
            </button>
          </>
        )}
      </section>
    </div>
  );
}
