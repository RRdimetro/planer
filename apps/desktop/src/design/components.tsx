import { useState, type HTMLAttributes, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { ArrowUpRight, Mountain, Check } from "lucide-react";
import { Modal } from "../shared/ui";
export function AppShell({
  reduce,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { reduce?: boolean }) {
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      <div {...props}>{children}</div>
    </MotionConfig>
  );
}
export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <article className="kpi obs-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}
export function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="obs-chart">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
export function EmptyState({
  title,
  children,
  action,
  label,
}: {
  title: string;
  children?: ReactNode;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="obs-empty">
      <Mountain size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action && (
        <button onClick={action}>
          {label ?? "Начать"}
          <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}
export function ContextDrawer(props: Parameters<typeof Modal>[0]) {
  return <Modal {...props} presentation="sheet" />;
}
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  return <span className={`obs-badge ${tone}`}>{children}</span>;
}
export function ProgressRing({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${label}: ${value === null ? "нет данных" : value + "%"}`}
      className="obs-ring"
      style={{
        background: `conic-gradient(var(--accent-primary) ${(value ?? 0) * 3.6}deg,var(--surface-3) 0)`,
      }}
    >
      <span>
        {value ?? "—"}
        {value !== null && "%"}
      </span>
    </div>
  );
}
export function NotificationToast({
  children,
  action,
  onAction,
}: {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="toast" role="status">
      <Check size={15} />
      {children}
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}
/** Fixed row height, overscan and native table semantics; only visible rows are mounted. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  height = 480,
  rowHeight = 60,
}: {
  rows: T[];
  columns: { title: string; render: (row: T) => ReactNode }[];
  rowKey: (row: T) => string;
  height?: number;
  rowHeight?: number;
}) {
  const [scroll, setScroll] = useState(0);
  const start = Math.max(0, Math.floor(scroll / rowHeight) - 5);
  const end = Math.min(rows.length, start + Math.ceil(height / rowHeight) + 12);
  return (
    <div
      className="obs-data-table"
      style={{ maxHeight: height, overflow: "auto" }}
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
    >
      <table aria-rowcount={rows.length + 1}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {start > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={columns.length}
                style={{ height: start * rowHeight, padding: 0, border: 0 }}
              />
            </tr>
          )}
          {rows.slice(start, end).map((row, i) => (
            <tr
              key={rowKey(row)}
              aria-rowindex={start + i + 2}
              style={{ height: rowHeight }}
            >
              {columns.map((c, k) => (
                <td key={k}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
          {end < rows.length && (
            <tr aria-hidden="true">
              <td
                colSpan={columns.length}
                style={{
                  height: (rows.length - end) * rowHeight,
                  padding: 0,
                  border: 0,
                }}
              />
            </tr>
          )}
        </tbody>
      </table>
      {!rows.length && <EmptyState title="Пока нет записей" />}
    </div>
  );
}
export function BentoPanel({
  title,
  label,
  action,
  children,
  className = "",
}: {
  title: string;
  label?: string;
  action?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`fn-panel ${className}`}>
      <div className="fn-panel-head">
        <div>
          {label && <span className="fn-kicker">{label}</span>}
          <h2>{title}</h2>
        </div>
        {action && (
          <button
            className="fn-icon"
            aria-label={`Открыть: ${title}`}
            onClick={action}
          >
            <ArrowUpRight size={18} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
