import type { Command } from "../../../../packages/contracts";
export function successFeedback(
  c: Command,
): { text: string; undo: boolean } | null {
  if (c.type === "save" && c.item.kind === "note") return null;
  const messages: Record<string, string> = {
    save: "Изменения сохранены",
    saveTask: "Задача сохранена",
    saveEvent: "События сохранены",
    saveWorkout: "Тренировка сохранена",
    bulkTasks: "Задачи обновлены",
    stage: "Отметка сохранена",
    studyGroup: "Группа обновлена",
    studyBinding: "Источник показателя обновлён",
    subject: "Предмет сохранён",
    remove: "Запись удалена",
    removeSubject: "Предмет удалён",
    removeAttachment: "Вложение удалено",
    program: "Программа сохранена",
    exercise: "Упражнение сохранено",
    milestone: "Этап сохранён",
    undo: "Изменение отменено",
  };
  if (c.type === "focusStart")
    return {
      text: c.kind === "break" ? "Перерыв начат" : "Фокус начат",
      undo: false,
    };
  if (c.type === "focusAction")
    return {
      text: {
        pause: "Сессия приостановлена",
        resume: "Сессия продолжена",
        finish: "Сессия завершена",
      }[c.action],
      undo: false,
    };
  return messages[c.type]
    ? { text: messages[c.type], undo: c.type !== "undo" }
    : null;
}
export function userError(error: unknown) {
  const raw = String(error);
  if (/SQLITE_BUSY|database is locked/i.test(raw))
    return "База занята. Подождите и повторите сохранение.";
  if (/SQLITE_FULL|SQLITE_IOERR|disk full/i.test(raw))
    return "Не удалось записать данные. Проверьте свободное место и доступ к папке. Сохранение не подтверждено.";
  if (/FOREIGN KEY constraint/i.test(raw))
    return "Связанная запись недоступна. Обновите список и повторите действие.";
  return raw
    .replace(/^Error invoking remote method '[^']+': Error: /, "")
    .replace(/^Error: /, "");
}
