"use client";

import { useState, useTransition } from "react";
import { FileSpreadsheet, Plus, X } from "lucide-react";
import type { ColumnType } from "@prisma/client";
import { createBoard, importBoardFromExcel } from "@/lib/actions";
import { BOARD_TEMPLATES, BUILTIN_COLUMNS, COLUMN_TYPES, columnTypeLabel } from "@/lib/columns";
import { TYPE_ICONS } from "@/components/board/column-icons";
import { Modal } from "./Modal";

type Col = { key: number; name: string; type: ColumnType };
let seq = 0;

export function NewBoardButton({ variant = "icon", departments = [] }: { variant?: "icon" | "button"; departments?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState("blank");
  const [cols, setCols] = useState<Col[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [mode, setMode] = useState<"new" | "excel">("new");

  const pickTemplate = (id: string) => {
    setTemplate(id);
    setCols((BOARD_TEMPLATES.find((t) => t.id === id)?.columns ?? []).map((c) => ({ ...c, key: ++seq })));
  };
  const reset = () => {
    setOpen(false);
    setTemplate("blank");
    setCols([]);
    setHidden([]);
    setMode("new");
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
        <div className="mb-4 flex gap-1 rounded-lg border border-line p-0.5 text-sm">
          {(["new", "excel"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 ${mode === m ? "bg-brand-700 text-white" : "hover:bg-canvas"}`}
            >
              {m === "new" ? <><Plus size={14} /> En blanco o plantilla</> : <><FileSpreadsheet size={14} /> Importar desde Excel</>}
            </button>
          ))}
        </div>
        {mode === "excel" ? (
          <ImportForm departments={departments} onCancel={reset} />
        ) : (
        <form action={createBoard} className="space-y-4" onSubmit={() => setTimeout(reset, 0)}>
          <div>
            <label className="label">Nombre</label>
            <input name="name" required autoFocus className="input" placeholder="Ej. Proyecto Torre Norte" />
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea name="description" rows={2} className="input" />
          </div>
          {departments.length > 0 && (
            <div>
              <label className="label">Departamento</label>
              <select name="departmentId" defaultValue={departments.length === 1 ? departments[0].id : ""} className="input">
                {departments.length > 1 && <option value="">Sin departamento</option>}
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted">Los administradores de este departamento también podrán ver y gestionar el tablero.</p>
            </div>
          )}

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
        )}
      </Modal>
    </>
  );
}

function ImportForm({ departments, onCancel }: { departments: { id: string; name: string }[]; onCancel: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError("");
        start(async () => {
          const r = await importBoardFromExcel(fd);
          if (r?.error) setError(r.error);
        });
      }}
    >
      <div>
        <label className="label">Archivo de Excel (.xlsx)</label>
        <input name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="input py-1.5" />
        <p className="mt-1 text-xs text-muted">
          Sirve una exportación de monday.com (con grupos y subelementos) o una tabla simple con encabezados en la primera fila. Cada columna se crea con el tipo
          que corresponde: fecha, número, estado con etiquetas, texto o enlace.
        </p>
      </div>
      <div>
        <label className="label">Nombre (opcional)</label>
        <input name="name" className="input" placeholder="Si lo dejas vacío, se toma del archivo" />
      </div>
      {departments.length > 0 && (
        <div>
          <label className="label">Departamento</label>
          <select name="departmentId" defaultValue="" className="input">
            <option value="">Sin departamento</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="matchPeople" className="mt-1 accent-brand-700" />
        <span>
          Llenar las columnas de personas con quienes ya están en la app
          <span className="block text-xs text-muted">Si no lo marcas, esas columnas quedan vacías para completarlas después.</span>
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Importando…" : "Importar y crear tablero"}</button>
      </div>
    </form>
  );
}
