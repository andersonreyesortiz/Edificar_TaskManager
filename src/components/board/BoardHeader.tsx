"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Archive, Columns3, Layers, Rows3, UserPlus, X } from "lucide-react";
import type { BoardRole } from "@prisma/client";
import clsx from "clsx";
import { BOARD_COLORS, formatMinutes } from "@/lib/constants";
import { addBoardMember, archiveBoard, removeBoardMember, setAutoGroupByStatus, setBoardMemberRole, updateBoard } from "@/lib/actions";
import { Popover } from "@/components/Popover";
import { ExportMenu } from "@/components/ExportMenu";
import { Avatar } from "@/components/Avatar";
import { AvatarStack } from "./cells";
import type { Person } from "./types";

export function BoardHeader({
  board,
  members,
  memberRoles,
  isAdmin,
  allUsers,
  canManage,
  view,
  stats,
}: {
  board: { id: string; name: string; description: string | null; color: string; ownerId: string; autoGroupByStatus: boolean };
  members: Person[];
  memberRoles: Record<string, BoardRole>;
  /** Solo los administradores agregan, quitan o cambian permisos de miembros */
  isAdmin: boolean;
  allUsers: Person[];
  canManage: boolean;
  view: "table" | "kanban";
  stats: { total: number; done: number; minutes: number };
}) {
  const [, start] = useTransition();
  const [search, setSearch] = useState("");
  const [newRole, setNewRole] = useState<BoardRole>("COLLABORATOR");
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = allUsers.filter(
    (u) => !memberIds.has(u.id) && (u.name ?? u.email).toLowerCase().includes(search.toLowerCase()),
  );
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {canManage ? (
              <Popover
                width={176}
                trigger={() => <button className="h-5 w-5 rounded-md" style={{ background: board.color }} title="Color del tablero" />}
              >
                {(close) => (
                  <div className="grid grid-cols-4 gap-2 p-2">
                    {BOARD_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          close();
                          start(() => updateBoard(board.id, { color: c }));
                        }}
                        className="h-7 w-7 rounded-md"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                )}
              </Popover>
            ) : (
              <span className="h-5 w-5 rounded-md" style={{ background: board.color }} />
            )}
            <input
              defaultValue={board.name}
              readOnly={!canManage}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== board.name) start(() => updateBoard(board.id, { name: v }));
              }}
              className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-2xl font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-line"
            />
          </div>
          <input
            defaultValue={board.description ?? ""}
            readOnly={!canManage}
            placeholder={canManage ? "Agrega una descripción" : ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (board.description ?? "")) start(() => updateBoard(board.id, { description: v || null }));
            }}
            className="mt-1 w-full rounded-md bg-transparent px-1 text-sm text-muted outline-none focus:bg-white focus:ring-1 focus:ring-line"
          />
        </div>

        <div className="flex items-center gap-2">
          <ExportMenu kind="tareas" query={{ board: board.id }} />
          <Popover
            align="right"
            width={280}
            trigger={() => (
              <button className="btn-outline">
                <AvatarStack people={members} max={4} size={22} />
                <span>{members.length} {members.length === 1 ? "miembro" : "miembros"}</span>
              </button>
            )}
          >
            {() => (
              <div className="p-1">
                <p className="px-2 py-1 text-xs font-medium text-muted">Miembros del tablero</p>
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                    <Avatar name={m.name} email={m.email} image={m.image} size={22} />
                    <span className="min-w-0 flex-1 truncate">{m.name ?? m.email}</span>
                    {m.id === board.ownerId ? (
                      <span className="text-[11px] text-muted">Dueño</span>
                    ) : isAdmin ? (
                      <>
                        <select
                          value={memberRoles[m.id] ?? "COLLABORATOR"}
                          onChange={(e) => start(() => setBoardMemberRole(board.id, m.id, e.target.value as BoardRole))}
                          className="rounded border border-line bg-white px-1 py-0.5 text-[11px]"
                          title="Permiso en este tablero"
                        >
                          <option value="EDITOR">Editor</option>
                          <option value="COLLABORATOR">Colaborador</option>
                        </select>
                        <button onClick={() => start(() => removeBoardMember(board.id, m.id))} className="rounded p-0.5 text-muted hover:bg-red-50 hover:text-red-600" title="Quitar">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted">{memberRoles[m.id] === "EDITOR" ? "Editor" : "Colaborador"}</span>
                    )}
                  </div>
                ))}
                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-line" />
                    <p className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted"><UserPlus size={12} /> Agregar persona</p>
                    <div className="mb-1 flex gap-1 px-1">
                      {(["COLLABORATOR", "EDITOR"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setNewRole(r)}
                          className={`flex-1 rounded-md border px-2 py-1 text-left text-[11px] leading-tight ${newRole === r ? "border-brand-500 bg-brand-50" : "border-line"}`}
                        >
                          <span className="block font-medium">{r === "EDITOR" ? "Editor" : "Colaborador"}</span>
                          <span className="text-muted">{r === "EDITOR" ? "Crea y edita todo" : "Solo avanza sus tareas"}</span>
                        </button>
                      ))}
                    </div>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" className="input mb-1" />
                    <div className="max-h-40 overflow-y-auto">
                      {candidates.map((u) => (
                        <button key={u.id} onClick={() => start(() => addBoardMember(board.id, u.id, newRole))} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas">
                          <Avatar name={u.name} email={u.email} image={u.image} size={22} />
                          <span className="truncate">{u.name ?? u.email}</span>
                        </button>
                      ))}
                      {candidates.length === 0 && <p className="px-2 py-1 text-xs text-muted">No hay más personas. Invita a alguien desde Equipo.</p>}
                    </div>
                    <Link href={`/team?board=${board.id}`} className="mt-1 block rounded-md px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50">
                      Invitar por correo a alguien externo
                    </Link>
                  </>
                )}
              </div>
            )}
          </Popover>
          {canManage && (
            <button
              onClick={() => {
                const on = !board.autoGroupByStatus;
                if (on && !confirm("Las tareas se moverán al grupo de su estado (Por hacer, En curso, Terminada…). Los grupos que falten se crearán. ¿Continuar?")) return;
                start(() => setAutoGroupByStatus(board.id, on));
              }}
              className={clsx("btn-outline", board.autoGroupByStatus && "border-brand-500 bg-brand-50 text-brand-900")}
              title="Cuando una tarea cambia de estado, se mueve sola al grupo con el nombre de ese estado (por ejemplo «Terminada»). Si el grupo no existe, se crea."
            >
              <Layers size={15} /> <span className="hidden sm:inline">Agrupar por estado</span>{board.autoGroupByStatus ? " ✓" : ""}
            </button>
          )}
          {canManage && (
            <button
              onClick={() => confirm("¿Archivar este tablero? Dejará de aparecer para todos.") && start(() => archiveBoard(board.id))}
              className="btn-ghost text-muted"
              title="Archivar tablero"
            >
              <Archive size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-line">
        <div className="flex gap-1">
          <ViewTab href={`/boards/${board.id}`} active={view === "table"} icon={<Rows3 size={15} />}>Tabla</ViewTab>
          <ViewTab href={`/boards/${board.id}?view=kanban`} active={view === "kanban"} icon={<Columns3 size={15} />}>Kanban</ViewTab>
        </div>
        <div className="ml-auto flex items-center gap-4 pb-2 text-xs text-muted">
          <span>{stats.total} tareas</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
              <span className="block h-full bg-brand-500" style={{ width: `${pct}%` }} />
            </span>
            {pct}% terminado
          </span>
          <span>{formatMinutes(stats.minutes)} registradas</span>
        </div>
      </div>
    </div>
  );
}

function ViewTab({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx(
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
        active ? "border-brand-700 font-medium text-brand-900" : "border-transparent text-muted hover:text-ink",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
