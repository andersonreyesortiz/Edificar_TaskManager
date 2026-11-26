"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, ListTree, Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { STATUSES, formatMinutes } from "@/lib/constants";
import { createGroup, createTask, setColumnLayout, deleteGroup, renameGroup, startTimer, stopTimer, updateTaskStatus } from "@/lib/actions";
import { AssigneePicker, AvatarStack, DateCell, PriorityFlag, PrioritySelect, StatusSelect } from "./cells";
import type { BoardGroup, BoardTask, Person } from "./types";
import { ReadOnly } from "@/components/ReadOnly";
import { BUILTIN_COLUMNS, type BoardColumnDef, type BuiltinKey } from "@/lib/columns";
import { FilterButton, matchesFilters, searchableText, type Filters } from "./filters";
import { AddColumnButton, BuiltinHeader, ColumnCell, ColumnHeader, ColumnSummary } from "./columns";

type Props = {
  boardId: string;
  groups: BoardGroup[];
  tasks: BoardTask[];
  people: Person[];
  meId: string;
  canManage: boolean;
  /** Editor o dueño; los colaboradores solo avanzan sus propias tareas */
  canEdit: boolean;
  view: "table" | "kanban";
  columns: BoardColumnDef[];
  hidden: BuiltinKey[];
  columnOrder: string[];
  columnWidths: Record<string, number>;
};

