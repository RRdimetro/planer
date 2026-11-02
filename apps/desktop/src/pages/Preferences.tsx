import type { Command } from "../../../../packages/contracts";
import type { PageProps } from "../shared/model";
import { pages } from "../shared/navigation";
export function Preferences({ s, command }: PageProps) {
  const set = (
    key: Extract<Command, { type: "settings" }>["key"],
    value: unknown,
  ) => void command({ type: "settings", key, value });
  return (
    <div className="settingsgrid">
      <section>
        <h3>Внешний вид и пространство</h3>
        <label className="field">
          Тема
          <input readOnly value="Premium Forest" />
        </label>
        <label className="field">
          Плотность
          <select
            value={String(s.settings.density ?? "normal")}
            onChange={(e) => set("density", e.target.value)}
          >
            <option value="normal">Комфортная</option>
            <option value="compact">Компактная</option>
          </select>
        </label>
        <label className="field">
          Размер текста
          <input
            type="number"
            min="12"
            max="20"
            value={Number(s.settings.fontSize ?? 14)}
            onChange={(e) =>
              set(
                "fontSize",
                Math.min(20, Math.max(12, Number(e.target.value))),
              )
            }
          />
        </label>
        <label className="field">
          Стартовый экран
          <select
            value={Number(s.settings.startPage ?? 0)}
            onChange={(e) => set("startPage", Number(e.target.value))}
          >
            {pages.map((p, i) => (
              <option key={p} value={i}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Часовой пояс
          <select
            value={String(
              s.settings.timezone ??
                Intl.DateTimeFormat().resolvedOptions().timeZone,
            )}
            onChange={(e) => set("timezone", e.target.value)}
          >
            {Array.from(
              new Set([
                Intl.DateTimeFormat().resolvedOptions().timeZone,
                "Europe/Moscow",
                "Europe/Kaliningrad",
                "Asia/Yekaterinburg",
                "Asia/Novosibirsk",
                "Asia/Vladivostok",
                "UTC",
              ]),
            ).map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
      </section>
      <section>
        <h3>Фокус и планирование</h3>
        {(
          [
            ["pomodoro", "Pomodoro, минут", 25, 1, 180],
            ["workStart", "Начало работы, час", 9, 0, 23],
            ["workEnd", "Конец работы, час", 18, 1, 24],
            ["dailyCapacity", "Дневная ёмкость, минут", 360, 15, 1080],
          ] as const
        ).map(([key, label, initial, min, max]) => (
          <label key={key} className="field">
            {label}
            <input
              type="number"
              min={min}
              max={max}
              value={Number(s.settings[key] ?? initial)}
              onChange={(e) =>
                set(key, Math.min(max, Math.max(min, Number(e.target.value))))
              }
            />
          </label>
        ))}
        <p className="hint">
          Неделя начинается с понедельника. Распределение предлагает свободные
          интервалы, учитывает дневной предел и требует применения.
        </p>
      </section>
      <section>
        <h3>Веса эффективности</h3>
        {[
          "Исходный план",
          "Своевременность",
          "Фокус",
          "Оценка / факт",
          "Тренировки",
        ].map((label, i) => (
          <label className="field" key={label}>
            {label}
            <input
              type="number"
              min="0"
              max="100"
              value={
                ((s.settings.weights as number[]) ?? [35, 25, 20, 10, 10])[i]
              }
              onChange={(e) => {
                const weights = [
                  ...((s.settings.weights as number[]) ?? [35, 25, 20, 10, 10]),
                ];
                weights[i] = Math.min(100, Math.max(0, Number(e.target.value)));
                set("weights", weights);
              }}
            />
          </label>
        ))}
      </section>
      <section>
        <h3>Данные и резервные копии</h3>
        <p className="muted">
          Всё хранится на вашем компьютере. Восстановление заменяет текущие
          данные после отдельного подтверждения.
        </p>
        {(
          [
            ["backup", "Создать ZIP-копию"],
            ["restore", "Восстановить ZIP"],
            ["export", "Экспорт JSON"],
            ["import", "Импорт JSON"],
            ["openData", "Открыть папку данных"],
          ] as const
        ).map(([action, label]) => (
          <button
            key={action}
            onClick={() => void command({ type: "file", action })}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            if (
              window.confirm(
                "Импортировать референс? При наличии предметов импорт ничего не изменит.",
              )
            )
              void command({ type: "importStudy" });
          }}
        >
          Импорт учебного референса
        </button>
        <h3 style={{ marginTop: 28 }}>О приложении</h3>
        <p className="muted">FOCUS OS PRO 0.1.0 · SQLite</p>
        <p className="hint">
          Миграция {s.diagnostics.version} · Проверка целостности:{" "}
          {s.diagnostics.integrity}
          <br />
          Ctrl+K — команды · Ctrl+N — задача · Ctrl+Z — отмена.
          <br />
          Уведомления работают при запущенном приложении.
        </p>
      </section>
    </div>
  );
}
