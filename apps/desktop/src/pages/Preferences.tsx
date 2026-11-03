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
        <span className="eyebrow">APPEARANCE / ВАШЕ ПРОСТРАНСТВО</span>
        <h3>Внешний вид и пространство</h3>
        <label className="field">
          Тема
          <input readOnly value="Obsidian Command Center" />
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
          Масштаб интерфейса
          <select
            value={Number(s.settings.uiScale ?? 1)}
            onChange={(e) => set("uiScale", Number(e.target.value))}
          >
            {[0.75, 0.9, 1, 1.1, 1.25, 1.5, 2].map((n) => (
              <option key={n} value={n}>
                {Math.round(n * 100)}%
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <input
            type="checkbox"
            checked={s.settings.animations !== false}
            onChange={(e) => set("animations", e.target.checked)}
          />{" "}
          Плавные анимации
        </label>
        <p className="hint">
          Системная настройка уменьшения движения также учитывается.
        </p>
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
            ["breakMinutes", "Перерыв, минут", 5, 1, 60],
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
        <span className="eyebrow">NOTIFICATIONS / ЛОКАЛЬНЫЕ НАПОМИНАНИЯ</span>
        <h3>Уведомления</h3>
        <label className="field">
          <input
            aria-label="Включить уведомления"
            type="checkbox"
            checked={!!s.settings.notifications}
            onChange={(e) => set("notifications", e.target.checked)}
          />{" "}
          Напоминать о задачах, дедлайнах, тренировках и завершении сессий
        </label>
        <label className="field">
          Предупредить за, минут
          <input
            type="number"
            min="0"
            max="120"
            value={Number(s.settings.notificationLead ?? 10)}
            onChange={(e) =>
              set(
                "notificationLead",
                Math.max(0, Math.min(120, Number(e.target.value))),
              )
            }
          />
        </label>
        <p className="hint">
          Работают при запущенном приложении, в том числе при сворачивании. Срок
          без времени напоминается в 18:00 выбранного часового пояса. Доставкой
          управляет ОС; разрешите уведомления FOCUS OS PRO в Windows.
        </p>
        <h3>Горячие клавиши</h3>
        <div className="sessionrow">
          <kbd>Ctrl+K</kbd>
          <span>Поиск и команды</span>
        </div>
        <div className="sessionrow">
          <kbd>Ctrl+N</kbd>
          <span>Новая задача</span>
        </div>
        <div className="sessionrow">
          <kbd>Ctrl+Z</kbd>
          <span>Отменить действие вне редактора</span>
        </div>
        <div className="sessionrow">
          <kbd>Esc</kbd>
          <span>Закрыть панель</span>
        </div>
        <p className="hint">
          В учебной таблице: стрелки — навигация, ? — неизвестное состояние. В
          недельном списке: стрелки на ручке переноса — соседний день.
        </p>
      </section>
      <section className="design-preview-settings">
        <h3>Дизайн-предпросмотр</h3>
        <p className="muted">
          Посмотрите заполненные экраны в отдельном окне. Демонстрационные
          задачи, проекты и тренировки сохраняются в собственной базе и не
          переносятся в ваше рабочее пространство.
        </p>
        <button
          className="primary"
          onClick={() =>
            void command({ type: "workspace", action: "openDemo" })
          }
        >
          Открыть дизайн-предпросмотр
        </button>
        <p className="hint">
          В окне предпросмотра постоянно отображается пометка о демонстрационных
          данных.
        </p>
      </section>
      <section>
        <h3>Данные и резервные копии</h3>
        <p className="muted">
          Всё хранится на вашем компьютере. Восстановление заменяет текущие
          данные после отдельного подтверждения.
        </p>
        <label className="field">
          <input
            aria-label="Автоматические копии"
            type="checkbox"
            checked={s.settings.autoBackup !== false}
            onChange={(e) => set("autoBackup", e.target.checked)}
          />{" "}
          Автоматические проверенные ZIP-копии
        </label>
        <label className="field">
          Интервал копирования, часов
          <input
            type="number"
            min="1"
            max="168"
            value={Number(s.settings.backupEveryHours ?? 24)}
            onChange={(e) =>
              set(
                "backupEveryHours",
                Math.max(1, Math.min(168, Number(e.target.value))),
              )
            }
          />
        </label>
        <label className="field">
          Хранить автоматических копий
          <input
            type="number"
            min="1"
            max="100"
            value={Number(s.settings.backupRetention ?? 7)}
            onChange={(e) =>
              set(
                "backupRetention",
                Math.max(1, Math.min(100, Number(e.target.value))),
              )
            }
          />
        </label>
        <p className="hint">
          Последняя автоматическая копия:{" "}
          {s.settings.lastBackupAt
            ? new Date(String(s.settings.lastBackupAt)).toLocaleString("ru-RU")
            : "ещё не создана"}
        </p>
        {!!s.settings.lastBackupPath && (
          <p className="obs-file-path">{String(s.settings.lastBackupPath)}</p>
        )}
        <p className="hint">
          Старая автоматическая копия удаляется только после проверки
          восстановления новой. Ручные и предмиграционные копии не ротируются.
        </p>
        {(
          [
            ["backup", "Создать ZIP-копию"],
            ["restore", "Восстановить ZIP"],
            ["export", "Экспорт JSON"],
            ["import", "Импорт JSON"],
            ["openData", "Открыть папку данных"],
            ["integrity", "Проверить целостность SQLite"],
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
        <p className="muted">FOCUS OS PRO 0.3.0 · SQLite</p>
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
