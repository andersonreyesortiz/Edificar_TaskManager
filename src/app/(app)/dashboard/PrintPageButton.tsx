"use client";

import { Printer } from "lucide-react";

export function PrintPageButton() {
  return (
    <button onClick={() => window.print()} className="btn-outline" title="Imprimir o guardar como PDF">
      <Printer size={14} /> PDF
    </button>
  );
}
