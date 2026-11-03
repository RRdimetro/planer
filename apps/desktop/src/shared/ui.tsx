import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
export function Modal({
  title,
  children,
  onClose,
  presentation,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  presentation?: "sheet";
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={"overlay" + (presentation ? " fn-sheet-overlay" : "")}
        />
        <Dialog.Content className={"modal" + (presentation ? " fn-sheet" : "")}>
          <div className="row between">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close aria-label="Закрыть">×</Dialog.Close>
          </div>
          <Dialog.Description className="muted">
            Изменения сохраняются локально на этом устройстве.
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <span>◇</span>
      <p>{children}</p>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
