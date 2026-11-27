"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { Modal } from "@/components/Modal";
import { STATUSES, isClosed } from "@/lib/constants";
import { LABEL_COLORS } from "@/lib/columns";
import { setBoardStatusConfig } from "@/lib/actions";
import { useStatuses } from "./StatusContext";

/** Ventana para elegir qué estados usa el tablero y cambiarles el nombre o el color. */
export function StatusManager({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const { all } = useStatuses();
  const [rows, setRows] = useState(all.map((o) => ({ ...o })));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const update = (v: TaskStatus, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x) => (x.value === v ? { ...x, ...patch } : x)));
  const base = (v: TaskStatus) => STATUSES.find((s) => s.value === v)!;

  const save = () => {
    if (rows.every((r) => r.hidden)) return setError("Deja al menos un estado en uso.");
    const config = {
      hidden: rows.filter((r) => r.hidden).map((r) => r.value),
      labels: Object.fromEntries(rows.filter((r) => r.label.trim() && r.label.trim() !== base(r.value).label).map((r) => [r.value, r.label.trim()])),
      colors: Object.fromEntries(rows.filter((r) => r.color !== base(r.value).color).map((r) => [r.value, r.color])),
    };
    start(async () => {
      try {
        await setBoardStatusConfig(boardId, config);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  };

  return (
    <Modal open onClose={onClose} title="Estados de este tablero">
      <p className="text-sm text-muted">
        Elige qué estados se pueden usar, y cámbiales el nombre o el color. Los estados marcados como «cierra la tarea» la dan por resuelta
        (deja de contar como pendiente o atrasada).
      </p>
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.value} className={`flex flex-wrap items-center gap-2 rounded-lg border border-line px-2 py-2 ${r.hidden ? "opacity-60" : ""}`}>
            <button
              type="button"
              onClick={() => update(r.value, { hidden: !r.hidden })}
              className="rounded p-1 text-muted hover:bg-canvas"
              title={r.hidden ? "Usar este estado" : "No usar este estado"}
            >
              {r.hidden ? <EyeOff size={15} /> : <Eye size={15} className="text-[#00A0E3]" />}
            </button>
            <input
              value={r.label}
              onChange={(e) => update(r.value, { label: e.target.value })}
              maxLength={40}
              className="input w-40 flex-1 py-1 text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {[base(r.value).color, ...LABEL_COLORS.filter((c) => c !== base(r.value).color)].slice(0, 9).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update(r.value, { color: c })}
                  className={`h-5 w-5 rounded ${r.color === c ? "ring-2 ring-offset-1 ring-ink/50" : ""}`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
            <span className="w-24 text-right text-[11px] text-muted">{isClosed(r.value) ? "cierra la tarea" : ""}</span>
            {(r.label !== base(r.value).label || r.color !== base(r.value).color) && (
              <button type="button" onClick={() => update(r.value, { label: base(r.value).label, color: base(r.value).color })} className="rounded p-1 text-muted hover:bg-canvas" title="Volver al original">
                <RotateCcw size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btn-outline">Cancelar</button>
        <button onClick={save} disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar"}</button>
      </div>
    </Modal>
  );
}
