"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Se dibuja en <body> para que ningún contenedor (barra lateral, tabla) lo tape.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className="card max-h-[86vh] w-full max-w-md overflow-y-auto p-5 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-black/5"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
