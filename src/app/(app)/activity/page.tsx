import { addDays, format } from "date-fns";
import { Lock } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere, visiblePeopleWhere } from "@/lib/access";
import { parseFilters } from "@/lib/reports";
import { ActivityList } from "@/components/ActivityList";
import { ExportMenu } from "@/components/ExportMenu";

type SP = { range?: string; from?: string; to?: string; board?: string; user?: string };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const f = parseFilters({ range: "30", ...sp });
  const where: Prisma.ActivityWhereInput = {
    createdAt: { gte: f.from, lt: f.to },
    ...(f.boardId ? { boardId: f.boardId } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    // Los administradores ven todo el historial, también lo que no es de un tablero.
    ...(me.role === "ADMIN" ? {} : { board: visibleBoardsWhere(me) }),
  };
  const [boards, people, items, total] = await Promise.all([
    prisma.board.findMany({ where: visibleBoardsWhere(me), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: visiblePeopleWhere(me), select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: true, board: { select: { name: true, color: true } } },
    }),
    prisma.activity.count({ where }),
  ]);
  const fromStr = format(f.from, "yyyy-MM-dd");
  const toStr = format(addDays(f.to, -1), "yyyy-MM-dd");
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Registro de actividad</h1>
          <p className="mt-1 text-sm text-muted">Todo lo que pasa en tus tableros: cambios, asignaciones, tiempos y comentarios.</p>
        </div>
        <ExportMenu kind="actividad" query={{ from: fromStr, to: toStr, board: f.boardId, user: f.userId }} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Lock size={12} /> Este historial no se puede editar ni borrar. Se conserva aunque se borren tareas o tableros.
      </p>
      <form className="mt-5 flex flex-wrap items-center gap-2">
        <input type="date" name="from" defaultValue={fromStr} className="input w-auto" />
        <span className="text-sm text-muted">a</span>
        <input type="date" name="to" defaultValue={toStr} className="input w-auto" />
        <select name="board" defaultValue={f.boardId ?? ""} className="input w-auto">
          <option value="">Todos los tableros</option>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select name="user" defaultValue={f.userId ?? ""} className="input w-auto">
          <option value="">Todas las personas</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}
        </select>
        <button className="btn-outline">Filtrar</button>
      </form>
      <p className="mt-3 text-xs text-muted">
        {total} registro{total === 1 ? "" : "s"} del {format(f.from, "dd/MM/yyyy")} al {format(addDays(f.to, -1), "dd/MM/yyyy")}
        {total > items.length ? ` · se muestran los ${items.length} más recientes; exporta para ver todos` : ""}
      </p>
      <div className="card mt-2">
        <ActivityList items={items} />
      </div>
    </div>
  );
}