export function BoardView(props: Props) {
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [filters, setFilters] = useState<Filters>({});
  // Vista personal: agrupar por los grupos del tablero o por estado (no mueve las tareas).
  const [groupBy, setGroupBy] = useState<"groups" | "status">("groups");
  const storeKey = `ritmo:groupBy:${props.boardId}`;
  useEffect(() => {
    try {
      if (localStorage.getItem(storeKey) === "status") setGroupBy("status");
    } catch {}
  }, [storeKey]);
  const changeGroupBy = (v: "groups" | "status") => {
    setGroupBy(v);
    try {
      localStorage.setItem(storeKey, v);
    } catch {}
  };

  const tasks = useMemo(
    () =>
      props.tasks.filter(
        (t) =>
          (!query || searchableText(t, props.columns).includes(query.toLowerCase())) &&
          (!onlyMine || t.assignees.some((a) => a.id === props.meId)) &&
          (!status || t.status === status) &&
          matchesFilters(t, filters, props.columns),
      ),
    [props.tasks, query, onlyMine, status, props.meId, filters, props.columns],
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
        <FilterButton columns={props.columns} people={props.people} filters={filters} onChange={setFilters} />
        {props.view === "table" && (
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-line bg-white p-0.5 text-sm" title="Cambia solo tu vista; no mueve las tareas">
            <span className="px-2 text-xs text-muted">Agrupar por</span>
            {(["groups", "status"] as const).map((v) => (
              <button
                key={v}
                onClick={() => changeGroupBy(v)}
                className={`rounded-md px-2.5 py-1 ${groupBy === v ? "bg-brand-700 text-white" : "text-ink hover:bg-canvas"}`}
              >
                {v === "groups" ? "Grupos" : "Estado"}
              </button>
            ))}
          </div>
        )}
      </div>
      {props.view === "table" ? <TableView {...props} tasks={tasks} groupBy={groupBy} /> : <KanbanView {...props} tasks={tasks} />}
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

function GroupHeader({ group, count, minutes, collapsed, onToggle, canManage, canEdit }: {
  group: BoardGroup;
  count: number;
  minutes: number;
  collapsed: boolean;
  onToggle: () => void;
  canManage: boolean;
  canEdit: boolean;
}) {
  const [, start] = useTransition();
  return (
    <div className="group/g flex items-center gap-2 px-1 py-2">
      <button onClick={onToggle} className="rounded p-0.5 hover:bg-black/5" style={{ color: group.color }}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
      </button>
      <input
        defaultValue={group.name}
        readOnly={!canEdit}
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

const BUILTIN_WIDTH: Record<BuiltinKey, number> = { people: 128, status: 144, priority: 128, due: 144, time: 128 };
const TYPE_WIDTH: Record<string, number> = { STATUS: 140, DROPDOWN: 180, PEOPLE: 120, TEXT: 180, LINK: 180, EMAIL: 190, PHONE: 140, NUMBER: 110, DATE: 130, CHECKBOX: 90, RATING: 120 };
const TITLE_WIDTH = 300;

type ColItem = { key: string; builtin?: { key: BuiltinKey; label: string }; column?: BoardColumnDef };

/** Une columnas fijas y personalizadas en el orden guardado del tablero; lo nuevo va al final. */
function orderedItems(order: string[], hidden: BuiltinKey[], columns: BoardColumnDef[]): ColItem[] {
  const all: ColItem[] = [
    ...BUILTIN_COLUMNS.filter((b) => !hidden.includes(b.key)).map((b) => ({ key: b.key as string, builtin: { key: b.key, label: b.label } })),
    ...columns.map((c) => ({ key: c.id, column: c })),
  ];
  const byKey = new Map(all.map((i) => [i.key, i]));
  const out: ColItem[] = [];
  for (const k of order) {
    const it = byKey.get(k);
    if (it) {
      out.push(it);
      byKey.delete(k);
    }
  }
  return [...out, ...byKey.values()];
}

function TableView({
  boardId,
  groups: boardGroups,
  tasks,
  people,
  canManage,
  canEdit,
  columns,
  hidden,
  groupBy,
  columnOrder,
  columnWidths,
}: Props & { groupBy: "groups" | "status" }) {
  const byStatus = groupBy === "status";
  // En la vista por estado, cada estado con tareas es un grupo "virtual".
  const groups: BoardGroup[] = byStatus
    ? STATUSES.filter((s) => tasks.some((t) => t.status === s.value)).map((s) => ({ id: `status:${s.value}`, name: s.label, color: s.color }))
    : boardGroups;
  const inGroup = (t: BoardTask, g: BoardGroup) => (byStatus ? `status:${t.status}` === g.id : t.groupId === g.id);

  // Orden y anchos con cambio inmediato en pantalla; se guardan en el tablero.
  const [order, setOrder] = useState<string[]>(columnOrder);
  const [widths, setWidths] = useState<Record<string, number>>(columnWidths);
  useEffect(() => setOrder(columnOrder), [columnOrder]);
  useEffect(() => setWidths(columnWidths), [columnWidths]);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const items = orderedItems(order, hidden, columns);
  const widthOf = (it: ColItem | "title") =>
    it === "title" ? widths.title ?? TITLE_WIDTH : widths[it.key] ?? (it.builtin ? BUILTIN_WIDTH[it.builtin.key] : TYPE_WIDTH[it.column!.type] ?? 140);
  const tableWidth = widthOf("title") + items.reduce((a, it) => a + widthOf(it), 0) + 44;

  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const resizing = useRef(false);

  const saveOrder = (keys: string[]) => {
    setOrder(keys);
    start(() => setColumnLayout(boardId, { order: keys }));
  };
  const moveTo = (from: string, to: string) => {
    const keys = items.map((i) => i.key);
    const fi = keys.indexOf(from);
    const ti = keys.indexOf(to);
    if (fi < 0 || ti < 0 || fi === ti) return;
    keys.splice(fi, 1);
    keys.splice(ti, 0, from);
    saveOrder(keys);
  };
  const moveBy = (key: string, dir: -1 | 1) => {
    const keys = items.map((i) => i.key);
    const i = keys.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= keys.length) return undefined;
    return () => moveTo(key, keys[j]);
  };
  const startResize = (key: string, e: React.MouseEvent, current: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    const x0 = e.clientX;
    let latest = current;
    const onMove = (ev: MouseEvent) => {
      latest = Math.min(800, Math.max(60, current + ev.clientX - x0));
      setWidths((w) => ({ ...w, [key]: latest }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      resizing.current = false;
      const next = { ...widthsRef.current, [key]: latest };
      setWidths(next);
      start(() => setColumnLayout(boardId, { widths: next }));
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const ResizeHandle = ({ k, w }: { k: string; w: number }) =>
    canEdit ? (
      <span
        onMouseDown={(e) => startResize(k, e, w)}
        onDoubleClick={() => {
          const next = { ...widths };
          delete next[k];
          setWidths(next);
          start(() => setColumnLayout(boardId, { widths: next }));
        }}
        draggable={false}
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize after:absolute after:inset-y-1.5 after:left-[3px] after:w-0.5 after:rounded after:bg-transparent hover:after:bg-brand-500"
        title="Arrastra para cambiar el ancho (doble clic: ancho original)"
      />
    ) : null;

  const hasSummary = columns.some((c) => c.type === "NUMBER" || c.type === "STATUS" || c.type === "CHECKBOX");
  const builtinCell = (k: BuiltinKey, t: BoardTask) => {
    switch (k) {
      case "people": return <AssigneePicker taskId={t.id} assignees={t.assignees} people={people} />;
      case "status": return <ReadOnly on={!canEdit && !t.mine}><StatusSelect taskId={t.id} status={t.status} /></ReadOnly>;
      case "priority": return <PrioritySelect taskId={t.id} priority={t.priority} />;
      case "due": return <DateCell taskId={t.id} value={t.dueDate} done={t.status === "DONE"} />;
      case "time": return <ReadOnly on={!canEdit && !t.mine}><TimeCell task={t} /></ReadOnly>;
    }
  };
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const href = useOpenTask();
  const [newGroup, setNewGroup] = useState("");
  const [, start] = useTransition();

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const rows = tasks.filter((t) => inGroup(t, g));
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
              canManage={canManage && !byStatus}
              canEdit={canEdit && !byStatus}
            />
            {!collapsed[g.id] && (
              <div className="card overflow-x-auto" style={{ borderLeft: `4px solid ${g.color}` }}>
                <table className="table-fixed text-sm" style={{ width: tableWidth, minWidth: "100%" }}>
                  <colgroup>
                    <col style={{ width: widthOf("title") }} />
                    {items.map((it) => <col key={it.key} style={{ width: widthOf(it) }} />)}
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="relative px-3 py-2 font-medium">
                        Tarea
                        <ResizeHandle k="title" w={widthOf("title")} />
                      </th>
                      {items.map((it) => (
                        <th
                          key={it.key}
                          draggable={canEdit}
                          onDragStart={(e) => {
                            if (resizing.current) return e.preventDefault();
                            setDragKey(it.key);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", it.key);
                          }}
                          onDragOver={(e) => {
                            if (!dragKey) return;
                            e.preventDefault();
                            setOverKey(it.key);
                          }}
                          onDragLeave={() => setOverKey((k) => (k === it.key ? null : k))}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragKey) moveTo(dragKey, it.key);
                            setDragKey(null);
                            setOverKey(null);
                          }}
                          onDragEnd={() => {
                            setDragKey(null);
                            setOverKey(null);
                          }}
                          className={`relative px-2 py-2 font-normal ${it.column ? "border-l border-line/60" : ""} ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragKey === it.key ? "opacity-40" : ""} ${overKey === it.key && dragKey !== it.key ? "bg-brand-50 shadow-[inset_2px_0_0_#14a38b]" : ""}`}
                          title={canEdit ? "Arrastra para mover la columna" : undefined}
                        >
                          {it.builtin ? (
                            <BuiltinHeader
                              boardId={boardId}
                              k={it.builtin.key}
                              label={it.builtin.label}
                              canManage={canManage}
                              canEdit={canEdit}
                              onMove={{ left: moveBy(it.key, -1), right: moveBy(it.key, 1) }}
                            />
                          ) : canEdit ? (
                            <ColumnHeader column={it.column!} canManage={canManage} onMove={{ left: moveBy(it.key, -1), right: moveBy(it.key, 1) }} />
                          ) : (
                            <span className="block truncate px-1 font-medium">{it.column!.name}</span>
                          )}
                          <ResizeHandle k={it.key} w={widthOf(it)} />
                        </th>
                      ))}
                      <th className="px-1 py-1.5 text-left font-normal">
                        {canEdit && <AddColumnButton boardId={boardId} hidden={hidden} canManage={canManage} />}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.id} className="border-b border-line/70 hover:bg-canvas/60">
                        <td className="px-3 py-1.5">
                          <Link href={href(t.id)} scroll={false} className="flex items-center gap-2 hover:text-brand-700">
                            <span className={`min-w-0 ${t.status === "DONE" ? "text-muted line-through" : "font-medium"}`}>{t.title}</span>
                            {t.subtaskCount > 0 && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-canvas px-1.5 py-0.5 text-[11px] text-muted">
                                <ListTree size={11} /> {t.subtaskDone}/{t.subtaskCount}
                              </span>
                            )}
                          </Link>
                        </td>
                        {items.map((it) =>
                          it.builtin ? (
                            <td key={it.key} className="overflow-hidden px-2 py-1.5">
                              {it.builtin.key === "status" || it.builtin.key === "time" ? (
                                builtinCell(it.builtin.key, t)
                              ) : (
                                <ReadOnly on={!canEdit}>{builtinCell(it.builtin.key, t)}</ReadOnly>
                              )}
                            </td>
                          ) : (
                            <td key={it.key} className="border-l border-line/60 px-1.5 py-1">
                              <ReadOnly on={!canEdit}>
                                <ColumnCell taskId={t.id} column={it.column!} value={t.values[it.key] ?? null} people={people} />
                              </ReadOnly>
                            </td>
                          ),
                        )}
                        <td />
                      </tr>
                    ))}
                    {hasSummary && rows.length > 0 && (
                      <tr className="text-xs">
                        <td />
                        {items.map((it) =>
                          it.column ? (
                            <td key={it.key} className="border-l border-line/60 px-2 py-1.5">
                              <ColumnSummary column={it.column} values={rows.map((t) => t.values[it.key] ?? null)} />
                            </td>
                          ) : (
                            <td key={it.key} />
                          ),
                        )}
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
                {canEdit && !byStatus && <AddTaskRow boardId={boardId} groupId={g.id} />}
                {rows.length > 0 && <StatusBar tasks={rows} label={`${done} de ${rows.length} terminadas`} />}
              </div>
            )}
          </section>
        );
      })}
      {canEdit && !byStatus && (
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
      )}
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

function KanbanView({ tasks, groups, canEdit }: Props) {
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
                    draggable={canEdit || t.mine}
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
