import type { TaskStatus, User } from "@prisma/client";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";

/** Datos del resumen ejecutivo (dashboard). */

export const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE"];
type StatusCounts = Record<TaskStatus, number>;
const emptyCounts = (): StatusCounts => ({ TODO: 0, IN_PROGRESS: 0, REVIEW: 0, BLOCKED: 0, DONE: 0 });

export type ProjectRow = {
  id: string;
  name: string;
  color: string;
  total: number;
  counts: StatusCounts;
  progress: number; // 0..1
  overdue: number;
  periodMinutes: number;
  loggedMinutes: number;
  estimateMinutes: number;
  completedInPeriod: number;
};

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  open: number;
  counts: StatusCounts; // solo tareas abiertas
  overdue: number;
  dueThisWeek: number;
  periodMinutes: number;
  completedInPeriod: number;
};

export type DashboardData = {
  from: Date;
  to: Date;
  totals: { boards: number; open: number; overdue: number; blocked: number; completedInPeriod: number; periodMinutes: number; dueThisWeek: number };
  projects: ProjectRow[];
  people: PersonRow[];
  weekly: { key: string; label: string; minutes: number }[];
  attention: {
    id: string;
    title: string;
    boardId: string;
    boardName: string;
    boardColor: string;
    status: TaskStatus;
    dueDate: Date | null;
    reason: "overdue" | "blocked";
    assignees: string[];
  }[];
};

