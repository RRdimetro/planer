import { registerPending } from "../shared/pending";
import { useState, useEffect, useRef, useCallback } from "react";
import Markdown from "react-markdown";
import type { Item } from "../../../../packages/contracts";
import { newItem } from "../../../../packages/core";
import { Empty } from "../shared/ui";
import type { PageProps } from "../shared/model";
export function Notes({
  s,
  command,
  remove,
  requestedId,
}: PageProps & {
  remove: (i: Item) => Promise<void>;
  requestedId?: string | null;
}) {
  const notes = s.items.filter((i) => i.kind === "note");
  const [selected, setSelected] = useState<string | null>(requestedId ?? null);
  useEffect(() => {
    if (requestedId) setSelected(requestedId);
  }, [requestedId]);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<Item | null>(null);
  const [preview, setPreview] = useState(false);
  const item = notes.find((i) => i.id === selected) ?? notes[0];
  const latest = useRef<Item | null>(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (dirty.current && latest.current) {
      const value = {
        ...latest.current,
        title: latest.current.title.trim() || "Без названия",
      };
      dirty.current = false;
      saving.current = true;
      pending.current = pending.current
        .catch(() => {})
        .then(async () => {
          try {
            await command({ type: "save", item: value });
          } catch (e) {
            if (latest.current?.id === value.id) dirty.current = true;
            throw e;
          } finally {
            saving.current = false;
          }
        });
    }
    await pending.current;
  }, [command]);
  useEffect(() => {
    if (latest.current?.id === item?.id && (dirty.current || saving.current))
      return;
    latest.current = item ?? null;
    dirty.current = false;
    setDraft(item ?? null);
  }, [item?.id, item?.description, item?.title, item?.tags, item?.projectId]);
  useEffect(() => {
    const unregister = registerPending("notes", flush);
    return () => {
      unregister();
      void flush().catch(() => {});
    };
  }, [flush]);
  const changeDraft = (value: Item) => {
    latest.current = value;
    dirty.current = true;
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush().catch(() => {}), 400);
  };
  const choose = async (id: string) => {
    await flush();
    setSelected(id);
  };
  return (
    <div className="notesgrid">
      <section className="notelist">
        <button
          className="primary"
          onClick={async () => {
            await flush();
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
            <button key={n.id} onClick={() => void choose(n.id)}>
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
              onChange={(e) => changeDraft({ ...draft, title: e.target.value })}
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
                  changeDraft({ ...draft, description: e.target.value })
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
                onChange={(e) =>
                  changeDraft({ ...draft, tags: e.target.value })
                }
              />
            </label>
            <label className="field">
              Связанный проект
              <select
                value={draft.projectId ?? ""}
                onChange={(e) =>
                  changeDraft({ ...draft, projectId: e.target.value || null })
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
                await flush();
                await command({
                  type: "file",
                  action: "exportNote",
                  id: draft.id,
                });
              }}
            >
              Экспорт .md
            </button>
            <button
              className="danger"
              onClick={async () => {
                await flush();
                await remove(draft);
              }}
            >
              Удалить
            </button>
          </>
        )}
      </section>
    </div>
  );
}
