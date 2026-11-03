import { forwardRef, type HTMLAttributes } from "react";
import type { Item } from "../../../../packages/contracts";
type CardProps = HTMLAttributes<HTMLElement> & { item: Item };
/** Domain surfaces share identity, accessible labelling and transition feedback. */
export function TaskCard({ item, className = "", ...props }: CardProps) {
  return (
    <article
      {...props}
      data-entity={item.id}
      aria-label={`Задача: ${item.title}`}
      className={`obs-domain-card ${className}`}
    />
  );
}
export function ProjectCard({ item, className = "", ...props }: CardProps) {
  return (
    <section
      {...props}
      data-entity={item.id}
      aria-label={`Проект: ${item.title}`}
      className={`obs-domain-card ${className}`}
    />
  );
}
export function WorkoutCard({ item, className = "", ...props }: CardProps) {
  return (
    <article
      {...props}
      data-entity={item.id}
      aria-label={`Тренировка: ${item.title}`}
      className={`obs-domain-card ${className}`}
    />
  );
}
export const Timeline = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function Timeline({ className = "", ...props }, ref) {
  return (
    <div
      {...props}
      ref={ref}
      className={`timeline-scroll ${className}`}
      aria-label="Временная шкала"
    />
  );
});
export function CalendarEvent({ item, ...props }: CardProps) {
  return (
    <div
      {...props}
      data-entity={item.id}
      aria-label={`${item.title}, ${item.time ?? "без времени"}`}
    />
  );
}
