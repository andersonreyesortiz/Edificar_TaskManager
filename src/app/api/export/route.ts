import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parseFilters, timeEntriesFor } from "@/lib/reports";

function csv(v: string | number | null | undefined) {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const entries = await timeEntriesFor(user, parseFilters(sp));
  const rows = [
    ["Fecha", "Persona", "Correo", "Tablero", "Tarea", "Subtarea de", "Minutos", "Horas", "Nota"],
    ...entries.map((e) => [
      e.startedAt.toISOString().slice(0, 10),
      e.user.name ?? "",
      e.user.email,
      e.task.board.name,
      e.task.title,
      e.task.parent?.title ?? "",
      e.minutes,
      (e.minutes / 60).toFixed(2),
      e.note ?? "",
    ]),
  ];
  const body = "﻿" + rows.map((r) => r.map(csv).join(",")).join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tiempos.csv"`,
    },
  });
}
