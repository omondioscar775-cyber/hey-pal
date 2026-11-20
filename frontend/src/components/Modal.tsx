"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  children,
  label,
  onClose,
  pending,
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  pending: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className="editor-dialog"
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
