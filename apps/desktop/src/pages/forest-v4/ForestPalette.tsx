import * as Dialog from "@radix-ui/react-dialog";
import { useId, useState } from "react";
import { Search, ArrowUpRight, CornerDownLeft, X } from "lucide-react";
import type { Item } from "../../../../../packages/contracts";
import { newItem } from "../../../../../packages/core";
import type { PageProps } from "../../shared/model";
import { pages } from "../../shared/navigation";

function rank(text: string, query: string) {
  const title = text.toLocaleLowerCase("ru");
  const q = query.toLocaleLowerCase("ru").trim();
  if (!q || title.startsWith(q)) return 0;
  if (title.includes(q)) return 1;
  let index = 0;
  for (const char of title) if (char === q[index]) index++;
  return index === q.length ? 2 : Infinity;
}

export function ForestPalette({
  s,
  command,
  go,
  edit,
  close,
}: PageProps & {
  go: (page: number) => void;
  edit: (item: Item) => void;
  close: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const choices = [
    {
      id: "new-task",
      group: "Действия",
      title: "Новая задача",
      run: () => edit(newItem("task", "")),
    },
    {
      id: "new-project",
      group: "Действия",
      title: "Создать проект",
      run: () => edit(newItem("project", "")),
    },
    {
      id: "new-workout",
      group: "Действия",
      title: "Добавить тренировку",
      run: () => edit(newItem("workout", "")),
    },
    {
      id: "focus",
      group: "Действия",
      title: "Начать фокус",
      run: () => {
        if (
          !s.sessions.some((x) =>
            ["running", "paused", "interrupted"].includes(x.state),
          )
        )
          void command({
            type: "focusStart",
            taskId: null,
            target: Number(s.settings.pomodoro ?? 25) * 60,
          });
        go(7);
      },
    },
    ...pages.map((title, i) => ({
      id: `page-${i}`,
      group: "Разделы",
      title,
      run: () => go(i),
    })),
    ...s.items
      .filter((i) => i.kind !== "snapshot")
      .map((item) => ({
        id: item.id,
        group:
          item.kind === "task"
            ? "Задачи"
            : item.kind === "project"
              ? "Проекты"
              : "Записи",
        title: item.title,
        run: () => (item.kind === "note" ? go(8) : edit(item)),
      })),
    ...s.subjects.map((subject) => ({
      id: subject.id,
      group: "Учёба",
      title: subject.name,
      run: () => go(4),
    })),
  ];
  const results = choices
    .filter((c) => Number.isFinite(rank(c.title, query)))
    .sort((a, b) => rank(a.title, query) - rank(b.title, query))
    .slice(0, 30);
  const select = (index: number) => {
    const item = results[index];
    if (item) {
      close();
      item.run();
    }
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fn-command-overlay" />
        <Dialog.Content className="fn-command-dialog">
          <Dialog.Title className="fn-sr-only">Поиск и команды</Dialog.Title>
          <Dialog.Description className="fn-sr-only">
            Найдите раздел или запись. Стрелки перемещают выбор, Enter выполняет
            действие.
          </Dialog.Description>
          <div className="fn-command-input">
            <Search size={19} />
            <input
              autoFocus
              role="combobox"
              aria-label="Поиск и команды"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={
                results[active] ? `${id}-${active}` : undefined
              }
              placeholder="Найдите действие или начните вводить…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (["ArrowDown", "ArrowUp"].includes(e.key)) {
                  e.preventDefault();
                  const next = results.length
                    ? (active +
                        (e.key === "ArrowDown" ? 1 : results.length - 1)) %
                      results.length
                    : 0;
                  setActive(next);
                  document
                    .getElementById(`${id}-${next}`)
                    ?.scrollIntoView({ block: "nearest" });
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  select(active);
                }
              }}
            />
            <Dialog.Close aria-label="Закрыть">
              <X size={17} />
            </Dialog.Close>
          </div>
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label="Результаты"
            className="fn-command-results"
          >
            {results.map((result, index) => (
              <div key={result.id}>
                {(index === 0 || results[index - 1].group !== result.group) && (
                  <span className="fn-command-group">{result.group}</span>
                )}
                <button
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={active === index}
                  tabIndex={-1}
                  onMouseMove={() => setActive(index)}
                  onClick={() => select(index)}
                >
                  <span>{result.title}</span>
                  {active === index ? (
                    <CornerDownLeft size={15} />
                  ) : (
                    <ArrowUpRight size={15} />
                  )}
                </button>
              </div>
            ))}
            {!results.length && (
              <p className="fn-command-empty">
                Ничего не найдено. Попробуйте другое слово или создайте задачу
                через Ctrl+N.
              </p>
            )}
          </div>
          <div className="fn-command-footer">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> выбор
            </span>
            <span>
              <kbd>Enter</kbd> открыть
            </span>
            <span>
              <kbd>Esc</kbd> закрыть
            </span>
            <span>Поиск только в этой демо-базе</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
