import type { State } from "../contracts";
export function fitnessMetrics(s: State, from = "0000", to = "9999") {
  const planned = s.items.filter(
    (i) => i.kind === "workout" && i.date && i.date >= from && i.date <= to,
  );
  const done = planned.filter((i) => i.status === "done");
  const ids = new Set(done.map((i) => i.id));
  const sets = s.workoutSets.filter((x) => x.done && ids.has(x.workoutId));
  const distance = done.reduce((a, i) => a + (i.distance ?? 0), 0);
  const volume = sets.reduce((a, x) => a + x.weight * x.reps, 0);
  const records = s.exercises
    .map((e) => {
      const es = sets.filter((x) => x.exerciseId === e.id && x.reps > 0);
      const maxWeight = es.length ? Math.max(...es.map((x) => x.weight)) : null;
      const oneRM = es
        .filter((x) => x.weight > 0 && x.reps <= 12)
        .map((x) => x.weight * (1 + x.reps / 30));
      return {
        exerciseId: e.id,
        name: e.name,
        maxWeight,
        bestReps:
          maxWeight === null
            ? null
            : Math.max(
                ...es.filter((x) => x.weight === maxWeight).map((x) => x.reps),
              ),
        estimated1RM: oneRM.length ? Math.max(...oneRM) : null,
        sets: es.length,
      };
    })
    .filter((e) => e.sets > 0);
  const dates = Array.from(new Set(done.map((i) => i.date!))).sort();
  const chart = dates.map((date) => {
    const ws = done.filter((i) => i.date === date);
    const wids = new Set(ws.map((i) => i.id));
    return {
      date,
      label: date.slice(5),
      distance: ws.reduce((a, i) => a + (i.distance ?? 0), 0),
      volume: sets
        .filter((x) => wids.has(x.workoutId))
        .reduce((a, x) => a + x.reps * x.weight, 0),
      duration: ws.reduce((a, i) => a + i.duration, 0),
    };
  });
  return {
    planned,
    done,
    sets,
    distance,
    volume,
    records,
    chart,
    days: dates.length,
    duration: done.reduce((a, i) => a + i.duration, 0),
  };
}
