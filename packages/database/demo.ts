import type { Store } from "./index";
import { newItem, localDate, weekDays, addDays } from "../core";
import { emptyTaskDetails, type Item } from "../contracts";
/** Explicit opt-in, separate workspace only. Never call against the user Store. */
export function seedDesignPreview(
  store: Store,
  workspace: "demo",
  today = localDate(),
) {
  if (workspace !== "demo")
    throw Error("Демонстрация допускается только в отдельном workspace");
  if (store.state().items.length || store.state().subjects.length) return;
  store.db.transaction(() => {
    store.command({ type: "importStudy" });
    store.setting("onboarded", true);
    const week = weekDays(today);
    const projectNames = [
      [
        "Дизайн портфолио",
        "Продумать структуру, собрать работы и подготовить публикацию.",
        "Дизайн",
      ],
      [
        "Личный видеопроект",
        "От сценария и съёмки до монтажа первого выпуска.",
        "Творчество",
      ],
      [
        "Исследовательская работа",
        "Обзор источников, эксперименты и финальные выводы.",
        "Исследование",
      ],
    ];
    const projects = projectNames.map(([title, description, category]) => ({
      ...newItem("project", title),
      description,
      category,
      due: addDays(today, 14),
    }));
    for (const p of projects) store.put("project", p);
    const specs: [
      string,
      number,
      number,
      number,
      string | null,
      string | null,
    ][] = [
      ["Уточнить структуру главной", 0, 3, 45, today, "09:30"],
      ["Подготовить подборку работ", 0, 2, 60, today, "14:00"],
      ["Записать идеи для сценария", 1, 4, 45, today, "16:00"],
      ["Собрать материалы исследования", 2, 3, 60, addDays(today, 1), "11:00"],
      ["Сверстать страницу проекта", 0, 2, 90, addDays(today, 2), "10:00"],
      ["Отобрать визуальные референсы", 0, 2, 30, addDays(today, -2), "10:00"],
      ["Разобрать заметки к источникам", 2, 3, 45, addDays(today, -1), "09:00"],
      ["Проверить структуру сценария", 1, 2, 60, addDays(today, -3), "14:00"],
      ["Настроить рабочий процесс", 0, 1, 30, addDays(today, -4), "11:00"],
      ["Подготовить план монтажа", 1, 2, 45, null, null],
      ["Собрать обратную связь", 0, 1, 30, null, null],
    ];
    const tasks: Item[] = specs.map(
      ([title, project, priority, estimate, date, time]) => ({
        ...newItem("task", title),
        projectId: projects[project].id,
        priority,
        estimate,
        date,
        time,
        status: date ? "week" : "backlog",
        due: date ? addDays(date, 2) : null,
        category: projects[project].category,
        tags: "дизайн-предпросмотр",
      }),
    );
    for (const task of tasks) store.put("task", task);
    store.command({ type: "snapshot", week: week[0] });
    for (const [index, task] of tasks.entries()) {
      if (index >= 5 && index <= 8) {
        const at = task.date + "T15:00:00.000Z";
        store.put("task", { ...task, status: "done", completedAt: at });
        store.put("completion", {
          id: crypto.randomUUID(),
          task: { ...task, status: "done", completedAt: at },
          at,
        });
      } else if (index === 0) store.put("task", { ...task, status: "active" });
    }
    store.relations.saveTask(tasks[1].id, {
      ...emptyTaskDetails(),
      checklist: [
        {
          id: crypto.randomUUID(),
          title: "Выбрать три ключевые работы",
          done: true,
        },
        {
          id: crypto.randomUUID(),
          title: "Подготовить изображения",
          done: false,
        },
      ],
    });
    store.relations.saveTask(tasks[4].id, {
      ...emptyTaskDetails(),
      dependencies: [tasks[1].id],
    });
    const events = [
      {
        title: "Пара · модели данных",
        category: "university",
        time: "08:00",
        estimate: 90,
      },
      {
        title: "Дорога до университета",
        category: "commute",
        time: "07:15",
        estimate: 45,
      },
      {
        title: "Обсуждение проекта",
        category: "personal",
        time: "12:00",
        estimate: 45,
      },
    ];
    for (const e of events)
      store.put("event", { ...newItem("event", e.title), ...e, date: today });
    for (const [index, p] of projects.entries())
      for (let n = 0; n < 3; n++)
        store.command({
          type: "milestone",
          value: {
            id: crypto.randomUUID(),
            projectId: p.id,
            title: [
              "Подготовка и исследование",
              "Основная работа",
              "Финальная проверка",
            ][n],
            due: addDays(today, (n + 1) * 5 + index),
            done: n === 0 && index === 0,
          },
        });
    const ex = [
      {
        id: crypto.randomUUID(),
        name: "Присед со штангой",
        muscleGroup: "Ноги",
      },
      { id: crypto.randomUUID(), name: "Жим лёжа", muscleGroup: "Грудь" },
      { id: crypto.randomUUID(), name: "Тяга в наклоне", muscleGroup: "Спина" },
    ];
    for (const e of ex) store.command({ type: "exercise", value: e });
    const program = {
      id: crypto.randomUUID(),
      name: "Силовая · всё тело",
      description: "Демонстрационная программа, не рекомендация к нагрузке.",
      exercises: ex.map((e) => ({
        id: crypto.randomUUID(),
        exerciseId: e.id,
        sets: 3,
        reps: 8,
        weight: 40,
      })),
    };
    store.command({ type: "program", value: program });
    for (let n = 0; n < 7; n++) {
      const date = addDays(today, -n * 3);
      const strength = n % 2 === 0;
      const completed = n > 0;
      const workout = {
        ...newItem("workout", strength ? "Силовая · всё тело" : "Лёгкий бег"),
        category: strength ? "strength" : "running",
        date,
        time: "18:30",
        estimate: strength ? 60 : 40,
        duration: completed ? (strength ? 55 : 32 + n) : 0,
        distance: strength ? null : completed ? 5 + n * 0.2 : null,
        status: completed ? ("done" as const) : ("week" as const),
        completedAt: completed ? date + "T19:30:00.000Z" : null,
      };
      store.put("workout", workout);
      store.relations.sets(
        workout.id,
        strength ? program.id : null,
        strength
          ? ex.flatMap((e, k) =>
              Array.from({ length: 3 }, () => ({
                id: crypto.randomUUID(),
                exerciseId: e.id,
                reps: 8,
                weight: Math.max(20, 65 - n * 3 - k * 5),
                done: completed,
              })),
            )
          : [],
      );
    }
    for (let n = 0; n < 7; n++) {
      const startedAt = addDays(today, -n) + "T09:30:00.000Z";
      store.put("session", {
        id: crypto.randomUUID(),
        taskId: tasks[n % tasks.length].id,
        startedAt,
        seconds: 1500 + (n % 3) * 600,
        state: "done",
        target: n % 3 === 0 ? 1500 : 0,
      });
    }
    const notes = [
      [
        "Структура портфолио",
        "# Структура портфолио\n\n## Главное\n- Кратко рассказать о подходе\n- Показать три сильные работы\n- Объяснить свою роль\n\n> Дизайн-предпросмотр. Эти данные изолированы от рабочего пространства.",
        0,
      ],
      [
        "Идеи для первого выпуска",
        "# Идеи для выпуска\n\nНачать с конкретного вопроса. Подготовить историю, визуальные примеры и понятный вывод.",
        1,
      ],
    ] as const;
    for (const [title, description, index] of notes)
      store.put("note", {
        ...newItem("note", title),
        description,
        projectId: projects[index].id,
        tags: "идеи, дизайн-предпросмотр",
      });
  })();
}
