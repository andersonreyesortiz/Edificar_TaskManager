"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintButton() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#00A0E3] px-3 py-1.5 font-medium text-white hover:bg-[#008cc7]">
      <Printer size={14} /> Imprimir o guardar PDF
    </button>
  );
}
