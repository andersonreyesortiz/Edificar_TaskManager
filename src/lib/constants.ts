import type { Priority, Role, TaskStatus } from "@prisma/client";

export const STATUSES: { value: TaskStatus; label: string; color: string; soft: string }[] = [
  { value: "TODO", label: "Por hacer", color: "#64748b", soft: "#f1f5f9" },
  { value: "IN_PROGRESS", label: "En curso", color: "#2563eb", soft: "#dbeafe" },
  { value: "REVIEW", label: "En revisión", color: "#9333ea", soft: "#f3e8ff" },
  { value: "BLOCKED", label: "Bloqueada", color: "#dc2626", soft: "#fee2e2" },
  { value: "DONE", label: "Terminada", color: "#16a34a", soft: "#dcfce7" },
];

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "LOW", label: "Baja", color: "#94a3b8" },
  { value: "MEDIUM", label: "Media", color: "#0ea5e9" },
  { value: "HIGH", label: "Alta", color: "#f59e0b" },
  { value: "URGENT", label: "Urgente", color: "#e11d48" },
];

export const ROLES: { value: Role; label: string; help: string }[] = [
  { value: "ADMIN", label: "Administrador", help: "Ve todos los tableros y gestiona el equipo" },
  { value: "MEMBER", label: "Miembro", help: "Crea tableros y trabaja en los suyos" },
  { value: "GUEST", label: "Invitado", help: "Solo ve los tableros a los que lo agregan" },
];

export const BOARD_COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#ca8a04", "#4d7c0f", "#475569"];

export const statusMeta = (s: TaskStatus) => STATUSES.find((x) => x.value === s)!;
export const priorityMeta = (p: Priority) => PRIORITIES.find((x) => x.value === p)!;
export const roleMeta = (r: Role) => ROLES.find((x) => x.value === r)!;

export function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Zona horaria con la que se muestran fechas y horas (el servidor corre en UTC). */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "America/Guatemala";

export function fmtDateTime(d: Date) {
  return d.toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: APP_TIMEZONE });
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIMEZONE });
}
