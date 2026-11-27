"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { ROLES } from "@/lib/constants";
import { createDepartment, deleteDepartment, inviteUser, renameDepartment, revokeInvitation, setDepartmentMember, setUserActive, setUserRole, updateProfileName } from "@/lib/actions";

type Opt = { id: string; name: string };

export function InviteForm({ boards, departments, defaultBoard, isAdmin }: { boards: Opt[]; departments: Opt[]; defaultBoard?: string; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      action={(fd) =>
        start(async () => {
          setMsg(null);
          try {
            const r = await inviteUser(fd);
            const email = fd.get("email");
            setMsg({
              ok: true,
              text: r?.existing
                ? `${email} ya tenía cuenta; lo agregamos al departamento o tablero elegido.`
                : r?.emailed
                  ? `Listo. Le enviamos un correo de invitación a ${email}.`
                  : `Listo. ${email} ya puede entrar. Copia el enlace de abajo y envíaselo (el envío de correos aún no está activado).`,
            });
          } catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo invitar." });
          }
        })
      }
      className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_9rem_11rem_11rem_auto] lg:items-end"
    >
      <div>
        <label className="label">Correo</label>
        <input name="email" type="email" required placeholder="persona@otraempresa.com" className="input" />
      </div>
      <div>
        <label className="label">Rol</label>
        <select name="role" defaultValue="GUEST" className="input">
          {ROLES.filter((r) => isAdmin || r.value !== "ADMIN").map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      {(isAdmin || departments.length > 0) && (
        <div>
          <label className="label">Departamento</label>
          <select name="departmentId" defaultValue={departments.length === 1 && !isAdmin ? departments[0].id : ""} className="input">
            {(isAdmin || departments.length !== 1) && <option value="">{isAdmin ? "Ninguno" : "Elige…"}</option>}
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label">Agregar al tablero</label>
        <select name="boardId" defaultValue={defaultBoard ?? (!isAdmin && departments.length === 0 && boards.length === 1 ? boards[0].id : "")} className="input">
          {(isAdmin || departments.length > 0) ? <option value="">Ninguno</option> : <option value="" disabled>Elige un tablero…</option>}
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <button disabled={pending} className="btn-primary py-2">Invitar</button>
      <p className="text-xs text-muted sm:col-span-2 lg:col-span-5">
        {ROLES.map((r) => `${r.label}: ${r.help.toLowerCase()}`).join(" · ")}
      </p>
      {msg && <p className={`text-sm sm:col-span-2 lg:col-span-5 ${msg.ok ? "text-brand-700" : "text-red-600"}`}>{msg.text}</p>}
    </form>
  );
}

export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="btn-outline text-xs"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar enlace"}
    </button>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => revokeInvitation(id))} className="btn-ghost text-xs text-red-600">
      Revocar
    </button>
  );
}

export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const [, start] = useTransition();
  return (
    <select defaultValue={role} onChange={(e) => start(() => setUserRole(userId, e.target.value as Role))} className="rounded-md border border-line bg-white px-2 py-1 text-xs">
      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
    </select>
  );
}

export function ActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => setUserActive(userId, !active))} className="btn-ghost text-xs text-muted">
      {active ? "Desactivar" : "Reactivar"}
    </button>
  );
}

export function ProfileName({ name, email }: { name: string; email: string }) {
  const [pending, start] = useTransition();
  return (
    <form action={(fd) => start(() => updateProfileName(fd))} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="w-64">
        <label className="label">Nombre visible</label>
        <input name="name" defaultValue={name} className="input" />
      </div>
      <p className="pb-2 text-sm text-muted">{email}</p>
      <button disabled={pending} className="btn-outline">Guardar</button>
    </form>
  );
}

type DeptMember = { userId: string; name: string; email: string; isAdmin: boolean };
type Dept = { id: string; name: string; boards: number; members: DeptMember[] };

/** Departamentos: el superadministrador los crea y nombra administradores; cada administrador maneja la gente de los suyos. */
export function DepartmentsPanel({ departments, people, isSuper }: { departments: Dept[]; people: { id: string; name: string; email: string }[]; isSuper: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  return (
    <div className="space-y-4 p-4">
      {isSuper && (
        <form
          action={(fd) => run(() => createDepartment(fd))}
          className="flex flex-wrap items-center gap-2"
        >
          <input name="name" required placeholder="Nombre del nuevo departamento (ej. Diseño, Obra, Administración)" className="input max-w-md flex-1" />
          <button disabled={pending} className="btn-outline"><Plus size={14} /> Crear departamento</button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {departments.length === 0 && <p className="text-sm text-muted">Todavía no hay departamentos.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {departments.map((d) => {
          const memberIds = new Set(d.members.map((m) => m.userId));
          const candidates = people.filter((p) => !memberIds.has(p.id));
          return (
            <div key={d.id} className="rounded-xl border border-line">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <input
                  defaultValue={d.name}
                  readOnly={!isSuper}
                  onBlur={(e) => isSuper && e.target.value.trim() && e.target.value !== d.name && run(() => renameDepartment(d.id, e.target.value))}
                  className="min-w-0 flex-1 rounded bg-transparent px-1 font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-line"
                />
                <span className="text-xs text-muted">{d.boards} {d.boards === 1 ? "tablero" : "tableros"}</span>
                {isSuper && (
                  <button
                    onClick={() => confirm(`¿Eliminar el departamento «${d.name}»?`) && run(() => deleteDepartment(d.id))}
                    className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"
                    title="Eliminar departamento"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <ul className="divide-y divide-line">
                {d.members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{m.name}</p>
                      <p className="truncate text-xs text-muted">{m.email}</p>
                    </div>
                    {isSuper || !m.isAdmin ? (
                      <select
                        value={m.isAdmin ? "admin" : "member"}
                        disabled={pending}
                        onChange={(e) => run(() => setDepartmentMember(d.id, m.userId, e.target.value as "none" | "member" | "admin"))}
                        className="rounded-md border border-line bg-white px-2 py-1 text-xs"
                      >
                        <option value="member">Miembro</option>
                        {isSuper && <option value="admin">Administrador del departamento</option>}
                        <option value="none">Quitar del departamento</option>
                      </select>
                    ) : (
                      <span className="rounded-full bg-[#00A0E3]/10 px-2 py-0.5 text-xs text-[#006a97]">Administrador</span>
                    )}
                  </li>
                ))}
                {d.members.length === 0 && <li className="px-3 py-2 text-xs text-muted">Sin personas todavía.</li>}
              </ul>
              {candidates.length > 0 && (
                <form
                  action={(fd) => {
                    const uid = String(fd.get("userId") ?? "");
                    if (uid) run(() => setDepartmentMember(d.id, uid, "member"));
                  }}
                  className="flex items-center gap-2 border-t border-line px-3 py-2"
                >
                  <select name="userId" defaultValue="" className="input flex-1 py-1 text-sm">
                    <option value="">Agregar persona…</option>
                    {candidates.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}
                  </select>
                  <button disabled={pending} className="btn-outline py-1 text-sm">Agregar</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
