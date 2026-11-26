import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";
import { ActivityList } from "@/components/ActivityList";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ board?: string; user?: string }> }) {
  const me = await requireUser();
  const { board, user } = await searchParams;
  const [boards, people, items] = await Promise.all([
    prisma.board.findMany({ where: visibleBoardsWhere(me), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.activity.findMany({
      where: { board: visibleBoardsWhere(me), ...(board ? { boardId: board } : {}), ...(user ? { userId: user } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: true, board: { select: { name: true, color: true } } },
    }),
  ]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">Registro de actividad</h1>
      <p className="mt-1 text-sm text-muted">Todo lo que pasa en tus tableros: cambios, asignaciones, tiempos y comentarios.</p>
      <form className="mt-6 flex flex-wrap gap-2">
        <select name="board" defaultValue={board ?? ""} className="input w-auto">
          <option value="">Todos los tableros</option>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select name="user" defaultValue={user ?? ""} className="input w-auto">
          <option value="">Todas las personas</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}
        </select>
        <button className="btn-outline">Filtrar</button>
      </form>
      <div className="card mt-4">
        <ActivityList items={items} />
      </div>
    </div>
  );
}
