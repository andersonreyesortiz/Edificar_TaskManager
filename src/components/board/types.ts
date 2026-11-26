import type { Priority, TaskStatus } from "@prisma/client";
import type { ColumnValue } from "@/lib/columns";

export type Person = { id: string; name: string | null; email: string; image: string | null };

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  groupId: string | null;
  estimateMinutes: number | null;
  assignees: Person[];
  subtaskCount: number;
  subtaskDone: number;
  minutes: number;
  running: boolean;
  /** La persona actual es responsable de esta tarea */
  mine: boolean;
  /** Valores de columnas personalizadas por id de columna */
  values: Record<string, ColumnValue>;
  /** Subtareas (solo en tareas principales) */
  subtasks?: BoardTask[];
  /** Tarea principal (solo en subtareas) */
  parentId?: string | null;
};

export type BoardGroup = { id: string; name: string; color: string };
