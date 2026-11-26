import type { Prisma, User } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";
import { APP_TIMEZONE, priorityMeta, statusMeta } from "@/lib/constants";
import { asSettings, valueToText, type BoardColumnDef, type ColumnValue } from "@/lib/columns";
import { parseFilters, timeEntriesFor, type ReportFilters } from "@/lib/reports";

/** Registros exportables como evidencia (Excel, CSV y PDF). */

export type RecordKind = "actividad" | "tareas" | "tiempos";
export const RECORD_KINDS: RecordKind[] = ["actividad", "tareas", "tiempos"];

export type Cell = string | number | null;
export type RecordTable = {
  kind: RecordKind;
  title: string;
  /** Descripción de los filtros aplicados, para el encabezado del reporte. */
  scope: string[];
  headers: string[];
  /** Ancho sugerido de cada columna en Excel (caracteres). */
  widths: number[];
  rows: Cell[][];
};

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });

/** Fecha local (AAAA-MM-DD) en la zona horaria de la empresa. */
export const localDate = (d: Date | null | undefined) => (d ? dayFmt.format(d) : "");
/** Fecha y hora local (AAAA-MM-DD HH:MM). */
export const localStamp = (d: Date | null | undefined) => (d ? `${dayFmt.format(d)} ${timeFmt.format(d)}` : "");

const hours = (min: number) => Math.round((min / 60) * 100) / 100;
const personName = (u: { name: string | null; email: string }) => u.name ?? u.email;

export type RecordQuery = { range?: string; from?: string; to?: string; board?: string; user?: string };

async function scopeLines(f: ReportFilters, withDates = true) {
  const [board, person] = await Promise.all([
    f.boardId ? prisma.board.findUnique({ where: { id: f.boardId }, select: { name: true } }) : null,
    f.userId ? prisma.user.findUnique({ where: { id: f.userId }, select: { name: true, email: true } }) : null,
  ]);
  const lines: string[] = [];
  if (withDates) {
    const last = new Date(f.to.getTime() - 1);
    lines.push(`Periodo: ${format(f.from, "yyyy-MM-dd")} al ${format(last, "yyyy-MM-dd")}`);
  }
  lines.push(`Tablero: ${board?.name ?? "Todos"}`);
  lines.push(`Persona: ${person ? personName(person) : "Todas"}`);
  return lines;
}

/** Historial de actividad (no editable). Los administradores ven todo, incluido lo de tableros archivados. */
export async function activityRecords(user: User, q: RecordQuery): Promise<RecordTable> {
  const f = parseFilters(q);
  const where: Prisma.ActivityWhereInput = {
    createdAt: { gte: f.from, lt: f.to },
    ...(f.boardId ? { boardId: f.boardId } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(user.role === "ADMIN" ? {} : { board: visibleBoardsWhere(user) }),
  };
  const items = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } }, board: { select: { name: true } }, task: { select: { title: true } } },
  });
  return {
    kind: "actividad",
    title: "Registro de actividad",
    scope: await scopeLines(f),
    headers: ["Fecha y hora", "Persona", "Correo", "Tablero", "Tarea", "Acción", "Código", "ID del registro"],
    widths: [17, 22, 28, 24, 30, 60, 18, 28],
    rows: items.map((a) => [
      localStamp(a.createdAt),
      personName(a.user),
      a.user.email,
      a.board?.name ?? a.boardName ?? "",
      a.task?.title ?? a.taskTitle ?? "",
      a.detail ?? "",
      a.action,
      a.id,
    ]),
  };
}

