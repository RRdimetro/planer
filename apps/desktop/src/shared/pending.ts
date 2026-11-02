const pending = new Map<string, () => Promise<void>>();
export function registerPending(name: string, flush: () => Promise<void>) {
  pending.set(name, flush);
  return () => pending.delete(name);
}
export async function flushPending() {
  await Promise.all(Array.from(pending.values()).map((flush) => flush()));
}
