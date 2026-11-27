import type { User } from "@prisma/client";
import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";
import { APP_TIMEZONE, CLOSED_STATUSES, isClosed } from "@/lib/constants";

/** Día calendario (yyyy-MM-dd) de una fecha en la zona horaria de la empresa. */
const localDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(d);

export type ReportFilters = { from: Date; to: Date; boardId?: string; userId?: string };

export function parseFilters(sp: { range?: string; from?: string; to?: string; board?: string; user?: string }): ReportFilters {
  const today = startOfDay(new Date());
  let from: Date;
  let to = addDays(today, 1);
  if (sp.from && sp.to) {
    from = new Date(`${sp.from}T00:00:00`);
    to = addDays(new Date(`${sp.to}T00:00:00`), 1);
  } else {
    const days = Number(sp.range ?? 30) || 30;
    from = addDays(today, -(days - 1));
  }
  return { from, to, boardId: sp.board || undefined, userId: sp.user || undefined };
}

export async function timeEntriesFor(user: User, f: ReportFilters) {
  return prisma.timeEntry.findMany({
    where: {
      startedAt: { gte: f.from, lt: f.to },
      endedAt: { not: null },
      ...(f.userId ? { userId: f.userId } : {}),
      task: { board: visibleBoardsWhere(user), ...(f.boardId ? { boardId: f.boardId } : {}) },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, title: true, boardId: true, board: { select: { name: true, color: true } }, parent: { select: { title: true } } } },
    },
    orderBy: { startedAt: "asc" },
  });
}

export async function buildReport(user: User, f: ReportFilters) {
  const entries = await timeEntriesFor(user, f);
  const taskWhere = {
    board: visibleBoardsWhere(user),
    ...(f.boardId ? { boardId: f.boardId } : {}),
    ...(f.userId ? { assignees: { some: { userId: f.userId } } } : {}),
  };
  const [byStatus, completed, overdue] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], where: taskWhere, _count: true }),
    prisma.task.count({ where: { ...taskWhere, completedAt: { gte: f.from, lt: f.to } } }),
    prisma.task.count({ where: { ...taskWhere, status: { notIn: CLOSED_STATUSES }, dueDate: { lt: startOfDay(new Date()) } } }),
  ]);

  const sum = <K extends string>(key: (e: (typeof entries)[number]) => K, label: (e: (typeof entries)[number]) => string) => {
    const m = new Map<K, { key: K; label: string; minutes: number }>();
    for (const e of entries) {
      const k = key(e);
      const cur = m.get(k) ?? { key: k, label: label(e), minutes: 0 };
      cur.minutes += e.minutes;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.minutes - a.minutes);
  };

  const byPerson = sum((e) => e.userId, (e) => e.user.name ?? e.user.email);
  const byBoard = sum((e) => e.task.boardId, (e) => e.task.board.name);
  const byTask = sum((e) => e.taskId, (e) => (e.task.parent ? `${e.task.parent.title} › ${e.task.title}` : e.task.title)).slice(0, 10);

  // Serie temporal: por día si el rango es corto, por semana si es largo.
  const days = differenceInCalendarDays(f.to, f.from);
  const weekly = days > 45;
  const buckets: { key: string; label: string; minutes: number }[] = [];
  if (weekly) {
    for (let d = startOfWeek(f.from, { weekStartsOn: 1 }); d < f.to; d = addDays(d, 7)) {
      buckets.push({ key: format(d, "yyyy-MM-dd"), label: format(d, "d MMM", { locale: es }), minutes: 0 });
    }
  } else {
    for (let d = f.from; d < f.to; d = addDays(d, 1)) {
      buckets.push({ key: format(d, "yyyy-MM-dd"), label: format(d, "d MMM", { locale: es }), minutes: 0 });
    }
  }
  for (const e of entries) {
    const day = new Date(`${localDay(e.startedAt)}T00:00:00`);
    const k = format(weekly ? startOfWeek(day, { weekStartsOn: 1 }) : day, "yyyy-MM-dd");
    const b = buckets.find((x) => x.key === k);
    if (b) b.minutes += e.minutes;
  }

  // Matriz persona × tablero para la tabla.
  const matrix = byPerson.map((p) => ({
    person: p.label,
    total: p.minutes,
    boards: Object.fromEntries(
      byBoard.map((b) => [
        b.key,
        entries.filter((e) => e.userId === p.key && e.task.boardId === b.key).reduce((a, e) => a + e.minutes, 0),
      ]),
    ),
  }));

  return {
    totalMinutes: entries.reduce((a, e) => a + e.minutes, 0),
    completed,
    overdue,
    open: byStatus.filter((s) => !isClosed(s.status)).reduce((a, s) => a + s._count, 0),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byPerson,
    byBoard,
    byTask,
    series: buckets,
    weekly,
    matrix,
  };
}
