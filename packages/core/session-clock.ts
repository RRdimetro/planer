/** Monotonic time includes busy/minimized operation; explicit OS sleep is excluded. */
export class SessionClock {
  private last: number;
  private sleeping = false;
  constructor(now: number) {
    this.last = now;
  }
  suspend(now: number) {
    const delta = this.elapsed(now);
    this.sleeping = true;
    return delta;
  }
  resume(now: number) {
    this.sleeping = false;
    this.last = now;
  }
  elapsed(now: number) {
    const delta = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    return this.sleeping ? 0 : delta;
  }
}
