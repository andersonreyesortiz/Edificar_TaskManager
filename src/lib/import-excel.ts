import type { ColumnType } from "@prisma/client";
import { LABEL_COLORS, newLabel, type ColumnSettings, type ColumnValue } from "@/lib/columns";

/**
 * Lectura de un Excel para crear un tablero. Entiende la exportación de monday.com
 * (fila con el nombre del grupo, fila de encabezados "Name", filas de elementos y bloques
 * "Subitems") y también una tabla simple (primera fila = encabezados).
 */

export type Cell = string | number | boolean | Date | null;
type Item = { title: string; values: Record<string, Cell>; subitems: Item[] };
export type ParsedSheet = { name: string | null; description: string | null; groups: { name: string; items: Item[] }[] };

const empty = (v: Cell | undefined) => v === null || v === undefined || (typeof v === "string" && (v.trim() === "" || v.trim() === "null"));
const filled = (row: Cell[]) => row.filter((v) => !empty(v)).length;
const text = (v: Cell) => (v instanceof Date ? v.toISOString() : String(v ?? "")).trim();

/** Encabezados que no se importan (identificadores internos de monday y la lista de subelementos). */
const SKIP_HEADER = /^(item id|subitems?$|subelementos?$)/i;
const TITLE_HEADER = /^(name|nombre|tarea|t[ií]tulo|elemento|item)$/i;

function readHeaders(row: Cell[]) {
  return row.map((h) => (empty(h) ? null : text(h)));
}

export function parseSheet(rows: Cell[][]): ParsedSheet {
  const isMonday = rows.some((r) => text(r[0]) === "Name");
  if (!isMonday) return parseSimple(rows);

  const out: ParsedSheet = { name: null, description: null, groups: [] };
  let itemHeaders: (string | null)[] = [];
  let subHeaders: (string | null)[] = [];
  let group: ParsedSheet["groups"][number] | null = null;
  let last: Item | null = null;
  let seenHeader = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!filled(r)) continue;
    const a = text(r[0]);
    const b = text(r[1]);
    if (a === "Name") {
      itemHeaders = readHeaders(r);
      seenHeader = true;
      continue;
    }
    if (a === "Subitems" && b === "Name") {
      subHeaders = readHeaders(r);
      continue;
    }
    // Una sola celda en la columna A: título del tablero (arriba) o nombre de un grupo.
    if (filled(r) === 1 && a) {
      const nextIsHeader = rows.slice(i + 1).find((x) => filled(x)) ?? [];
      if (text(nextIsHeader[0]) === "Name") {
        group = { name: a, items: [] };
        out.groups.push(group);
        last = null;
      } else if (!seenHeader && !out.groups.length) {
        if (!out.name) out.name = a;
        else if (!out.description) out.description = a;
      }
      continue;
    }
    if (!seenHeader) continue;
    if (a) {
      if (!group) {
        group = { name: "Grupo1", items: [] };
        out.groups.push(group);
      }
      last = { title: a, values: rowValues(itemHeaders, r), subitems: [] };
      group.items.push(last);
    } else if (b && last && subHeaders.length) {
      last.subitems.push({ title: b, values: rowValues(subHeaders, r), subitems: [] });
    }
    // Filas sin nombre (totales de monday) se ignoran.
  }
  return out;
}

function rowValues(headers: (string | null)[], r: Cell[]) {
  const values: Record<string, Cell> = {};
  headers.forEach((h, idx) => {
    if (!h || TITLE_HEADER.test(h) || SKIP_HEADER.test(h)) return;
    if (!empty(r[idx])) values[h] = r[idx];
  });
  return values;
}

function parseSimple(rows: Cell[][]): ParsedSheet {
  const start = rows.findIndex((r) => filled(r) >= 2);
  if (start < 0) return { name: null, description: null, groups: [] };
  const headers = readHeaders(rows[start]);
  let titleIdx = headers.findIndex((h) => h && TITLE_HEADER.test(h));
  if (titleIdx < 0) titleIdx = headers.findIndex((h) => !!h);
  const items: Item[] = [];
  for (const r of rows.slice(start + 1)) {
    const title = text(r[titleIdx]);
    if (!title) continue;
    const values: Record<string, Cell> = {};
    headers.forEach((h, idx) => {
      if (!h || idx === titleIdx || SKIP_HEADER.test(h)) return;
      if (!empty(r[idx])) values[h] = r[idx];
    });
    items.push({ title, values, subitems: [] });
  }
  return { name: null, description: null, groups: [{ name: "Grupo1", items }] };
}

// ---------- tipos de columna ----------

export type InferredColumn = { name: string; type: ColumnType; settings: ColumnSettings; count: number };

