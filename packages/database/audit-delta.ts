/** Compact global audit entries. Undo uses in-memory snapshots; old audit rows remain intact. */
export function auditDelta(before: string, after: string): [string, string] {
  const a = JSON.parse(before),
    b = JSON.parse(after);
  const left: Record<string, unknown> = { format: "delta-v1" },
    right: Record<string, unknown> = { format: "delta-v1" };
  for (const key of ["records", "settings"]) {
    const id = key === "records" ? "id" : "key";
    const av = new Map(
      (a[key] ?? []).map((v: Record<string, unknown>) => [
        v[id],
        JSON.stringify(v),
      ]),
    );
    const bv = new Map(
      (b[key] ?? []).map((v: Record<string, unknown>) => [
        v[id],
        JSON.stringify(v),
      ]),
    );
    left[key] = (a[key] ?? []).filter(
      (v: Record<string, unknown>) => av.get(v[id]) !== bv.get(v[id]),
    );
    right[key] = (b[key] ?? []).filter(
      (v: Record<string, unknown>) => av.get(v[id]) !== bv.get(v[id]),
    );
  }
  const ar: Record<string, unknown> = {},
    br: Record<string, unknown> = {};
  for (const key of new Set([
    ...Object.keys(a.relations ?? {}),
    ...Object.keys(b.relations ?? {}),
  ])) {
    const x = a.relations?.[key],
      y = b.relations?.[key];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (Array.isArray(x) && Array.isArray(y)) {
      const xs = new Set(x.map((v) => JSON.stringify(v))),
        ys = new Set(y.map((v) => JSON.stringify(v)));
      ar[key] = x.filter((v) => !ys.has(JSON.stringify(v)));
      br[key] = y.filter((v) => !xs.has(JSON.stringify(v)));
    } else if (x && y && typeof x === "object" && typeof y === "object") {
      const changed = Array.from(
        new Set([...Object.keys(x), ...Object.keys(y)]),
      ).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
      ar[key] = Object.fromEntries(changed.map((k) => [k, x[k] ?? null]));
      br[key] = Object.fromEntries(changed.map((k) => [k, y[k] ?? null]));
    } else {
      ar[key] = x ?? null;
      br[key] = y ?? null;
    }
  }
  left.relations = ar;
  right.relations = br;
  return [JSON.stringify(left), JSON.stringify(right)];
}