export async function buildDashboard(user: User, opts: { days: number; boardId?: string }): Promise<DashboardData> {
  const today = startOfDay(new Date());
  const to = addDays(today, 1);
  const from = addDays(today, -(opts.days - 1));
  const weekEnd = addDays(today, 7);
  const boardWhere = visibleBoardsWhere(user);
  const boardFilter = opts.boardId ? { id: opts.boardId } : {};
  const weeksFrom = startOfWeek(addDays(today, -7 * 11), { weekStartsOn: 1 });

  const [boards, tasks, entries, weeklyEntries] = await Promise.all([
    prisma.board.findMany({ where: { ...boardWhere, ...boardFilter }, select: { id: true, name: true, color: true }, orderBy: { name: "asc" } }),
    prisma.task.findMany({
      where: { board: { ...boardWhere, ...boardFilter } },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        completedAt: true,
        estimateMinutes: true,
        parentId: true,
        boardId: true,
        assignees: { select: { user: { select: { id: true, name: true, email: true, image: true, active: true } } } },
      },
    }),
    prisma.timeEntry.findMany({
      where: { endedAt: { not: null }, task: { board: { ...boardWhere, ...boardFilter } } },
      select: { minutes: true, startedAt: true, userId: true, task: { select: { boardId: true } } },
    }),
    prisma.timeEntry.findMany({
      where: { endedAt: { not: null }, startedAt: { gte: weeksFrom }, task: { board: { ...boardWhere, ...boardFilter } } },
      select: { minutes: true, startedAt: true },
    }),
  ]);

  const inPeriod = (d: Date | null) => !!d && d >= from && d < to;
  const isOverdue = (t: { status: TaskStatus; dueDate: Date | null }) => t.status !== "DONE" && !!t.dueDate && t.dueDate < today;
  const boardMeta = new Map(boards.map((b) => [b.id, b]));

  // --- por proyecto (solo tareas principales, como en los tableros) ---
  const projects = new Map<string, ProjectRow>(
    boards.map((b) => [
      b.id,
      { id: b.id, name: b.name, color: b.color, total: 0, counts: emptyCounts(), progress: 0, overdue: 0, periodMinutes: 0, loggedMinutes: 0, estimateMinutes: 0, completedInPeriod: 0 },
    ]),
  );
  for (const t of tasks) {
    const p = projects.get(t.boardId);
    if (!p || t.parentId) continue;
    p.total++;
    p.counts[t.status]++;
    if (isOverdue(t)) p.overdue++;
    if (t.status === "DONE" && inPeriod(t.completedAt)) p.completedInPeriod++;
    p.estimateMinutes += t.estimateMinutes ?? 0;
  }
  for (const e of entries) {
    const p = projects.get(e.task.boardId);
    if (!p) continue;
    p.loggedMinutes += e.minutes;
    if (inPeriod(e.startedAt)) p.periodMinutes += e.minutes;
  }
  for (const p of projects.values()) p.progress = p.total ? p.counts.DONE / p.total : 0;

  // --- por persona (tareas y subtareas asignadas) ---
  const people = new Map<string, PersonRow>();
  const person = (u: { id: string; name: string | null; email: string; image: string | null }) => {
    let r = people.get(u.id);
    if (!r) {
      r = { id: u.id, name: u.name ?? u.email, email: u.email, image: u.image, open: 0, counts: emptyCounts(), overdue: 0, dueThisWeek: 0, periodMinutes: 0, completedInPeriod: 0 };
      people.set(u.id, r);
    }
    return r;
  };
  for (const t of tasks) {
    for (const { user: u } of t.assignees) {
      if (!u.active) continue;
      const r = person(u);
      if (t.status === "DONE") {
        if (inPeriod(t.completedAt)) r.completedInPeriod++;
        continue;
      }
      r.open++;
      r.counts[t.status]++;
      if (isOverdue(t)) r.overdue++;
      else if (t.dueDate && t.dueDate < weekEnd) r.dueThisWeek++;
    }
  }
  const periodByUser = new Map<string, number>();
  for (const e of entries) if (inPeriod(e.startedAt)) periodByUser.set(e.userId, (periodByUser.get(e.userId) ?? 0) + e.minutes);
  if (periodByUser.size) {
    const extra = await prisma.user.findMany({
      where: { id: { in: [...periodByUser.keys()].filter((id) => !people.has(id)) }, active: true },
      select: { id: true, name: true, email: true, image: true },
    });
    extra.forEach(person);
    for (const [id, m] of periodByUser) {
      const r = people.get(id);
      if (r) r.periodMinutes = m;
    }
  }

  // --- horas por semana (últimas 12) ---
  const weekly: DashboardData["weekly"] = [];
  for (let d = weeksFrom; d <= today; d = addDays(d, 7)) {
    weekly.push({ key: format(d, "yyyy-MM-dd"), label: format(d, "d MMM", { locale: es }), minutes: 0 });
  }
  for (const e of weeklyEntries) {
    const k = format(startOfWeek(e.startedAt, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const w = weekly.find((x) => x.key === k);
    if (w) w.minutes += e.minutes;
  }

  // --- lo que necesita atención ---
  const attention = tasks
    .filter((t) => isOverdue(t) || t.status === "BLOCKED")
    .map((t) => {
      const b = boardMeta.get(t.boardId)!;
      return {
        id: t.id,
        title: t.title,
        boardId: t.boardId,
        boardName: b.name,
        boardColor: b.color,
        status: t.status,
        dueDate: t.dueDate,
        reason: (isOverdue(t) ? "overdue" : "blocked") as "overdue" | "blocked",
        assignees: t.assignees.map((a) => a.user.name ?? a.user.email),
      };
    })
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));

  const projectList = [...projects.values()].sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  const peopleList = [...people.values()].sort((a, b) => b.open - a.open || b.periodMinutes - a.periodMinutes);

  const open = tasks.filter((t) => t.status !== "DONE");
  return {
    from,
    to,
    totals: {
      boards: boards.length,
      open: open.length,
      overdue: open.filter(isOverdue).length,
      blocked: open.filter((t) => t.status === "BLOCKED").length,
      completedInPeriod: tasks.filter((t) => t.status === "DONE" && inPeriod(t.completedAt)).length,
      periodMinutes: entries.filter((e) => inPeriod(e.startedAt)).reduce((s, e) => s + e.minutes, 0),
      dueThisWeek: open.filter((t) => !isOverdue(t) && t.dueDate && t.dueDate < weekEnd).length,
    },
    projects: projectList,
    people: peopleList,
    weekly,
    attention,
  };
}
