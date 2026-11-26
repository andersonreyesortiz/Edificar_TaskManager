"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, ListTree, Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { STATUSES, formatMinutes } from "@/lib/constants";
import { createGroup, createTask, deleteGroup, renameGroup, startTimer, stopTimer, updateTaskStatus } from "@/lib/actions";
import { AssigneePicker, AvatarStack, DateCell, PriorityFlag, PrioritySelect, StatusSelect } from "./cells";
import type { BoardGroup, BoardTask, Person } from "./types";

type Props = {
  boardId: string;
  groups: BoardGroup[];
  tasks: BoardTask[];
  people: Person[];
  meId: string;
  canManage: boolean;
  view: "table" | "kanban";
};

export function BoardView(props: Props) {
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [status, setStatus] = useState<TaskStatus | "">("");

  const tasks = useMemo(
    () =>
      props.tasks.filter(
        (t) =>
          (!query || t.title.toLowerCase().includes(query.toLowerCase())) &&
          (!onlyMine || t.assignees.some((a) => a.id === props.meId)) &&
          (!status || t.status === status),
      ),
    [props.tasks, query, onlyMine, status, props.meId],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tareas" className="input w-56 pl-8" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} className="input w-auto">
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="accent-brand-700" />
          Solo mis tareas
        </label>
      </div>
      {props.view === "table" ? <TableView {...props} tasks={tasks} /> : <KanbanView {...props} tasks={tasks} />}
    </div>
  );
}

function useOpenTask() {
  const params = useSearchParams();
  const path = usePathname();
  return (id: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("task", id);
    return `${path}?${p.toString()}`;
  };
}

