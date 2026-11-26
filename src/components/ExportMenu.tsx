"use client";

import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Popover } from "@/components/Popover";

type Kind = "actividad" | "tareas" | "tiempos";

/** Menú para descargar registros como evidencia: Excel, CSV o PDF. */
export function ExportMenu({ kind, query, label = "Exportar" }: { kind: Kind; query: Record<string, string | undefined>; label?: string }) {
  const qs = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    Object.entries({ ...query, ...extra }).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const item = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-canvas";
  return (
    <Popover
      align="right"
      width={230}
      trigger={() => (
        <button className="btn-outline"><Download size={14} /> {label}</button>
      )}
    >
      {(close) => (
        <div className="p-1">
          <a href={`/api/export/${kind}${qs({ format: "xlsx" })}`} onClick={close} className={item}>
            <FileSpreadsheet size={15} className="text-[#16a34a]" /> Excel (.xlsx)
          </a>
          <a href={`/api/export/${kind}${qs({ format: "csv" })}`} onClick={close} className={item}>
            <FileText size={15} className="text-muted" /> CSV
          </a>
          <a href={`/imprimir/${kind}${qs()}`} target="_blank" rel="noopener" onClick={close} className={item}>
            <Printer size={15} className="text-[#00A0E3]" /> PDF (imprimir)
          </a>
        </div>
      )}
    </Popover>
  );
}