const PEOPLE_HEADER = /(encargad|equipo|owner|persona|responsable|asignad|people|person|miembro)/i;
const PEOPLE_VALUE = /^(deleted member|miembro eliminado)/i;
const TIME_ONLY = /^\d{1,2}:\d{2}(:\d{2})?\s*([ap]\.?\s?m\.?)?$/i;
const URL_RE = /(https?:\/\/|www\.)/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hasTime = (d: Date) => d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
const pad = (n: number) => String(n).padStart(2, "0");
/** Las fechas de Excel llegan como hora local escrita en UTC. */
export const excelDate = (d: Date, withTime: boolean) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` + (withTime && hasTime(d) ? `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : "");

function labelColor(name: string, i: number) {
  const n = name.toLowerCase();
  if (/(done|listo|termin|finaliz|fin |entregad|aprobad|adjudicad|^s[ií]$)/.test(n)) return "#00c875";
  if (/(working|proceso|en curso|progreso|pendiente)/.test(n)) return "#fdab3d";
  if (/(stuck|perdid|detenid|rechaz|^no\b|no se participa|no ejecutad)/.test(n)) return "#e2445c";
  if (/(archiv|pausa)/.test(n)) return "#c4c4c4";
  return LABEL_COLORS[(i + 3) % LABEL_COLORS.length];
}

/** Decide el tipo de cada columna mirando todos sus valores. */
export function inferColumns(sheet: ParsedSheet): InferredColumn[] {
  const order: string[] = [];
  const values = new Map<string, Cell[]>();
  const add = (it: Item) => {
    for (const [k, v] of Object.entries(it.values)) {
      if (!values.has(k)) {
        values.set(k, []);
        order.push(k);
      }
      values.get(k)!.push(v);
    }
  };
  for (const g of sheet.groups) for (const it of g.items) add(it);
  for (const g of sheet.groups) for (const it of g.items) it.subitems.forEach(add);

  return order.map((name) => {
    const vals = values.get(name)!;
    const count = vals.length;
    const strings = vals.filter((v): v is string => typeof v === "string").map((s) => s.trim());
    if (PEOPLE_HEADER.test(name) || strings.some((s) => PEOPLE_VALUE.test(s))) return { name, type: "PEOPLE", settings: {}, count };
    if (vals.every((v) => v instanceof Date)) {
      return { name, type: "DATE", settings: (vals as Date[]).some(hasTime) ? { time: true } : {}, count };
    }
    if (vals.every((v) => typeof v === "number")) return { name, type: "NUMBER", settings: { unit: "" }, count };
    if (vals.every((v) => typeof v === "boolean")) return { name, type: "CHECKBOX", settings: {}, count };
    if (strings.length === count) {
      if (strings.every((s) => EMAIL_RE.test(s))) return { name, type: "EMAIL", settings: {}, count };
      if (strings.filter((s) => URL_RE.test(s)).length >= count / 2) return { name, type: "LINK", settings: {}, count };
      if (strings.every((s) => TIME_ONLY.test(s))) return { name, type: "TEXT", settings: {}, count };
      const distinct = [...new Set(strings)];
      if (distinct.length <= 20 && distinct.every((s) => s.length <= 40) && (distinct.length <= count / 2 || count <= 3) && !strings.some((s) => s.includes(","))) {
        return { name, type: "STATUS", settings: { labels: distinct.map((d, i) => newLabel(d, labelColor(d, i))) }, count };
      }
    }
    return { name, type: "TEXT", settings: {}, count };
  });
}

/** Convierte una celda al valor que guarda la columna. Personas: solo si coinciden con alguien de la app. */
export function cellToValue(col: InferredColumn, v: Cell, people: { id: string; name: string | null; email: string }[]): ColumnValue {
  if (empty(v)) return null;
  switch (col.type) {
    case "DATE":
      return v instanceof Date ? excelDate(v, !!col.settings.time) : null;
    case "NUMBER":
      return typeof v === "number" ? v : null;
    case "CHECKBOX":
      return v === true ? true : null;
    case "STATUS":
      return col.settings.labels?.find((l) => l.name === text(v))?.id ?? null;
    case "PEOPLE": {
      const parts = text(v).split(",").map((s) => s.trim().toLowerCase());
      const ids = people.filter((p) => parts.includes(p.email.toLowerCase()) || (!!p.name && parts.includes(p.name.toLowerCase()))).map((p) => p.id);
      return ids.length ? [...new Set(ids)] : null;
    }
    default: {
      const s = v instanceof Date ? excelDate(v, true).replace("T", " ") : text(v);
      return s.slice(0, 2000) || null;
    }
  }
}
