import type { ColumnType } from "@prisma/client";

/** Definiciones compartidas (cliente y servidor) de las columnas personalizadas. */

export type ColumnLabel = { id: string; name: string; color: string };
export type ColumnSettings = { labels?: ColumnLabel[]; unit?: string };
export type ColumnValue = string | number | boolean | string[] | null;

export type BoardColumnDef = {
  id: string;
  name: string;
  type: ColumnType;
  position: number;
  settings: ColumnSettings;
};

export const COLUMN_TYPES: { value: ColumnType; label: string; hint: string }[] = [
  { value: "STATUS", label: "Estado", hint: "Etiquetas de colores, una por tarea" },
  { value: "TEXT", label: "Texto", hint: "Notas cortas" },
  { value: "NUMBER", label: "Números", hint: "Cantidades, costos, metros…" },
  { value: "DATE", label: "Fecha", hint: "Un día del calendario" },
  { value: "PEOPLE", label: "Personas", hint: "Miembros del tablero" },
  { value: "DROPDOWN", label: "Etiquetas", hint: "Varias etiquetas por tarea" },
  { value: "CHECKBOX", label: "Casilla", hint: "Sí / no" },
  { value: "LINK", label: "Enlace", hint: "Dirección web" },
  { value: "EMAIL", label: "Correo", hint: "Correo electrónico" },
  { value: "PHONE", label: "Teléfono", hint: "Número de teléfono" },
  { value: "RATING", label: "Calificación", hint: "De 1 a 5 estrellas" },
];

export const columnTypeLabel = (t: ColumnType) => COLUMN_TYPES.find((c) => c.value === t)?.label ?? t;

export const LABEL_COLORS = [
  "#00c875", "#fdab3d", "#e2445c", "#579bfc", "#a25ddc", "#ff7575",
  "#037f4c", "#9cd326", "#ffcb00", "#66ccff", "#784bd1", "#c4c4c4",
];

const rid = () => Math.random().toString(36).slice(2, 9);

export function newLabel(name: string, color?: string): ColumnLabel {
  return { id: rid(), name, color: color ?? LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)] };
}

export function defaultSettings(type: ColumnType): ColumnSettings {
  if (type === "STATUS") {
    return { labels: [newLabel("Listo", "#00c875"), newLabel("En proceso", "#fdab3d"), newLabel("Detenido", "#e2445c")] };
  }
  if (type === "DROPDOWN") return { labels: [] };
  if (type === "NUMBER") return { unit: "" };
  return {};
}

/** Columnas fijas que se pueden ocultar por tablero. */
export const BUILTIN_COLUMNS = [
  { key: "people", label: "Responsables" },
  { key: "status", label: "Estado" },
  { key: "priority", label: "Prioridad" },
  { key: "due", label: "Fecha límite" },
  { key: "time", label: "Tiempo" },
] as const;
export type BuiltinKey = (typeof BUILTIN_COLUMNS)[number]["key"];

export function asSettings(json: unknown): ColumnSettings {
  if (!json || typeof json !== "object") return {};
  const s = json as Record<string, unknown>;
  const out: ColumnSettings = {};
  if (Array.isArray(s.labels)) {
    out.labels = s.labels
      .filter((l): l is ColumnLabel => !!l && typeof l === "object" && typeof (l as ColumnLabel).id === "string")
      .map((l) => ({ id: l.id, name: String(l.name ?? ""), color: String(l.color ?? "#c4c4c4") }));
  }
  if (typeof s.unit === "string") out.unit = s.unit;
  return out;
}

/** Valor como texto plano (para exportar o mostrar en resumen). */
export function valueToText(col: BoardColumnDef, v: ColumnValue, people: { id: string; name: string | null; email: string }[] = []): string {
  if (v === null || v === undefined || v === "") return "";
  switch (col.type) {
    case "STATUS":
      return col.settings.labels?.find((l) => l.id === v)?.name ?? "";
    case "DROPDOWN":
      return (Array.isArray(v) ? v : []).map((id) => col.settings.labels?.find((l) => l.id === id)?.name).filter(Boolean).join(", ");
    case "PEOPLE":
      return (Array.isArray(v) ? v : []).map((id) => { const p = people.find((x) => x.id === id); return p ? p.name ?? p.email : ""; }).filter(Boolean).join(", ");
    case "CHECKBOX":
      return v ? "Sí" : "No";
    case "NUMBER":
      return `${v}${col.settings.unit ? ` ${col.settings.unit}` : ""}`;
    case "RATING":
      return `${v}/5`;
    default:
      return String(v);
  }
}
