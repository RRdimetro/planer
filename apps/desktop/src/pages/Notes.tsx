import { registerPending } from "../shared/pending";
import { useState, useEffect, useRef, useCallback } from "react";
import Markdown from "react-markdown";
import type { Item } from "../../../../packages/contracts";
import { newItem } from "../../../../packages/core";
import { ActivityHistory } from "../design/ActivityHistory";
import { LocalImage } from "../features/LocalImage";
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
  const [folder, setFolder] = useState("");
  const [link, setLink] = useState("");
  const [related, setRelated] = useState("");
  const [historyKey, setHistoryKey] = useState(0);
  const [saveLabel, setSaveLabel] = useState("Сохранено");
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
            setSaveLabel("Сохранено");
            setHistoryKey((k) => k + 1);
          } catch (e) {
            setSaveLabel("Ошибка сохранения");
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
    setSaveLabel("Сохраняется…");
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
        <span className="eyebrow">KNOWLEDGE / ВАША БИБЛИОТЕКА</span>
        <h3>
          Заметки <span className="badge">{notes.length}</span>
        </h3>
        <select
          aria-label="Фильтр папок"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        >
          <option value="">Все заметки</option>
          <option value="unfiled">Без папки</option>
          {s.noteFolders?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <div className="row">
          <button
            onClick={() => {
              const name = window.prompt("Название папки");
              if (name?.trim())
                void command({
                  type: "folder",
                  id: crypto.randomUUID(),
                  name: name.trim(),
                });
            }}
          >
            + Папка
          </button>
          {s.noteFolders?.some((f) => f.id === folder) && (
            <button
              onClick={() => {
                const name = window.prompt(
                  "Новое название папки",
                  s.noteFolders?.find((f) => f.id === folder)?.name,
                );
                if (name?.trim())
                  void command({
                    type: "folder",
                    id: folder,
                    name: name.trim(),
                  });
              }}
            >
              Переименовать
            </button>
          )}
        </div>
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
          .filter(
            (n) =>
              !folder ||
              (folder === "unfiled"
                ? !s.noteMembership?.[n.id]
                : s.noteMembership?.[n.id] === folder),
          )
          .filter((n) =>
            (n.title + n.description + n.tags)
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .map((n) => (
            <button
              className={draft?.id === n.id ? "active" : ""}
              key={n.id}
              onClick={() => void choose(n.id)}
            >
              <strong>{n.title}</strong>
              <small>
                {n.description.replace(/[#*`]/g, "").slice(0, 80) ||
                  "Пустая заметка"}
              </small>
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
              <span className="muted" role="status">
                {saveLabel} · Markdown
              </span>
              <select
                aria-label="Вставить ссылку на заметку"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  const n = notes.find((n) => n.id === e.target.value);
                  if (n) {
                    changeDraft({
                      ...draft,
                      description:
                        draft.description +
                        `\n[${n.title.replaceAll("[", "").replaceAll("]", "")}](focus-note:${n.id})`,
                    });
                    setLink("");
                  }
                }}
              >
                <option value="">Ссылка на заметку…</option>
                {notes
                  .filter((n) => n.id !== draft.id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
              </select>
            </div>
            {preview ? (
              <div className="markdown">
                <Markdown
                  skipHtml
                  urlTransform={(url) =>
                    /^(focus-note|attachment):[a-f\d-]{36}$/i.test(url)
                      ? url
                      : ""
                  }
                  components={{
                    img: ({ src, alt }) =>
                      typeof src === "string" &&
                      src.startsWith("attachment:") ? (
                        <LocalImage id={src.slice(11)} alt={alt} />
                      ) : (
                        <span>{alt}</span>
                      ),
                    a: ({ href, children }) =>
                      href?.startsWith("focus-note:") ? (
                        <button
                          className="textbutton"
                          onClick={() => void choose(href.slice(11))}
                        >
                          {children}
                        </button>
                      ) : (
                        <span>{children}</span>
                      ),
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
        <h3>Контекст заметки</h3>
        {draft && (
          <>
            <label className="field">
              Папка
              <select
                aria-label="Папка заметки"
                value={s.noteMembership?.[draft.id] ?? ""}
                onChange={(e) => {
                  const folderId = e.target.value || null;
                  void flush().then(() =>
                    command({ type: "noteFolder", noteId: draft.id, folderId }),
                  );
                }}
              >
                <option value="">Без папки</option>
                {s.noteFolders?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
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
            <label className="field">
              Связать с задачей
              <select
                aria-label="Связать заметку с задачей"
                value={related}
                onChange={(e) => {
                  const targetId = e.target.value;
                  setRelated("");
                  if (targetId)
                    void flush().then(() =>
                      command({
                        type: "link",
                        sourceId: draft.id,
                        targetId,
                      }),
                    );
                }}
              >
                <option value="">Выберите задачу…</option>
                {s.items
                  .filter((t) => t.kind === "task")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            </label>
            {(s.links ?? [])
              .filter(
                (l) => l.sourceId === draft.id && l.relation === "related",
              )
              .map((l) => (
                <div className="row" key={l.targetId}>
                  <span className="grow">
                    {s.items.find((t) => t.id === l.targetId)?.title ??
                      "Архивная запись"}
                  </span>
                  <button
                    aria-label="Удалить связь"
                    onClick={() =>
                      void command({
                        type: "link",
                        sourceId: draft.id,
                        targetId: l.targetId,
                        remove: true,
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            <h4>Обратные ссылки</h4>
            {(s.links ?? [])
              .filter(
                (l) => l.targetId === draft.id && l.relation === "backlink",
              )
              .map((l) => (
                <button
                  className="textbutton"
                  key={l.sourceId}
                  onClick={() => void choose(l.sourceId)}
                >
                  {notes.find((n) => n.id === l.sourceId)?.title ??
                    "Архивная заметка"}
                </button>
              ))}
            <h4>Вложения</h4>
            {s.attachments
              .filter((a) => a.entityId === draft.id)
              .map((a) => (
                <div className="obs-note-attachment" key={a.id}>
                  <strong>{a.name}</strong>
                  <small>{(a.size / 1024).toFixed(1)} КБ</small>
                  {/\.(png|jpe?g|gif|webp)$/i.test(a.name) && (
                    <>
                      <LocalImage id={a.id} alt={a.name} />
                      <button
                        onClick={() =>
                          changeDraft({
                            ...draft,
                            description:
                              draft.description +
                              `\n![${a.name.replaceAll("[", "").replaceAll("]", "")}](attachment:${a.id})`,
                          })
                        }
                      >
                        Вставить в текст
                      </button>
                    </>
                  )}
                  <div className="row">
                    <button
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
                      className="danger"
                      onClick={() => {
                        if (window.confirm("Удалить вложение?"))
                          void command({ type: "removeAttachment", id: a.id });
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            <button
              onClick={() =>
                void flush().then(() =>
                  command({ type: "file", action: "attach", id: draft.id }),
                )
              }
            >
              Прикрепить файл
            </button>
            <ActivityHistory
              key={`${draft.id}-${historyKey}`}
              id={draft.id}
              restore={(old) => {
                changeDraft({
                  ...draft,
                  title: old.title,
                  description: old.description,
                  tags: old.tags,
                });
                void flush();
              }}
            />
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