/** Estado actual de las tareas. Si se elige un tablero, incluye sus columnas personalizadas. */
export async function taskRecords(user: User, q: RecordQuery): Promise<RecordTable> {
  const f = parseFilters(q);
  const tasks = await prisma.task.findMany({
    where: {
      board: visibleBoardsWhere(user),
      ...(f.boardId ? { boardId: f.boardId } : {}),
      ...(f.userId ? { assignees: { some: { userId: f.userId } } } : {}),
    },
    include: {
      board: { select: { name: true } },
      group: { select: { name: true, position: true } },
      parent: { select: { title: true } },
      createdBy: { select: { name: true, email: true } },
      assignees: { include: { user: { select: { name: true, email: true } } } },
      timeEntries: { select: { minutes: true } },
      values: true,
    },
    orderBy: [{ boardId: "asc" }, { position: "asc" }],
  });

  let columns: BoardColumnDef[] = [];
  let people: { id: string; name: string | null; email: string }[] = [];
  if (f.boardId) {
    const cols = await prisma.boardColumn.findMany({ where: { boardId: f.boardId }, orderBy: { position: "asc" } });
    columns = cols.map((c) => ({ id: c.id, name: c.name, type: c.type, position: c.position, settings: asSettings(c.settings) }));
    if (columns.some((c) => c.type === "PEOPLE")) people = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
  }

  const sorted = [...tasks].sort(
    (a, b) =>
      a.board.name.localeCompare(b.board.name) ||
      (a.group?.position ?? 0) - (b.group?.position ?? 0) ||
      a.position - b.position,
  );

  return {
    kind: "tareas",
    title: "Tareas",
    scope: [...(await scopeLines(f, false)), `Situación al: ${localStamp(new Date())}`],
    headers: [
      "Tablero", "Grupo", "Tarea", "Subtarea de", "Estado", "Prioridad", "Responsables",
      "Inicio", "Fecha límite", "Estimado (h)", "Tiempo registrado (h)", "Creada por", "Creada", "Terminada",
      ...columns.map((c) => c.name),
    ],
    widths: [22, 18, 36, 24, 13, 10, 30, 11, 12, 11, 12, 22, 17, 17, ...columns.map(() => 18)],
    rows: sorted.map((t) => {
      const vals = new Map(t.values.map((v) => [v.columnId, v.value as ColumnValue]));
      return [
        t.board.name,
        t.group?.name ?? "",
        t.title,
        t.parent?.title ?? "",
        statusMeta(t.status).label,
        priorityMeta(t.priority).label,
        t.assignees.map((a) => personName(a.user)).join(", "),
        localDate(t.startDate),
        localDate(t.dueDate),
        t.estimateMinutes ? hours(t.estimateMinutes) : null,
        hours(t.timeEntries.reduce((s, e) => s + e.minutes, 0)),
        personName(t.createdBy),
        localStamp(t.createdAt),
        localStamp(t.completedAt),
        ...columns.map((c) => valueToText(c, vals.get(c.id) ?? null, people)),
      ];
    }),
  };
}

/** Registros de tiempo terminados. */
export async function timeRecords(user: User, q: RecordQuery): Promise<RecordTable> {
  const f = parseFilters(q);
  const entries = await timeEntriesFor(user, f);
  return {
    kind: "tiempos",
    title: "Registro de tiempos",
    scope: await scopeLines(f),
    headers: ["Fecha", "Inicio", "Fin", "Persona", "Correo", "Tablero", "Tarea", "Subtarea de", "Minutos", "Horas", "Nota"],
    widths: [11, 7, 7, 22, 28, 22, 34, 24, 9, 8, 40],
    rows: entries.map((e) => [
      localDate(e.startedAt),
      timeFmt.format(e.startedAt),
      e.endedAt ? timeFmt.format(e.endedAt) : "",
      personName(e.user),
      e.user.email,
      e.task.board.name,
      e.task.title,
      e.task.parent?.title ?? "",
      e.minutes,
      hours(e.minutes),
      e.note ?? "",
    ]),
  };
}

export async function buildRecords(kind: RecordKind, user: User, q: RecordQuery) {
  if (kind === "actividad") return activityRecords(user, q);
  if (kind === "tareas") return taskRecords(user, q);
  return timeRecords(user, q);
}

export function recordsToCsv(t: RecordTable) {
  const cell = (v: Cell) => {
    const s = v === null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [t.headers, ...t.rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
