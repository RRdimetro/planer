import type { State, Command } from "../../../../packages/contracts";
export type PageProps = {
  s: State;
  command: (c: Command) => Promise<State | undefined>;
};
