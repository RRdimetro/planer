import { motion } from "motion/react";
import { Plus } from "lucide-react";
import type { State, Item } from "../../../../packages/contracts";
import { newItem } from "../../../../packages/core";
import { pages } from "../shared/navigation";
export function PageHeader({
  s,
  page,
  edit,
}: {
  s: State;
  page: number;
  edit: (i: Item) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="pageheading"
    >
      <div>
        <div className="eyebrow">
          FOCUS OS / {String(page + 1).padStart(2, "0")}
        </div>
        <h1>{pages[page]}</h1>
        <p className="muted">
          {
            [
              "Ясность в планах. Пространство для главного.",
              "Время под вашим контролем.",
              "От намерения — к результату.",
              "Большие идеи, понятные шаги.",
              "Каждая отметка — шаг вперёд.",
              "Движение в своём ритме.",
              "Только ваши данные. Честная картина.",
              "Одна задача. Полное внимание.",
              "Мысли, к которым хочется вернуться.",
              "Ваше пространство, ваши правила.",
            ][page]
          }
        </p>
      </div>
      <div className="row">
        <span className="date">
          {new Date().toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            weekday: "short",
            timeZone: String(
              s.settings.timezone ??
                Intl.DateTimeFormat().resolvedOptions().timeZone,
            ),
          })}
        </span>
        <button
          className="primary"
          onClick={() =>
            edit(
              newItem(
                page === 3 ? "project" : page === 5 ? "workout" : "task",
                "",
              ),
            )
          }
        >
          <Plus size={16} /> Добавить
        </button>
      </div>
    </motion.div>
  );
}
