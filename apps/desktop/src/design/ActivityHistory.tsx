import { useEffect, useState } from "react";
import type { API, Item } from "../../../../packages/contracts";
export function ActivityHistory({
  id,
  restore,
}: {
  id: string;
  restore?: (item: Item) => void;
}) {
  const [rows, setRows] = useState<Awaited<ReturnType<API["history"]>>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    window.focusAPI
      .history(id)
      .then((r) => {
        if (active) setRows(r);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <details className="obs-history">
      <summary>История изменений · {rows.length}</summary>
      {error && <p role="alert">{error}</p>}
      {rows.slice(0, 100).map((r) => (
        <article key={r.id}>
          <time>{new Date(r.at).toLocaleString("ru-RU")}</time>
          <strong>
            {r.before?.date !== r.after?.date
              ? `Перенос: ${r.before?.date ?? "без даты"} → ${r.after?.date ?? "без даты"}`
              : r.before?.status !== r.after?.status
                ? `Статус: ${r.before?.status ?? "создание"} → ${r.after?.status ?? "удаление"}`
                : "Изменение записи"}
          </strong>
          {restore && r.after && (
            <button
              type="button"
              onClick={async () => {
                if (window.confirm("Сохранить эту версию как новое изменение?"))
                  try {
                    const item = await window.focusAPI.revision(r.id);
                    if (item) restore(item);
                    else setError("Версия записи недоступна");
                  } catch (e) {
                    setError(String(e));
                  }
              }}
            >
              Восстановить версию
            </button>
          )}
        </article>
      ))}
      {!rows.length && <p>Истории пока нет.</p>}
    </details>
  );
}
