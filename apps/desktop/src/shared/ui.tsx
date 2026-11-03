import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactNode } from "react";
export function ModalDialog({
  title,
  children,
  onClose,
  presentation,
  dirty = false,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  presentation?: "sheet";
  dirty?: boolean;
  busy?: boolean;
}) {
  const [operationError, setOperationError] = useState("");
  useEffect(() => {
    const update = (event: Event) =>
      setOperationError(String((event as CustomEvent<string>).detail ?? ""));
    window.addEventListener("focus-operation-error", update);
    return () => window.removeEventListener("focus-operation-error", update);
  }, []);
  return (
    <Dialog.Root
      open
      onOpenChange={(v) => {
        if (
          !busy &&
          !v &&
          (!dirty || window.confirm("Закрыть без сохранения изменений?"))
        )
          onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={"overlay" + (presentation ? " fn-sheet-overlay" : "")}
        />
        <Dialog.Content className={"modal" + (presentation ? " fn-sheet" : "")}>
          <div className="row between">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close aria-label="Закрыть" disabled={busy}>
              ×
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">
            Изменения сохраняются локально на этом устройстве.
          </Dialog.Description>
          {operationError && (
            <p className="modal-error" role="alert" aria-live="assertive">
              {operationError}
            </p>
          )}
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

export const Modal = ModalDialog;
