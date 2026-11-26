"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createBoard } from "@/lib/actions";
import { Modal } from "./Modal";

export function NewBoardButton({ variant = "icon" }: { variant?: "icon" | "button" }) {
  const [open, setOpen] = useState(false);
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
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo tablero">
        <form action={createBoard} className="space-y-4" onSubmit={() => setTimeout(() => setOpen(false), 0)}>
          <div>
            <label className="label">Nombre</label>
            <input name="name" required autoFocus className="input" placeholder="Ej. Proyecto Torre Norte" />
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea name="description" rows={3} className="input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancelar</button>
            <button className="btn-primary">Crear tablero</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
