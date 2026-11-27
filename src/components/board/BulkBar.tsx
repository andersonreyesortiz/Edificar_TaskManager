"use client";

import { useState, useTransition } from "react";
import { Archive, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { bulkUpdateTasks, type BulkOp } from "@/lib/actions";
import { PRIORITIES } from "@/lib/constants";
import { Modal } from "@/components/Modal";
import { useStatuses } from "./StatusContext";
import type { BoardGroup, Person } from "./types";

/** Barra flotante para aplicar una acción a varias tareas a la vez. */
export function BulkBar({
  ids,
  onClear,
  people,
  groups,
  canEdit,
}: {
  ids: string[];
  onClear: () => void;
  people: Person[];
  groups: BoardGroup[];
  /** Editor o dueño. Los colaboradores solo pueden cambiar el estado (o archivar) sus tareas. */
  canEdit: boolean;
}) {
  const statuses = useStatuses();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const n = ids.length;
  const plural = (k: number) => (k === 1 ? "tarea" : "tareas");

  // El verbo va en plural ("archivadas"); con una sola tarea se usa el singular.
  const run = (op: BulkOp, verb: string) =>
    start(async () => {
      setMsg(null);
      try {
        const r = await bulkUpdateTasks(ids, op);
        const text = `${r.done} ${plural(r.done)} ${r.done === 1 ? verb.replace(/^(\w+)s\b/, "$1") : verb}.` + (r.skipped ? ` ${r.skipped} sin cambio${r.error ? `: ${r.error}` : "."}` : "");
        setMsg({ text, bad: r.skipped > 0 });
        if (r.done) onClear();
        router.refresh();
      } catch (e) {
        setMsg({ text: e instanceof Error ? e.message : "No se pudo aplicar la acción.", bad: true });
      }
    });

  if (!n && !msg) return null;
  const sel = "input h-8 w-auto py-0 text-sm";
  const archived = statuses.all.find((s) => s.value === "ARCHIVED");

  return (
    <>
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-xl" role="toolbar" aria-label="Acciones en masa">
        {n > 0 ? (
          <>
            <span className="flex items-center gap-2 pr-1 text-sm font-medium">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-700 px-1.5 text-xs text-white">{n}</span>
              {n === 1 ? "seleccionada" : "seleccionadas"}
            </span>
            <select
              className={sel}
              value=""
              disabled={pending}
              aria-label="Cambiar estado"
              onChange={(e) => e.target.value && run({ kind: "status", status: e.target.value as never }, "cambiadas de estado")}
            >
              <option value="">Estado…</option>
              {statuses.visible.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {canEdit && (
              <>
                <select
                  className={sel}
                  value=""
                  disabled={pending}
                  aria-label="Cambiar prioridad"
                  onChange={(e) => e.target.value && run({ kind: "priority", priority: e.target.value as never }, "cambiadas de prioridad")}
                >
                  <option value="">Prioridad…</option>
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <select
                  className={sel}
                  value=""
                  disabled={pending}
                  aria-label="Asignar responsable"
                  onChange={(e) => {
                    const [kind, userId] = e.target.value.split(":");
                    if (userId) run({ kind: kind as "assign" | "unassign", userId }, kind === "assign" ? "asignadas" : "actualizadas");
                  }}
                >
                  <option value="">Responsable…</option>
                  <optgroup label="Agregar a">
                    {people.map((p) => <option key={p.id} value={`assign:${p.id}`}>{p.name ?? p.email}</option>)}
                  </optgroup>
                  <optgroup label="Quitar a">
                    {people.map((p) => <option key={p.id} value={`unassign:${p.id}`}>{p.name ?? p.email}</option>)}
                  </optgroup>
                </select>
                {groups.length > 1 && (
                  <select
                    className={sel}
                    value=""
                    disabled={pending}
                    aria-label="Mover a grupo"
                    onChange={(e) => e.target.value && run({ kind: "group", groupId: e.target.value }, "movidas")}
                  >
                    <option value="">Mover a…</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
              </>
            )}
            {archived && !archived.hidden && (
              <button className="btn-outline h-8 py-0" disabled={pending} onClick={() => run({ kind: "status", status: "ARCHIVED" }, "archivadas")}>
                <Archive size={14} /> Archivar
              </button>
            )}
            {canEdit && (
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} /> Borrar
              </button>
            )}
            {pending && <span className="text-xs text-muted">Aplicando…</span>}
          </>
        ) : null}
        {msg && <span className={`max-w-md text-xs ${msg.bad ? "text-amber-700" : "text-green-700"}`}>{msg.text}</span>}
        <button
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
          onClick={() => {
            setMsg(null);
            onClear();
          }}
          title="Quitar la selección"
          aria-label="Quitar la selección"
        >
          <X size={16} />
        </button>
      </div>
    </div>
      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(false)} title={`Borrar ${n} ${plural(n)}`}>
          <p className="text-sm text-muted">
            Se borrarán las tareas elegidas con sus subtareas, comentarios y tiempos registrados. No se puede deshacer, pero el historial deja constancia de cada una.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(false)} className="btn-outline">Cancelar</button>
            <button
              onClick={() => {
                setConfirmDelete(false);
                run({ kind: "delete" }, "borradas");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <Trash2 size={14} /> Borrar {n} {plural(n)}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
