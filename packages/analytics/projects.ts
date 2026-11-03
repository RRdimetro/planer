import type { State } from "../contracts";
import { addDays, dateInZone, dateOfTimestamp } from "../core";
export function projectMetrics(s: State, projectId: string, now = new Date()) {
  const tasks = s.items.filter(
      (t) => t.kind === "task" && t.projectId === projectId,
    ),
    zone = String(
      s.settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    today = dateInZone(zone, now);
  const total = tasks.reduce((n, t) => n + t.weight * t.estimate, 0),
    done = tasks
      .filter((t) => t.status === "done")
      .reduce((n, t) => n + t.weight * t.estimate, 0),
    remaining = tasks
      .filter((t) => t.status !== "done")
      .reduce((n, t) => n + t.estimate, 0);
  const facts = Array.from(
    new Map(
      s.completions
        .filter(
          (f) =>
            f.task.projectId === projectId &&
            dateOfTimestamp(f.at, zone) >= addDays(today, -13) &&
            Date.parse(f.at) <= now.getTime(),
        )
        .map((f) => [f.task.id, f]),
    ).values(),
  );
  const pace = facts.reduce((n, f) => n + f.task.estimate, 0) / 14;
  return {
    tasks,
    total,
    done,
    remaining,
    percent: total ? Math.round((done / total) * 100) : null,
    forecast:
      remaining > 0 && pace > 0 && facts.length >= 3
        ? addDays(today, Math.ceil(remaining / pace))
        : null,
  };
}
