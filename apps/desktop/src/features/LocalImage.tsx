import { useEffect, useState } from "react";
export function LocalImage({ id, alt = "" }: { id: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (/^[a-f\d-]{36}$/i.test(id))
      window.focusAPI
        .readImage(id)
        .then((s) => {
          if (active) setSrc(s);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  return src ? (
    <img className="obs-note-image" src={src} alt={alt} />
  ) : (
    <small className="muted">
      {alt || "Изображение"} · нет доступного локального изображения
    </small>
  );
}