function TimerButton({ task }: { task: BoardTask }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => (task.running ? stopTimer() : startTimer(task.id)))}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
        task.running ? "bg-brand-700 text-white" : "text-muted hover:bg-brand-50 hover:text-brand-700"
      }`}
      title={task.running ? "Detener cronómetro" : "Iniciar cronómetro"}
    >
      {task.running ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
    </button>
  );
}

function TimeCell({ task }: { task: BoardTask }) {
  const pct = task.estimateMinutes ? Math.min(100, (task.minutes / task.estimateMinutes) * 100) : 0;
  const over = task.estimateMinutes ? task.minutes > task.estimateMinutes : false;
  return (
    <div className="flex items-center gap-2">
      <TimerButton task={task} />
      <div className="min-w-0">
        <p className="text-xs tabular-nums">{task.minutes ? formatMinutes(task.minutes) : <span className="text-muted">—</span>}</p>
        {task.estimateMinutes ? (
          <div className="mt-0.5 h-1 w-16 rounded-full bg-line" title={`Estimado: ${formatMinutes(task.estimateMinutes)}`}>
            <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: over ? "#dc2626" : "#14a38b" }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AddTaskRow({ boardId, groupId }: { boardId: string; groupId: string }) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const t = title;
        setTitle("");
        start(async () => {
          await createTask({ boardId, groupId, title: t });
        });
      }}
      className="flex items-center gap-2 px-3 py-1.5"
    >
      <Plus size={14} className="text-muted" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={pending}
        placeholder="Agregar tarea"
        className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted"
      />
    </form>
  );
}

function GroupHeader({ group, count, minutes, collapsed, onToggle, canManage }: {
  group: BoardGroup;
  count: number;
  minutes: number;
  collapsed: boolean;
  onToggle: () => void;
  canManage: boolean;
}) {
  const [, start] = useTransition();
  return (
    <div className="group/g flex items-center gap-2 px-1 py-2">
      <button onClick={onToggle} className="rounded p-0.5 hover:bg-black/5" style={{ color: group.color }}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
      </button>
      <input
        defaultValue={group.name}
        onBlur={(e) => e.target.value.trim() && e.target.value !== group.name && start(() => renameGroup(group.id, e.target.value.trim()))}
        className="min-w-0 rounded bg-transparent px-1 text-[15px] font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-line"
        style={{ color: group.color }}
      />
      <span className="text-xs text-muted">
        {count} {count === 1 ? "tarea" : "tareas"}
        {minutes ? ` · ${formatMinutes(minutes)}` : ""}
      </span>
      {canManage && (
        <button
          onClick={() => confirm(`¿Borrar el grupo «${group.name}» y todas sus tareas?`) && start(() => deleteGroup(group.id))}
          className="ml-auto rounded p-1 text-muted opacity-0 hover:bg-red-50 hover:text-red-600 group-hover/g:opacity-100"
          title="Borrar grupo"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function TableView({ boardId, groups, tasks, people, canManage }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const href = useOpenTask();
  const [newGroup, setNewGroup] = useState("");
  const [, start] = useTransition();

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const rows = tasks.filter((t) => t.groupId === g.id);
        const minutes = rows.reduce((a, t) => a + t.minutes, 0);
        const done = rows.filter((t) => t.status === "DONE").length;
        return (
          <section key={g.id}>
            <GroupHeader
              group={g}
              count={rows.length}
              minutes={minutes}
              collapsed={!!collapsed[g.id]}
              onToggle={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
              canManage={canManage}
            />
            {!collapsed[g.id] && (
              <div className="card overflow-x-auto" style={{ borderLeft: `4px solid ${g.color}` }}>
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-3 py-2 font-medium">Tarea</th>
                      <th className="w-32 px-2 py-2 font-medium">Responsables</th>
                      <th className="w-36 px-2 py-2 font-medium">Estado</th>
                      <th className="w-32 px-2 py-2 font-medium">Prioridad</th>
                      <th className="w-36 px-2 py-2 font-medium">Fecha límite</th>
                      <th className="w-32 px-2 py-2 font-medium">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.id} className="border-b border-line/70 hover:bg-canvas/60">
                        <td className="px-3 py-1.5">
                          <Link href={href(t.id)} scroll={false} className="flex items-center gap-2 hover:text-brand-700">
                            <span className={t.status === "DONE" ? "text-muted line-through" : "font-medium"}>{t.title}</span>
                            {t.subtaskCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-1.5 py-0.5 text-[11px] text-muted">
                                <ListTree size={11} /> {t.subtaskDone}/{t.subtaskCount}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5">
                          <AssigneePicker taskId={t.id} assignees={t.assignees} people={people} />
                        </td>
                        <td className="px-2 py-1.5"><StatusSelect taskId={t.id} status={t.status} /></td>
                        <td className="px-2 py-1.5"><PrioritySelect taskId={t.id} priority={t.priority} /></td>
                        <td className="px-2 py-1.5"><DateCell taskId={t.id} value={t.dueDate} done={t.status === "DONE"} /></td>
                        <td className="px-2 py-1.5"><TimeCell task={t} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <AddTaskRow boardId={boardId} groupId={g.id} />
                {rows.length > 0 && <StatusBar tasks={rows} label={`${done} de ${rows.length} terminadas`} />}
              </div>
            )}
          </section>
        );
      })}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newGroup.trim()) return;
          const n = newGroup;
          setNewGroup("");
          start(() => createGroup(boardId, n.trim()));
        }}
        className="flex items-center gap-2"
      >
        <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Nombre del nuevo grupo" className="input w-64" />
        <button className="btn-outline"><Plus size={14} /> Agregar grupo</button>
      </form>
    </div>
  );
}

function StatusBar({ tasks, label }: { tasks: BoardTask[]; label: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-line px-3 py-2">
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-line">
        {STATUSES.map((s) => {
          const n = tasks.filter((t) => t.status === s.value).length;
          return n ? <div key={s.value} title={`${s.label}: ${n}`} style={{ width: `${(n / tasks.length) * 100}%`, background: s.color }} /> : null;
        })}
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function KanbanView({ tasks, groups }: Props) {
  const href = useOpenTask();
  const router = useRouter();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [local, setLocal] = useState<Record<string, TaskStatus>>({});
  const [, start] = useTransition();
  const statusOf = (t: BoardTask) => local[t.id] ?? t.status;
  const groupName = (id: string | null) => groups.find((g) => g.id === id);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUSES.map((s) => {
        const col = tasks.filter((t) => statusOf(t) === s.value);
        return (
          <div
            key={s.value}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(s.value);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={() => {
              setOver(null);
              if (!dragging) return;
              const id = dragging;
              setDragging(null);
              setLocal((l) => ({ ...l, [id]: s.value }));
              start(async () => {
                await updateTaskStatus(id, s.value);
                router.refresh();
              });
            }}
            className={`flex w-72 shrink-0 flex-col rounded-xl p-2 transition ${over === s.value ? "ring-2 ring-brand-200" : ""}`}
            style={{ background: s.soft }}
          >
            <div className="mb-2 flex items-center gap-2 px-1 py-1">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="text-sm font-semibold" style={{ color: s.color }}>{s.label}</span>
              <span className="text-xs text-muted">{col.length}</span>
            </div>
            <div className="flex min-h-24 flex-col gap-2">
              {col.map((t) => {
                const g = groupName(t.groupId);
                return (
                  <Link
                    key={t.id}
                    href={href(t.id)}
                    scroll={false}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    className="card block cursor-grab p-3 shadow-sm hover:shadow active:cursor-grabbing"
                  >
                    {g && (
                      <span className="mb-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ background: g.color }}>
                        {g.name}
                      </span>
                    )}
                    <p className="text-sm font-medium leading-snug">{t.title}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <PriorityFlag priority={t.priority} />
                      <AvatarStack people={t.assignees} size={22} />
                    </div>
                    {(t.dueDate || t.subtaskCount > 0 || t.minutes > 0) && (
                      <div className="mt-2 flex items-center gap-3 border-t border-line pt-2 text-[11px] text-muted">
                        {t.dueDate && <span>Vence {new Date(t.dueDate).toLocaleDateString("es", { day: "numeric", month: "short" })}</span>}
                        {t.subtaskCount > 0 && <span>{t.subtaskDone}/{t.subtaskCount} subtareas</span>}
                        {t.minutes > 0 && <span>{formatMinutes(t.minutes)}</span>}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
