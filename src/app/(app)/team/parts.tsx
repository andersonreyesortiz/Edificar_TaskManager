"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import type { Role } from "@prisma/client";
import { ROLES } from "@/lib/constants";
import { inviteUser, revokeInvitation, setUserActive, setUserRole, updateProfileName } from "@/lib/actions";

export function InviteForm({ boards, defaultBoard, isAdmin }: { boards: { id: string; name: string }[]; defaultBoard?: string; isAdmin: boolean }) {
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
                ? `${email} ya tenía cuenta; lo agregamos al tablero y le avisamos.`
                : r?.emailed
                  ? `Listo. Le enviamos un correo de invitación a ${email}.`
                  : `Listo. ${email} ya puede entrar. Copia el enlace de abajo y envíaselo (el envío de correos aún no está activado).`,
            });
          } catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo invitar." });
          }
        })
      }
      className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_12rem_auto] sm:items-end"
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
      <div>
        <label className="label">Agregar al tablero</label>
        <select name="boardId" defaultValue={defaultBoard ?? ""} className="input">
          <option value="">Ninguno</option>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <button disabled={pending} className="btn-primary py-2">Invitar</button>
      <p className="text-xs text-muted sm:col-span-4">
        {ROLES.map((r) => `${r.label}: ${r.help.toLowerCase()}`).join(" · ")}
      </p>
      {msg && <p className={`text-sm sm:col-span-4 ${msg.ok ? "text-brand-700" : "text-red-600"}`}>{msg.text}</p>}
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
