import type { TaskStatus } from "@prisma/client";
import { STATUSES } from "@/lib/constants";

/** Configuración de estados por tablero: cuáles se usan y con qué nombre y color. */
export type StatusConfig = { hidden?: TaskStatus[]; labels?: Partial<Record<TaskStatus, string>>; colors?: Partial<Record<TaskStatus, string>> };
export type StatusOption = { value: TaskStatus; label: string; color: string; soft: string; hidden: boolean };

/** Estados que un tablero nuevo no muestra hasta que se activan. */
export const DEFAULT_HIDDEN: TaskStatus[] = [];

const valid = new Set(STATUSES.map((s) => s.value));

export function asStatusConfig(json: unknown): StatusConfig {
  if (!json || typeof json !== "object") return {};
  const j = json as Record<string, unknown>;
  const out: StatusConfig = {};
  if (Array.isArray(j.hidden)) out.hidden = j.hidden.filter((s): s is TaskStatus => valid.has(s as TaskStatus));
  for (const key of ["labels", "colors"] as const) {
    const v = j[key];
    if (v && typeof v === "object") {
      const m: Partial<Record<TaskStatus, string>> = {};
      for (const [k, val] of Object.entries(v)) if (valid.has(k as TaskStatus) && typeof val === "string" && val.trim()) m[k as TaskStatus] = val.trim().slice(0, 40);
      out[key] = m;
    }
  }
  return out;
}

/** Color suave (fondo) a partir del color principal. */
const soften = (hex: string) => `${hex}22`;

export function statusOptions(config: StatusConfig = {}): StatusOption[] {
  return STATUSES.map((s) => {
    const color = config.colors?.[s.value];
    return {
      value: s.value,
      label: config.labels?.[s.value] ?? s.label,
      color: color ?? s.color,
      soft: color ? soften(color) : s.soft,
      hidden: (config.hidden ?? DEFAULT_HIDDEN).includes(s.value),
    };
  });
}
