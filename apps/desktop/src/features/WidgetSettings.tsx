import type { PageProps } from "../shared/model";
export const widgetOrder = [
  "tasks",
  "agenda",
  "focus",
  "chart",
  "projects",
  "efficiency",
  "fitness",
  "deadlines",
  "study",
  "week",
];
export const widgetLabels: Record<string, string> = {
  tasks: "Сегодня",
  agenda: "Расписание",
  focus: "Фокус",
  chart: "Динамика",
  projects: "Проекты",
  efficiency: "Эффективность",
  fitness: "Тренировки",
  deadlines: "Дедлайны",
  study: "Учёба",
  week: "Неделя",
};
export type WidgetLayout = {
  order: string[];
  hidden: string[];
  sizes: Record<string, number>;
  widths?: Record<string, number>;
};
export function WidgetSettings({ s, command }: PageProps) {
  const config = (s.settings.obsidianWidgets as WidgetLayout) ?? {
    order: widgetOrder,
    hidden: [],
    sizes: {},
    widths: {},
  };
  const save = (next: WidgetLayout) =>
    void command({ type: "settings", key: "obsidianWidgets", value: next });
  return (
    <details className="obs-widget-settings">
      <summary>Настроить виджеты</summary>
      <p>
        Положение, видимость и размеры сохраняются в этой базе. Исходная
        композиция B доступна через «Сбросить».
      </p>
      {config.order.map((id, index) => (
        <div key={id} className="obs-widget-row">
          <label>
            <input
              type="checkbox"
              aria-label={`Показывать ${widgetLabels[id]}`}
              checked={!config.hidden.includes(id)}
              disabled={
                !config.hidden.includes(id) && config.hidden.length >= 9
              }
              onChange={(e) =>
                save({
                  ...config,
                  hidden: e.target.checked
                    ? config.hidden.filter((x) => x !== id)
                    : [...config.hidden, id],
                })
              }
            />
            {widgetLabels[id]}
          </label>
          <button
            disabled={!index}
            aria-label={`Выше ${widgetLabels[id]}`}
            onClick={() => {
              const order = [...config.order];
              [order[index - 1], order[index]] = [
                order[index],
                order[index - 1],
              ];
              save({ ...config, order });
            }}
          >
            ↑
          </button>
          <button
            disabled={index === 9}
            aria-label={`Ниже ${widgetLabels[id]}`}
            onClick={() => {
              const order = [...config.order];
              [order[index + 1], order[index]] = [
                order[index],
                order[index + 1],
              ];
              save({ ...config, order });
            }}
          >
            ↓
          </button>
          <select
            aria-label={`Высота ${widgetLabels[id]}`}
            value={config.sizes[id] ?? 0}
            onChange={(e) => {
              const sizes = { ...config.sizes };
              if (Number(e.target.value)) sizes[id] = Number(e.target.value);
              else delete sizes[id];
              save({ ...config, sizes });
            }}
          >
            {[
              [0, "Авто"],
              [300, "300 px"],
              [450, "450 px"],
              [600, "600 px"],
            ].map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label={`Ширина ${widgetLabels[id]}`}
            value={config.widths?.[id] ?? 0}
            onChange={(e) => {
              const widths = { ...config.widths };
              if (Number(e.target.value)) widths[id] = Number(e.target.value);
              else delete widths[id];
              save({ ...config, widths });
            }}
          >
            <option value="0">Авто</option>
            <option value="3">¼</option>
            <option value="6">½</option>
            <option value="12">Полная</option>
          </select>
        </div>
      ))}
      <button
        onClick={() =>
          save({ order: widgetOrder, hidden: [], sizes: {}, widths: {} })
        }
      >
        Сбросить композицию
      </button>
    </details>
  );
}
