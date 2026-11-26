import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { RunningTimer } from "@/components/RunningTimer";
import { NotificationBell } from "@/components/NotificationBell";
import { NewBoardButton } from "@/components/NewBoardButton";
import { NavLink } from "@/components/NavLink";
import { UserMenu } from "@/components/UserMenu";
import { doSignOut } from "@/lib/actions";
import { fmtDateTime, roleMeta } from "@/lib/constants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [boards, running, notifications, unread] = await Promise.all([
    prisma.board.findMany({ where: visibleBoardsWhere(user), orderBy: { createdAt: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.timeEntry.findFirst({ where: { userId: user.id, endedAt: null }, include: { task: { select: { id: true, title: true, boardId: true } } } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true, email: true, image: true } } },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white md:flex print:hidden">
        <div className="px-5 py-4">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <nav className="space-y-0.5 px-3 text-sm">
          <NavLink href="/" icon="home">Inicio</NavLink>
          <NavLink href="/dashboard" icon="dashboard">Resumen ejecutivo</NavLink>
          <NavLink href="/my-tasks" icon="check">Mis tareas</NavLink>
          <NavLink href="/reports" icon="chart">Reportes</NavLink>
          <NavLink href="/activity" icon="clock">Actividad</NavLink>
          <NavLink href="/team" icon="users">Equipo</NavLink>
        </nav>
        <div className="mt-6 flex items-center justify-between px-5 text-xs font-semibold uppercase tracking-wide text-muted">
          Tableros
          {user.role !== "GUEST" && <NewBoardButton />}
        </div>
        <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 text-sm">
          {boards.map((b) => (
            <NavLink key={b.id} href={`/boards/${b.id}`} color={b.color}>
              {b.name}
            </NavLink>
          ))}
          {boards.length === 0 && <p className="px-2 py-1 text-xs text-muted">Aún no tienes tableros.</p>}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Avatar name={user.name} email={user.email} image={user.image} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-muted" title={user.email}>{user.email}</p>
          </div>
          <form action={doSignOut}>
            <button className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-red-50 hover:text-red-600" title="Cerrar sesión">Cerrar sesión</button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur md:px-8 print:hidden">
          <div className="md:hidden">
            <Link href="/"><Logo size={24} /></Link>
          </div>
          <nav className="flex min-w-0 gap-1 overflow-x-auto text-sm md:hidden">
            <Link className="btn-ghost shrink-0" href="/dashboard">Resumen</Link>
            <Link className="btn-ghost shrink-0" href="/my-tasks">Mis tareas</Link>
            <Link className="btn-ghost shrink-0" href="/reports">Reportes</Link>
            <Link className="btn-ghost shrink-0" href="/activity">Actividad</Link>
            <Link className="btn-ghost shrink-0" href="/team">Equipo</Link>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {running && (
              <RunningTimer
                startedAt={running.startedAt.toISOString()}
                taskTitle={running.task.title}
                href={`/boards/${running.task.boardId}?task=${running.task.id}`}
              />
            )}
            <NotificationBell
              unread={unread}
              items={notifications.map((n) => ({
                id: n.id,
                text: n.text,
                link: n.link,
                read: Boolean(n.readAt),
                when: fmtDateTime(n.createdAt),
                actor: n.actor,
              }))}
            />
            <UserMenu name={user.name} email={user.email} image={user.image} role={roleMeta(user.role).label} />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
