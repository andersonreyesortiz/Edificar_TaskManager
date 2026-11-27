"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Check,
  ChevronDown,
  EyeOff,
  Link2,
  ListChecks,
  Phone,
  Plus,
  Settings2,
  Star,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type { ColumnType } from "@prisma/client";
import {
  BUILTIN_COLUMNS,
  COLUMN_TYPES,
  LABEL_COLORS,
  newLabel,
  type BoardColumnDef,
  type BuiltinKey,
  type ColumnLabel,
  type ColumnValue,
} from "@/lib/columns";
import { createColumn, deleteColumn, setBuiltinColumnHidden, setColumnValue, updateColumn } from "@/lib/actions";
import { StatusManager } from "./StatusManager";
import { Popover } from "@/components/Popover";
import { Avatar } from "@/components/Avatar";
import { AvatarStack } from "./cells";
import { TYPE_ICONS } from "./column-icons";
export { TYPE_ICONS };
import type { Person } from "./types";


// ---------- celdas ----------

export function ColumnCell({
  taskId,
  column,
  value,
  people,
  wide,
}: {
  taskId: string;
  column: BoardColumnDef;
  value: ColumnValue;
  people: Person[];
  /** En el panel de la tarea las celdas pueden ocupar más espacio. */
  wide?: boolean;
}) {
  const [current, setCurrent] = useOptimistic(value);
  const [, start] = useTransition();
  const save = (v: ColumnValue) =>
    start(async () => {
      setCurrent(v);
      await setColumnValue(taskId, column.id, v);
    });

  switch (column.type) {
    case "TEXT":
    case "LINK":
    case "EMAIL":
    case "PHONE":
      return <TextCell type={column.type} value={typeof current === "string" ? current : ""} onSave={save} wide={wide} />;
    case "NUMBER":
      return <NumberCell value={typeof current === "number" ? current : null} unit={column.settings.unit} onSave={save} wide={wide} />;
    case "DATE":
      return (
        <input
          type="date"
          key={String(current)}
          defaultValue={typeof current === "string" ? current : ""}
          onChange={(e) => save(e.target.value || null)}
          className="rounded-md bg-transparent px-1 py-1 text-xs outline-none hover:bg-canvas focus:bg-white focus:ring-1 focus:ring-line"
        />
      );
    case "CHECKBOX":
      return (
        <input
          type="checkbox"
          checked={current === true}
          onChange={(e) => save(e.target.checked ? true : null)}
          className="h-4 w-4 cursor-pointer accent-brand-700"
        />
      );
    case "RATING":
      return <RatingCell value={typeof current === "number" ? current : 0} onSave={save} />;
    case "STATUS":
      return <LabelCell column={column} selected={typeof current === "string" ? [current] : []} multi={false} onSave={(ids) => save(ids[0] ?? null)} />;
    case "DROPDOWN":
      return <LabelCell column={column} selected={Array.isArray(current) ? current : []} multi onSave={(ids) => save(ids.length ? ids : null)} />;
    case "PEOPLE":
      return <PeopleCell selected={Array.isArray(current) ? current : []} people={people} onSave={(ids) => save(ids.length ? ids : null)} />;
  }
}

function TextCell({ type, value, onSave, wide }: { type: ColumnType; value: string; onSave: (v: string | null) => void; wide?: boolean }) {
  const href = !value ? null : type === "LINK" ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : type === "EMAIL" ? `mailto:${value}` : type === "PHONE" ? `tel:${value.replace(/\s/g, "")}` : null;
  return (
    <span className="flex min-w-0 items-center gap-1">
      <input
        key={value}
        defaultValue={value}
        type={type === "EMAIL" ? "email" : type === "PHONE" ? "tel" : "text"}
        placeholder={type === "LINK" ? "https://" : ""}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== value) onSave(v || null);
        }}
        className={`min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-1 text-xs outline-none hover:bg-canvas focus:bg-white focus:ring-1 focus:ring-line ${href ? "text-brand-700" : ""} ${wide ? "text-sm" : ""}`}
      />
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="shrink-0 rounded p-0.5 text-muted hover:text-brand-700" title="Abrir">
          {type === "LINK" ? <Link2 size={12} /> : type === "EMAIL" ? <AtSign size={12} /> : <Phone size={12} />}
        </a>
      )}
    </span>
  );
}

function NumberCell({ value, unit, onSave, wide }: { value: number | null; unit?: string; onSave: (v: number | null) => void; wide?: boolean }) {
  return (
    <span className={`flex items-center gap-1 ${wide ? "w-40" : ""}`}>
      <input
        key={String(value)}
        type="number"
        step="any"
        defaultValue={value ?? ""}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        onBlur={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          if (v !== value) onSave(v);
        }}
        className="w-full min-w-0 rounded-md bg-transparent px-1.5 py-1 text-right text-xs tabular-nums outline-none hover:bg-canvas focus:bg-white focus:ring-1 focus:ring-line"
      />
      {unit && <span className="shrink-0 text-[11px] text-muted">{unit}</span>}
    </span>
  );
}

