import {
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  FolderKanban,
  GraduationCap,
  Dumbbell,
  ChartNoAxesCombined,
  Timer,
  NotebookPen,
  Settings,
  PanelLeftClose,
  Leaf,
} from "lucide-react";
import { pages } from "../shared/navigation";
import type { PageProps } from "../shared/model";
const icons = [
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  FolderKanban,
  GraduationCap,
  Dumbbell,
  ChartNoAxesCombined,
  Timer,
  NotebookPen,
  Settings,
];
export function Sidebar({
  s,
  command,
  page,
  go,
  collapsed,
}: PageProps & {
  page: number;
  go: (page: number) => void;
  collapsed: boolean;
}) {
  const tasks = s.items.filter((i) => i.kind === "task");
  return (
    <aside>
      <div className="brand">
        <Leaf size={27} />
        {!collapsed && (
          <span>
            FOCUS OS <b>PRO</b>
          </span>
        )}
      </div>
      <div className="navlabel">ВАШЕ ПРОСТРАНСТВО</div>
      <nav>
        {pages.map((p, i) => {
          const Icon = icons[i];
          return (
            <button
              key={p}
              className={page === i ? "selected" : ""}
              title={p}
              aria-label={p}
              onClick={() => go(i)}
            >
              <Icon size={19} />
              {!collapsed && <span>{p}</span>}
              {i === 2 && !collapsed && (
                <small>{tasks.filter((t) => t.status !== "done").length}</small>
              )}
            </button>
          );
        })}
      </nav>
      <div className="sidebarfoot">
        <span className="dot" />
        {!collapsed &&
          (s.diagnostics.workspace === "demo"
            ? "Демо · отдельная база"
            : "Локально · без облака")}
        <button
          className="icon"
          aria-label="Свернуть навигацию"
          onClick={() =>
            void command({
              type: "settings",
              key: "collapsed",
              value: !collapsed,
            })
          }
        >
          <PanelLeftClose size={18} />
        </button>
      </div>
    </aside>
  );
}
