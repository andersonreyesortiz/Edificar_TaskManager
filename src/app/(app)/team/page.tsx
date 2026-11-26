import { headers } from "next/headers";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";
import { companyDomains } from "@/lib/access-rules";
import { roleMeta } from "@/lib/constants";
import { Avatar } from "@/components/Avatar";
import { InviteForm, InviteLink, ProfileName, RevokeButton, RoleSelect, ActiveToggle } from "./parts";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const me = await requireUser();
  const { board } = await searchParams;
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const isAdmin = me.role === "ADMIN";

  const [users, invitations, boards] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { _count: { select: { assignments: true } } } }),
    prisma.invitation.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" }, include: { invitedBy: true, board: true } }),
    prisma.board.findMany({ where: visibleBoardsWhere(me), select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const domains = companyDomains();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">Equipo</h1>
      <p className="mt-1 text-sm text-muted">
        {domains.length > 0 ? (
          <>Cualquier persona con correo <b>@{domains.join(", @")}</b> puede entrar con Google. </>
        ) : null}
        {isAdmin ? "Para alguien de otra empresa, envíale una invitación." : "Solo los administradores pueden invitar personas o agregarlas a tableros."}
      </p>

      <section className="card mt-6 p-4">
        <h2 className="font-semibold">Tu perfil</h2>
        <ProfileName name={me.name ?? ""} email={me.email} />
      </section>

      {isAdmin && (
        <section className="card mt-6 p-4">
          <h2 className="font-semibold">Invitar a una persona</h2>
          <p className="mt-1 text-sm text-muted">Funciona con cualquier correo: Gmail, Outlook o el de otra empresa.</p>
          <InviteForm boards={boards} defaultBoard={board} isAdmin={isAdmin} />
        </section>
      )}

      {invitations.length > 0 && (
        <section className="card mt-6">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Invitaciones pendientes</h2>
          <ul className="divide-y divide-line">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.email}</p>
                  <p className="text-xs text-muted">
                    {roleMeta(i.role).label}
                    {i.board ? ` · tablero «${i.board.name}»` : ""} · invitado por {i.invitedBy.name ?? i.invitedBy.email}
                  </p>
                </div>
                <InviteLink url={`${origin}/login?email=${encodeURIComponent(i.email)}`} />
                {isAdmin && <RevokeButton id={i.id} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-6">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Personas <span className="font-normal text-muted">{users.length}</span></h2>
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${u.active ? "" : "opacity-50"}`}>
              <Avatar name={u.name} email={u.email} image={u.image} size={34} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{u.name ?? u.email} {u.id === me.id && <span className="text-xs text-muted">(tú)</span>}</p>
                <p className="text-xs text-muted">{u.email} · {u._count.assignments} tareas asignadas</p>
              </div>
              {isAdmin && u.id !== me.id ? (
                <>
                  <RoleSelect userId={u.id} role={u.role} />
                  <ActiveToggle userId={u.id} active={u.active} />
                </>
              ) : (
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs">{roleMeta(u.role).label}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