function RatingCell({ value, onSave }: { value: number; onSave: (v: number | null) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onClick={() => onSave(n === value ? null : n)}
          className="p-0.5"
          title={`${n} de 5`}
        >
          <Star size={14} className={(hover || value) >= n ? "fill-amber-400 text-amber-400" : "text-line"} />
        </button>
      ))}
    </span>
  );
}

export function LabelChip({ label, full }: { label: ColumnLabel; full?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center truncate rounded px-2 py-1 text-xs font-medium text-white ${full ? "w-full" : ""}`}
      style={{ background: label.color }}
    >
      {label.name || " "}
    </span>
  );
}

function LabelCell({
  column,
  selected,
  multi,
  onSave,
}: {
  column: BoardColumnDef;
  selected: string[];
  multi: boolean;
  onSave: (ids: string[]) => void;
}) {
  const labels = column.settings.labels ?? [];
  const chosen = labels.filter((l) => selected.includes(l.id));
  const [newName, setNewName] = useState("");
  const [, start] = useTransition();
  const addLabel = () => {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    const l = newLabel(name, LABEL_COLORS[labels.length % LABEL_COLORS.length]);
    start(async () => {
      await updateColumn(column.id, { settings: { labels: [...labels, l] } });
      onSave(multi ? [...selected, l.id] : [l.id]);
    });
  };
  return (
    <Popover
      width={220}
      className="relative block w-full"
      trigger={() =>
        multi ? (
          <button className="flex min-h-7 w-full flex-wrap items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-canvas">
            {chosen.length ? chosen.map((l) => <LabelChip key={l.id} label={l} />) : <span className="px-1 text-xs text-muted">—</span>}
          </button>
        ) : (
          <button className="flex w-full min-w-24">
            {chosen[0] ? (
              <LabelChip label={chosen[0]} full />
            ) : (
              <span className="flex h-7 w-full items-center justify-center rounded bg-[#c4c4c4]/40 text-xs text-muted hover:bg-[#c4c4c4]/60">—</span>
            )}
          </button>
        )
      }
    >
      {(close) => (
        <div className="space-y-1 p-1">
          {labels.map((l) => {
            const on = selected.includes(l.id);
            return (
              <button
                key={l.id}
                onClick={() => {
                  if (multi) onSave(on ? selected.filter((x) => x !== l.id) : [...selected, l.id]);
                  else {
                    close();
                    onSave(on ? [] : [l.id]);
                  }
                }}
                className="flex w-full items-center gap-2"
              >
                <span className="min-w-0 flex-1"><LabelChip label={l} full /></span>
                <Check size={14} className={on ? "text-brand-700" : "invisible"} />
              </button>
            );
          })}
          {labels.length === 0 && <p className="px-1 py-1 text-xs text-muted">Aún no hay etiquetas.</p>}
          {!multi && selected.length > 0 && (
            <button onClick={() => { close(); onSave([]); }} className="w-full rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-canvas">
              Quitar
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addLabel();
            }}
            className="flex items-center gap-1 border-t border-line pt-1"
          >
            <Plus size={12} className="shrink-0 text-muted" />
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva etiqueta" className="w-full bg-transparent py-1 text-xs outline-none" />
          </form>
        </div>
      )}
    </Popover>
  );
}

function PeopleCell({ selected, people, onSave }: { selected: string[]; people: Person[]; onSave: (ids: string[]) => void }) {
  const chosen = people.filter((p) => selected.includes(p.id));
  return (
    <Popover
      width={250}
      trigger={() => (
        <button className="flex min-h-7 items-center rounded-md px-1 hover:bg-canvas">
          {chosen.length ? (
            <AvatarStack people={chosen} />
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted/50 text-muted">
              <UserPlus size={12} />
            </span>
          )}
        </button>
      )}
    >
      {() => (
        <div>
          {people.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onSave(on ? selected.filter((x) => x !== p.id) : [...selected, p.id])}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
              >
                <Avatar name={p.name} email={p.email} image={p.image} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.name ?? p.email}</span>
                  {p.name && <span className="block truncate text-[11px] text-muted">{p.email}</span>}
                </span>
                {on && <Check size={14} className="text-brand-700" />}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

// ---------- encabezados ----------

export function ColumnHeader({
  column,
  canManage,
  onMove,
}: {
  column: BoardColumnDef;
  canManage: boolean;
  /** Mueve la columna una posición; undefined si no puede ir en esa dirección */
  onMove: { left?: () => void; right?: () => void };
}) {
  const [, start] = useTransition();
  const Icon = TYPE_ICONS[column.type];
  const [name, setName] = useState(column.name);
  const [unit, setUnit] = useState(column.settings.unit ?? "");
  const hasLabels = column.type === "STATUS" || column.type === "DROPDOWN";
  return (
    <Popover
      width={260}
      trigger={() => (
        <button className="group inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 font-medium hover:bg-canvas hover:text-ink">
          <Icon size={12} className="shrink-0" />
          <span className="truncate">{column.name}</span>
          <ChevronDown size={11} className="shrink-0 opacity-0 group-hover:opacity-100" />
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-2 p-2 text-sm font-normal text-ink">
          <div>
            <label className="label">Nombre de la columna</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              onBlur={() => name.trim() && name.trim() !== column.name && start(() => updateColumn(column.id, { name: name.trim() }))}
              className="input"
            />
          </div>
          {column.type === "NUMBER" && (
            <div>
              <label className="label">Unidad (opcional)</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Q, m², kg…"
                onBlur={() => unit !== (column.settings.unit ?? "") && start(() => updateColumn(column.id, { settings: { unit: unit.trim() } }))}
                className="input"
              />
            </div>
          )}
          {hasLabels && <LabelEditor column={column} />}
          <div className="flex items-center gap-1 border-t border-line pt-2">
            <MoveButtons onMove={onMove} />
            {canManage && (
              <button
                onClick={() => {
                  if (!confirm(`¿Borrar la columna «${column.name}» y todos sus datos?`)) return;
                  close();
                  start(() => deleteColumn(column.id));
                }}
                className="btn-ghost ml-auto px-2 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} /> Borrar
              </button>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

function LabelEditor({ column }: { column: BoardColumnDef }) {
  const [labels, setLabels] = useState<ColumnLabel[]>(column.settings.labels ?? []);
  const [, start] = useTransition();
  const persist = (next: ColumnLabel[]) => {
    setLabels(next);
    start(() => updateColumn(column.id, { settings: { labels: next } }));
  };
  return (
    <div>
      <label className="label">Etiquetas</label>
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {labels.map((l, i) => (
          <div key={l.id} className="flex items-center gap-1.5">
            <Popover
              width={150}
              trigger={() => <button className="h-6 w-6 shrink-0 rounded" style={{ background: l.color }} title="Color" />}
            >
              {(close) => (
                <div className="grid grid-cols-6 gap-1 p-1">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        close();
                        persist(labels.map((x, j) => (j === i ? { ...x, color: c } : x)));
                      }}
                      className="h-5 w-5 rounded"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              )}
            </Popover>
            <input
              defaultValue={l.name}
              onBlur={(e) => e.target.value.trim() !== l.name && persist(labels.map((x, j) => (j === i ? { ...x, name: e.target.value.trim() } : x)))}
              className="min-w-0 flex-1 rounded border border-line px-1.5 py-0.5 text-xs outline-none focus:border-brand-500"
            />
            <button
              onClick={() => confirm(`¿Quitar la etiqueta «${l.name}»? Las tareas que la tengan quedarán vacías.`) && persist(labels.filter((_, j) => j !== i))}
              className="rounded p-0.5 text-muted hover:text-red-600"
              title="Quitar etiqueta"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => persist([...labels, newLabel("Nueva etiqueta", LABEL_COLORS[labels.length % LABEL_COLORS.length])])}
        className="mt-1 text-xs font-medium text-brand-700 hover:underline"
      >
        + Agregar etiqueta
      </button>
    </div>
  );
}

function MoveButtons({ onMove }: { onMove: { left?: () => void; right?: () => void } }) {
  return (
    <>
      <button disabled={!onMove.left} onClick={onMove.left} className="btn-ghost px-2 disabled:opacity-30" title="Mover a la izquierda">
        <ArrowLeft size={14} />
      </button>
      <button disabled={!onMove.right} onClick={onMove.right} className="btn-ghost px-2 disabled:opacity-30" title="Mover a la derecha">
        <ArrowRight size={14} />
      </button>
    </>
  );
}

export function BuiltinHeader({
  boardId,
  k,
  label,
  canManage,
  canEdit,
  onMove,
}: {
  boardId: string;
  k: BuiltinKey;
  label: string;
  canManage: boolean;
  canEdit: boolean;
  onMove: { left?: () => void; right?: () => void };
}) {
  const [, start] = useTransition();
  const [managing, setManaging] = useState(false);
  if (!canEdit) return <span className="px-1 font-medium">{label}</span>;
  return (
    <>
    {managing && <StatusManager boardId={boardId} onClose={() => setManaging(false)} />}
    <Popover
      width={200}
      trigger={() => (
        <button className="group inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:bg-canvas hover:text-ink">
          {label}
          <ChevronDown size={11} className="opacity-0 group-hover:opacity-100" />
        </button>
      )}
    >
      {(close) => (
        <div className="text-sm font-normal text-ink">
          <div className="flex items-center gap-1 px-1 py-1">
            <MoveButtons onMove={onMove} />
          </div>
          {canManage && (
            <button
              onClick={() => {
                close();
                start(() => setBuiltinColumnHidden(boardId, k, true));
              }}
              className="flex w-full items-center gap-2 rounded-md border-t border-line px-2 py-1.5 text-left hover:bg-canvas"
            >
              <EyeOff size={14} /> Ocultar columna
            </button>
          )}
          {canManage && k === "status" && (
            <button
              onClick={() => {
                close();
                setManaging(true);
              }}
              className="flex w-full items-center gap-2 rounded-md border-t border-line px-2 py-1.5 text-left hover:bg-canvas"
            >
              <Settings2 size={14} /> Gestionar estados
            </button>
          )}
        </div>
      )}
    </Popover>
    </>
  );
}

export function AddColumnButton({ boardId, hidden, canManage }: { boardId: string; hidden: BuiltinKey[]; canManage: boolean }) {
  const [, start] = useTransition();
  const [type, setType] = useState<ColumnType | null>(null);
  const [name, setName] = useState("");
  return (
    <Popover
      width={280}
      align="right"
      trigger={() => (
        <button className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink" title="Agregar columna">
          <Plus size={15} />
        </button>
      )}
    >
      {(close) =>
        type ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = type;
              const n = name;
              setType(null);
              setName("");
              close();
              start(() => createColumn(boardId, n, t));
            }}
            className="space-y-2 p-2 text-sm font-normal text-ink"
          >
            <p className="flex items-center gap-1.5 text-xs text-muted">
              {(() => { const I = TYPE_ICONS[type]; return <I size={12} />; })()}
              Columna de tipo {COLUMN_TYPES.find((c) => c.value === type)?.label}
            </p>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la columna" className="input" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setType(null)} className="btn-ghost">Atrás</button>
              <button className="btn-primary">Agregar</button>
            </div>
          </form>
        ) : (
          <div className="p-1 text-sm font-normal text-ink">
            <p className="px-2 py-1 text-xs text-muted">Agregar columna</p>
            <div className="grid grid-cols-2 gap-0.5">
              {COLUMN_TYPES.map((c) => {
                const I = TYPE_ICONS[c.value];
                return (
                  <button
                    key={c.value}
                    onClick={() => {
                      setType(c.value);
                      setName(c.label);
                    }}
                    title={c.hint}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-canvas"
                  >
                    <I size={14} className="text-brand-700" /> {c.label}
                  </button>
                );
              })}
            </div>
            {canManage && hidden.length > 0 && (
              <>
                <p className="mt-1 border-t border-line px-2 pb-1 pt-2 text-xs text-muted">Columnas ocultas</p>
                {BUILTIN_COLUMNS.filter((b) => hidden.includes(b.key)).map((b) => (
                  <button
                    key={b.key}
                    onClick={() => {
                      close();
                      start(() => setBuiltinColumnHidden(boardId, b.key, false));
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-canvas"
                  >
                    <ListChecks size={14} className="text-muted" /> Mostrar «{b.label}»
                  </button>
                ))}
              </>
            )}
          </div>
        )
      }
    </Popover>
  );
}

/** Resumen al pie del grupo: suma para números, distribución para estado. */
export function ColumnSummary({ column, values }: { column: BoardColumnDef; values: ColumnValue[] }) {
  if (column.type === "NUMBER") {
    const nums = values.filter((v): v is number => typeof v === "number");
    if (!nums.length) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return (
      <span className="block text-right text-xs font-medium tabular-nums" title="Suma">
        {sum.toLocaleString("es", { maximumFractionDigits: 2 })}
        {column.settings.unit ? <span className="ml-1 font-normal text-muted">{column.settings.unit}</span> : null}
        <span className="block text-[10px] font-normal text-muted">suma</span>
      </span>
    );
  }
  if (column.type === "STATUS") {
    const total = values.length;
    if (!total) return null;
    const labels = column.settings.labels ?? [];
    return (
      <span className="flex h-2 w-full overflow-hidden rounded-full bg-line">
        {labels.map((l) => {
          const n = values.filter((v) => v === l.id).length;
          return n ? <span key={l.id} title={`${l.name}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: l.color }} /> : null;
        })}
      </span>
    );
  }
  if (column.type === "CHECKBOX") {
    const n = values.filter((v) => v === true).length;
    return <span className="text-xs text-muted">{n}/{values.length}</span>;
  }
  return null;
}
