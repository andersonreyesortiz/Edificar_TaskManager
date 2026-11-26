import type { Priority, TaskStatus } from "@prisma/client";

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
};

export type BoardGroup = { id: string; name: string; color: string };
