"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Menú flotante. Se dibuja en <body> con posición fija para que no lo recorten ni lo
 * desplacen contenedores con scroll o con efectos (la tabla del tablero, la barra superior).
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
  // Marca los clics hechos dentro del menú (incluidos menús anidados, que React propaga por el portal).
  const insideRef = useRef(false);

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = document.documentElement.clientWidth;
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
    insideRef.current = false;
    const onDown = (e: MouseEvent) => {
      const inside = insideRef.current || (ref.current?.contains(e.target as Node) ?? false);
      insideRef.current = false;
      if (!inside) setOpen(false);
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
    <div ref={ref} className={className} onMouseDown={() => (insideRef.current = true)}>
      <div ref={triggerRef} onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open &&
        pos &&
        createPortal(
          <div
            className="fixed z-[70] overflow-y-auto rounded-lg border border-line bg-white p-1 text-left shadow-lg"
            style={{ width, top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </div>
  );
}
