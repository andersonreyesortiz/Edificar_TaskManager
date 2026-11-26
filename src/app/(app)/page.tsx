import Link from "next/link";
import { startOfWeek } from "date-fns";
import { requireUser } from "@/lib/session";
import { boardDepartmentChoices } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";
import { myTasks } from "@/lib/queries";
import { formatMinutes, STATUSES } from "@/lib/constants";
import { TaskListTable } from "@/components/TaskListTable";
import { ActivityList } from "@/components/ActivityList";
import { NewBoardButton } from "@/components/NewBoardButton";

export default async function HomePage() {
  const user = await requireUser();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const today = new Date(new Date().toDateString());

  const [boards, pending, weekTime, activity] = await Promise.all([
    prisma.board.findMany({
      where: visibleBoardsWhere(user),
      orderBy: { updatedAt: "desc" },
      include: { tasks: { where: { parentId: null }, select: { status: true } }, _count: { select: { members: true } } },
    }),
    myTasks(user, { status: { not: "DONE" } }),
    prisma.timeEntry.aggregate({ where: { userId: user.id, startedAt: { gte: weekStart } }, _sum: { minutes: true } }),
    prisma.activity.findMany({
      where: { board: visibleBoardsWhere(user) },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: true, board: { select: { name: true, color: true } } },
    }),
  ]);

  const overdue = pending.filter((t) => t.dueDate && t.dueDate < today).length;
  const first = (user.name ?? user.email).split(/[\s@]/)[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">Hola, {first}</h1>
      <p className="mt-1 text-sm text-muted">Esto es lo que tienes pendiente.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Tareas abiertas asignadas a ti" value={String(pending.length)} />
        <Stat label="Vencidas" value={String(overdue)} tone={overdue ? "bad" : undefined} />
        <Stat label="Tu tiempo esta semana" value={formatMinutes(weekTime._sum.minutes ?? 0)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="card min-w-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Mis tareas abiertas</h2>
            <Link href="/my-tasks" className="text-sm text-brand-700 hover:underline">Ver todas</Link>
          </div>
          <TaskListTable tasks={pending.slice(0, 8)} empty="No tienes tareas abiertas. ¡Bien!" />
        </section>
        <section className="card min-w-0">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-semibold">Actividad reciente</h2>
          </div>
          <ActivityList items={activity} />
        </section>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tableros</h2>
        {user.role !== "GUEST" && <NewBoardButton variant="button" departments={await boardDepartmentChoices(user)} />}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((b) => {
          const done = b.tasks.filter((t) => t.status === "DONE").length;
          return (
            <Link key={b.id} href={`/boards/${b.id}`} className="card block p-4 transition hover:shadow-md">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded" style={{ background: b.color }} />
                <h3 className="truncate font-semibold">{b.name}</h3>
              </div>
              {b.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{b.description}</p>}
              <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-line">
                {STATUSES.map((s) => {
                  const n = b.tasks.filter((t) => t.status === s.value).length;
                  return n ? <div key={s.value} style={{ width: `${(n / b.tasks.length) * 100}%`, background: s.color }} /> : null;
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                {done}/{b.tasks.length} terminadas · {b._count.members} {b._count.members === 1 ? "miembro" : "miembros"}
              </p>
            </Link>
          );
        })}
        {boards.length === 0 && (
          <p className="text-sm text-muted">
            {user.role === "GUEST" ? "Todavía no te han agregado a ningún tablero." : "Crea tu primer tablero para empezar."}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "bad" ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}
