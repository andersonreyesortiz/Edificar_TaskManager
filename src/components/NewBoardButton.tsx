"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ColumnType } from "@prisma/client";
import { createBoard } from "@/lib/actions";
import { BOARD_TEMPLATES, BUILTIN_COLUMNS, COLUMN_TYPES, columnTypeLabel } from "@/lib/columns";
import { TYPE_ICONS } from "@/components/board/column-icons";
import { Modal } from "./Modal";

type Col = { key: number; name: string; type: ColumnType };
let seq = 0;

export function NewBoardButton({ variant = "icon" }: { variant?: "icon" | "button" }) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState("blank");
  const [cols, setCols] = useState<Col[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);

  const pickTemplate = (id: string) => {
    setTemplate(id);
    setCols((BOARD_TEMPLATES.find((t) => t.id === id)?.columns ?? []).map((c) => ({ ...c, key: ++seq })));
  };
  const reset = () => {
    setOpen(false);
    setTemplate("blank");
    setCols([]);
    setHidden([]);
  };

  return (
    <>
      {variant === "icon" ? (
        <button onClick={() => setOpen(true)} className="rounded-md p-1 hover:bg-black/5" title="Nuevo tablero">
          <Plus size={14} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus size={16} /> Nuevo tablero
        </button>
      )}
      <Modal open={open} onClose={reset} title="Nuevo tablero">
        <form action={createBoard} className="space-y-4" onSubmit={() => setTimeout(reset, 0)}>
          <div>
            <label className="label">Nombre</label>
            <input name="name" required autoFocus className="input" placeholder="Ej. Proyecto Torre Norte" />
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea name="description" rows={2} className="input" />
          </div>

          <div>
            <label className="label">Plantilla</label>
            <div className="grid grid-cols-2 gap-2">
              {BOARD_TEMPLATES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => pickTemplate(t.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${template === t.id ? "border-brand-500 bg-brand-50" : "border-line hover:bg-canvas"}`}
                >
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-xs text-muted">{t.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Columnas</label>
            <div className="flex flex-wrap gap-1.5">
              {BUILTIN_COLUMNS.map((b) => {
                const on = !hidden.includes(b.key);
                return (
                  <label key={b.key} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${on ? "border-brand-500 bg-brand-50" : "border-line text-muted line-through"}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={on}
                      onChange={() => setHidden((h) => (on ? [...h, b.key] : h.filter((x) => x !== b.key)))}
                    />
                    {b.label}
                  </label>
                );
              })}
            </div>
            {hidden.map((k) => <input key={k} type="hidden" name="hide" value={k} />)}

            <div className="mt-2 space-y-1.5">
              {cols.map((c) => {
                const Icon = TYPE_ICONS[c.type];
                return (
                  <div key={c.key} className="flex items-center gap-2">
                    <span className="inline-flex w-28 shrink-0 items-center gap-1.5 text-xs text-muted"><Icon size={13} className="text-brand-700" /> {columnTypeLabel(c.type)}</span>
                    <input
                      value={c.name}
                      onChange={(e) => setCols((cs) => cs.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)))}
                      className="input py-1"
                    />
                    <button type="button" onClick={() => setCols((cs) => cs.filter((x) => x.key !== c.key))} className="rounded p-1 text-muted hover:text-red-600" title="Quitar">
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            <select
              value=""
              onChange={(e) => {
                const type = e.target.value as ColumnType;
                if (type) setCols((cs) => [...cs, { key: ++seq, name: columnTypeLabel(type), type }]);
              }}
              className="input mt-2 w-auto py-1 text-sm"
            >
              <option value="">+ Agregar columna…</option>
              {COLUMN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label} · {t.hint}</option>
              ))}
            </select>
            <input type="hidden" name="columns" value={JSON.stringify(cols.map(({ name, type }) => ({ name, type })))} />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="btn-ghost">Cancelar</button>
            <button className="btn-primary">Crear tablero</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
