import { headers } from "next/headers";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adminDepartmentIds, isSuperAdmin, membersManageableWhere, visiblePeopleWhere } from "@/lib/access";
import { DatabaseBackup, Download } from "lucide-react";
import { fmtDateTime, roleMeta } from "@/lib/constants";
import { Avatar } from "@/components/Avatar";
import { DepartmentsPanel, InviteForm, InviteLink, ProfileName, RevokeButton, RoleSelect, ActiveToggle } from "./parts";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const me = await requireUser();
  const { board } = await searchParams;
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const isAdmin = isSuperAdmin(me);
  const myAdminDepts = await adminDepartmentIds(me);
  const isAnyAdmin = isAdmin || myAdminDepts.length > 0;
  // Los dueños de tableros también pueden invitar gente a sus propios tableros.
  const ownsBoards = !isAnyAdmin && (await prisma.board.count({ where: { ownerId: me.id, archived: false } })) > 0;
  const canInvite = isAnyAdmin || ownsBoards;

  const [users, invitations, manageableBoards, backups, departments, myDepts] = await Promise.all([
    prisma.user.findMany({
      where: visiblePeopleWhere(me),
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { assignments: true } }, departments: { include: { department: { select: { name: true } } } } },
    }),
    canInvite
      ? prisma.invitation.findMany({
          where: {
            acceptedAt: null,
            ...(isAdmin ? {} : { OR: [{ invitedById: me.id }, { departmentId: { in: myAdminDepts } }] }),
          },
          orderBy: { createdAt: "desc" },
          include: { invitedBy: true, board: true, department: true },
        })
      : Promise.resolve([]),
    // Tableros a los que puede invitar gente: todos (superadmin), los de sus departamentos y los suyos.
    prisma.board.findMany({
      where: membersManageableWhere(me),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    isAdmin
      ? prisma.activity.findMany({ where: { action: "backup.downloaded" }, orderBy: { createdAt: "desc" }, take: 5, include: { user: true } })
      : Promise.resolve([]),
    prisma.department.findMany({
      where: isAdmin ? {} : { id: { in: myAdminDepts } },
      orderBy: { name: "asc" },
      include: { _count: { select: { boards: true } }, members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    }),
    prisma.departmentMember.findMany({ where: { userId: me.id }, include: { department: { select: { name: true } } } }),
  ]);
  // Para agregar a un departamento: el superadmin elige entre todos; un admin de departamento, entre quienes ve.
  const peopleForDepts = (isAdmin ? await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : users.filter((u) => u.active)).map(
    (u) => ({ id: u.id, name: u.name ?? u.email, email: u.email }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">Equipo</h1>
      <p className="mt-1 text-sm text-muted">
        Para entrar a la app, toda persona necesita una invitación de un administrador (también las de la empresa).{" "}
        {isAnyAdmin
          ? "Elige «Miembro» para la gente de la empresa e «Invitado» para externos."
          : ownsBoards
            ? "Puedes invitar personas a los tableros que creaste. Elige «Miembro» para la gente de la empresa e «Invitado» para externos."
          : "Solo los administradores pueden invitar personas o agregarlas a tableros. Aquí ves a las personas con las que compartes tableros."}
      </p>

      <section className="card mt-6 p-4">
        <h2 className="font-semibold">Tu perfil</h2>
        <ProfileName name={me.name ?? ""} email={me.email} />
        <p className="mt-2 text-xs text-muted">
          {myDepts.length
            ? `Departamentos: ${myDepts.map((d) => `${d.department.name}${d.isAdmin ? " (administrador)" : ""}`).join(", ")}`
            : "No perteneces a ningún departamento."}
        </p>
      </section>

      {canInvite && (
        <section className="card mt-6 p-4">
          <h2 className="font-semibold">Invitar a una persona</h2>
          <p className="mt-1 text-sm text-muted">Funciona con cualquier correo: Gmail, Outlook o el de otra empresa.</p>
          <InviteForm boards={manageableBoards} departments={departments.map((d) => ({ id: d.id, name: d.name }))} defaultBoard={board} isAdmin={isAdmin} />
        </section>
      )}

      {isAnyAdmin && (
        <section className="card mt-6">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-semibold">Departamentos</h2>
            <p className="mt-0.5 text-xs text-muted">
              Los tableros de un departamento solo los ven las personas invitadas a cada tablero y los administradores del departamento.
              {isAdmin ? " Tú, como superadministrador, ves todos." : ""}
            </p>
          </div>
          <DepartmentsPanel
            isSuper={isAdmin}
            people={peopleForDepts}
            departments={departments.map((d) => ({
              id: d.id,
              name: d.name,
              boards: d._count.boards,
              members: d.members
                .map((m) => ({ userId: m.userId, name: m.user.name ?? m.user.email, email: m.user.email, isAdmin: m.isAdmin }))
                .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name)),
            }))}
          />
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
                    {i.department ? ` · ${i.department.name}` : ""}
                    {i.board ? ` · tablero «${i.board.name}»` : ""} · invitado por {i.invitedBy.name ?? i.invitedBy.email}
                  </p>
                </div>
                <InviteLink url={`${origin}/login?email=${encodeURIComponent(i.email)}`} />
                <RevokeButton id={i.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && (
        <section className="card mt-6 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="flex items-center gap-2 font-semibold"><DatabaseBackup size={16} className="text-[#00A0E3]" /> Respaldo de datos</h2>
              <p className="mt-1 text-sm text-muted">
                Descarga una copia completa de tableros, tareas, tiempos, comentarios e historial. Guárdala en el Drive de la empresa
                al menos una vez por semana. Cada descarga queda registrada en el historial.
              </p>
            </div>
            <a href="/api/backup" className="btn-primary inline-flex items-center gap-2"><Download size={14} /> Descargar respaldo</a>
          </div>
          <p className="mt-3 text-xs text-muted">
            {backups.length
              ? <>Últimos respaldos: {backups.map((b) => `${fmtDateTime(b.createdAt)} (${b.user.name ?? b.user.email})`).join(" · ")}</>
              : "Todavía no se ha descargado ningún respaldo."}
          </p>
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
                <p className="text-xs text-muted">
                  {u.email} · {u._count.assignments} tareas asignadas
                  {u.departments.length ? ` · ${u.departments.map((d) => d.department.name + (d.isAdmin ? " (admin)" : "")).join(", ")}` : ""}
                </p>
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
