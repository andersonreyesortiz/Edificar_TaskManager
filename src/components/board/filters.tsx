"use client";

import { Check, Filter, X } from "lucide-react";
import { PRIORITIES } from "@/lib/constants";
import type { BoardColumnDef, ColumnValue } from "@/lib/columns";
import { Popover } from "@/components/Popover";
import { Avatar } from "@/components/Avatar";
import { LabelChip } from "./columns";
import { TYPE_ICONS } from "./column-icons";
import type { BoardTask, Person } from "./types";

/** Filtros activos: por clave (columna o "__people"/"__priority") los valores aceptados. */
export type Filters = Record<string, string[]>;

type Option = { value: string; node: React.ReactNode };
type Section = { key: string; title: string; icon?: React.ReactNode; options: Option[] };

function personNode(p: Person) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={p.name} email={p.email} image={p.image} size={18} />
      <span className="truncate">{p.name ?? p.email}</span>
    </span>
  );
}

export function filterSections(columns: BoardColumnDef[], people: Person[]): Section[] {
  const sections: Section[] = [
    { key: "__people", title: "Responsables", options: people.map((p) => ({ value: p.id, node: personNode(p) })) },
    { key: "__priority", title: "Prioridad", options: PRIORITIES.map((p) => ({ value: p.value, node: <span style={{ color: p.color }} className="font-medium">{p.label}</span> })) },
  ];
  for (const c of columns) {
    const Icon = TYPE_ICONS[c.type];
    const icon = <Icon size={12} />;
    const empty = { value: "__empty", node: <span className="text-muted">Vacío</span> };
    if (c.type === "STATUS" || c.type === "DROPDOWN") {
      sections.push({ key: c.id, title: c.name, icon, options: [...(c.settings.labels ?? []).map((l) => ({ value: l.id, node: <LabelChip label={l} /> })), empty] });
    } else if (c.type === "PEOPLE") {
      sections.push({ key: c.id, title: c.name, icon, options: [...people.map((p) => ({ value: p.id, node: personNode(p) })), empty] });
    } else if (c.type === "CHECKBOX") {
      sections.push({ key: c.id, title: c.name, icon, options: [{ value: "yes", node: "Marcado" }, { value: "no", node: "Sin marcar" }] });
    } else if (c.type === "RATING") {
      sections.push({ key: c.id, title: c.name, icon, options: [...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), node: "★".repeat(n) })), empty] });
    } else {
      sections.push({ key: c.id, title: c.name, icon, options: [{ value: "__set", node: "Con valor" }, empty] });
    }
  }
  return sections;
}

function matchValue(col: BoardColumnDef, v: ColumnValue, accepted: string[]) {
  const isEmpty = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  if (col.type === "CHECKBOX") return accepted.includes(v === true ? "yes" : "no");
  if (isEmpty) return accepted.includes("__empty");
  if (accepted.includes("__set")) return true;
  if (Array.isArray(v)) return v.some((x) => accepted.includes(x));
  return accepted.includes(String(v));
}

export function matchesFilters(t: BoardTask, filters: Filters, columns: BoardColumnDef[]) {
  for (const [key, accepted] of Object.entries(filters)) {
    if (!accepted.length) continue;
    if (key === "__people") {
      if (!t.assignees.some((a) => accepted.includes(a.id))) return false;
    } else if (key === "__priority") {
      if (!accepted.includes(t.priority)) return false;
    } else {
      const col = columns.find((c) => c.id === key);
      if (col && !matchValue(col, t.values[key] ?? null, accepted)) return false;
    }
  }
  return true;
}

/** Texto de las columnas de texto, para que la búsqueda también las encuentre. */
export function searchableText(t: BoardTask, columns: BoardColumnDef[]) {
  const parts = [t.title];
  for (const c of columns) {
    const v = t.values[c.id];
    if (typeof v === "string" && ["TEXT", "LINK", "EMAIL", "PHONE"].includes(c.type)) parts.push(v);
  }
  return parts.join(" ").toLowerCase();
}

export function FilterButton({
  columns,
  people,
  filters,
  onChange,
}: {
  columns: BoardColumnDef[];
  people: Person[];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const sections = filterSections(columns, people);
  const active = Object.values(filters).reduce((a, v) => a + v.length, 0);
  const toggle = (key: string, value: string) => {
    const cur = filters[key] ?? [];
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    onChange({ ...filters, [key]: next });
  };
  return (
    <span className="inline-flex items-center gap-1">
      <Popover
        width={300}
        trigger={() => (
          <button className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${active ? "border-brand-500 bg-brand-50 text-brand-900" : "border-line bg-white"}`}>
            <Filter size={14} /> Filtrar{active ? ` (${active})` : ""}
          </button>
        )}
      >
        {() => (
          <div className="space-y-3 p-2 text-sm">
            {sections.map((s) => (
              <div key={s.key}>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">{s.icon}{s.title}</p>
                <div className="flex flex-wrap gap-1">
                  {s.options.map((o) => {
                    const on = (filters[s.key] ?? []).includes(o.value);
                    return (
                      <button
                        key={o.value}
                        onClick={() => toggle(s.key, o.value)}
                        className={`inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-1 text-xs ${on ? "border-brand-500 bg-brand-50" : "border-line hover:bg-canvas"}`}
                      >
                        {on && <Check size={11} className="shrink-0 text-brand-700" />}
                        {o.node}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Popover>
      {active > 0 && (
        <button onClick={() => onChange({})} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-black/5" title="Quitar filtros">
          <X size={12} /> Limpiar
        </button>
      )}
    </span>
  );
}
