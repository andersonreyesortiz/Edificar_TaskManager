"use client";

import { createContext, useContext } from "react";
import type { TaskStatus } from "@prisma/client";
import { statusOptions, type StatusOption } from "@/lib/status-config";

const Ctx = createContext<StatusOption[] | null>(null);

/** Comparte los estados del tablero (nombres, colores y cuáles están activos) con sus celdas. */
export function BoardStatusProvider({ options, children }: { options: StatusOption[]; children: React.ReactNode }) {
  return <Ctx.Provider value={options}>{children}</Ctx.Provider>;
}

export function useStatuses() {
  const all = useContext(Ctx) ?? statusOptions();
  const meta = (s: TaskStatus) => all.find((o) => o.value === s)!;
  return { all, visible: all.filter((o) => !o.hidden), meta };
}
