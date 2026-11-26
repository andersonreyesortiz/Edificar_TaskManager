"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Menú flotante. Usa posición fija para que no lo recorten contenedores con scroll
 * (por ejemplo la tabla del tablero).
 */
export function Popover({
  trigger,
  children,
  align = "left",
  width = 220,
  className = "relative inline-block",
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    if (below < 200 && above > below) {
      const maxHeight = Math.min(360, above);
      setPos({ top: Math.max(8, r.top - 4 - maxHeight), left, maxHeight });
    } else {
      setPos({ top: r.bottom + 4, left, maxHeight: Math.min(360, below) });
    }
  };

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onMove = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} className={className}>
      <div ref={triggerRef} onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && pos && (
        <div
          className="fixed z-50 overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-lg"
          style={{ width, top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
