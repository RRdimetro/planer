import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type HTMLAttributes, type ReactNode } from "react";
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
      <strong key={String(value)} className="rc-metric-value">
        {value}
      </strong>
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
/** Measured variable-height rows, sticky native headers and bounded DOM size. */
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
  const parent = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => rowKey(rows[index]),
    overscan: 6,
  });
  const items = virtual.getVirtualItems();
  const top = items[0]?.start ?? 0,
    bottom = virtual.getTotalSize() - (items.at(-1)?.end ?? 0);
  return (
    <div
      ref={parent}
      className="obs-data-table"
      style={{ maxHeight: height, overflow: "auto" }}
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
          {top > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={columns.length}
                style={{ height: top, padding: 0, border: 0 }}
              />
            </tr>
          )}
          {items.map((v) => (
            <tr
              key={v.key}
              data-index={v.index}
              ref={virtual.measureElement}
              aria-rowindex={v.index + 2}
            >
              {columns.map((c, k) => (
                <td key={k}>{c.render(rows[v.index])}</td>
              ))}
            </tr>
          ))}
          {bottom > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={columns.length}
                style={{ height: bottom, padding: 0, border: 0 }}
              />
            </tr>
          )}
        </tbody>
      </table>
      {!rows.length && <EmptyState title="Пока нет записей" />}
    </div>
  );
}
export function VirtualList<T>({
  rows,
  rowKey,
  render,
}: {
  rows: T[];
  rowKey: (row: T) => string;
  render: (row: T) => ReactNode;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 150,
    getItemKey: (index) => rowKey(rows[index]),
    overscan: 4,
  });
  if (rows.length < 50) return <>{rows.map(render)}</>;
  return (
    <div
      ref={parent}
      className="obs-virtual-cards"
      style={{ height: 540, overflow: "auto" }}
    >
      <div
        style={{
          height: virtual.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {virtual.getVirtualItems().map((v) => (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtual.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${v.start}px)`,
            }}
          >
            {render(rows[v.index])}
          </div>
        ))}
      </div>
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
