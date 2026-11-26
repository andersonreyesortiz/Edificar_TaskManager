import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Filtro de tableros visibles para una persona. */
export function visibleBoardsWhere(user: User): Prisma.BoardWhereInput {
  if (user.role === "ADMIN") return { archived: false };
  return {
    archived: false,
    OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
  };
}

export async function canAccessBoard(user: User, boardId: string) {
  if (user.role === "ADMIN") return true;
  const count = await prisma.board.count({
    where: { id: boardId, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
  });
  return count > 0;
}

export async function assertBoardAccess(user: User, boardId: string) {
  if (!(await canAccessBoard(user, boardId))) throw new Error("No tienes acceso a este tablero.");
}

export async function assertTaskAccess(user: User, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, boardId: true, title: true } });
  if (!task) throw new Error("La tarea no existe.");
  await assertBoardAccess(user, task.boardId);
  return task;
}

/** Puede editar la estructura del tablero (nombre, grupos, miembros). */
export async function canManageBoard(user: User, boardId: string) {
  if (user.role === "ADMIN") return true;
  const b = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  return b?.ownerId === user.id;
}

/**
 * Nivel de una persona en un tablero:
 * - manage: administrador o dueño (todo, incluido borrar y cambiar permisos)
 * - edit: miembro con permiso de Editor
 * - collab: miembro Colaborador (solo avanza las tareas que tiene asignadas)
 */
export type BoardLevel = "manage" | "edit" | "collab";

export async function boardLevel(user: User, boardId: string): Promise<BoardLevel | null> {
  if (user.role === "ADMIN") return "manage";
  const b = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, members: { where: { userId: user.id }, select: { role: true } } },
  });
  if (!b) return null;
  if (b.ownerId === user.id) return "manage";
  const m = b.members[0];
  if (!m) return null;
  return m.role === "EDITOR" ? "edit" : "collab";
}

export async function assertBoardEdit(user: User, boardId: string) {
  const level = await boardLevel(user, boardId);
  if (level !== "manage" && level !== "edit") throw new Error("No tienes permiso para editar este tablero. Pide al dueño que te haga Editor.");
}

export async function assertTaskEdit(user: User, taskId: string) {
  const task = await assertTaskAccess(user, taskId);
  await assertBoardEdit(user, task.boardId);
  return task;
}

/** ¿La persona es responsable de la tarea (o de la tarea madre, si es subtarea)? */
export async function isAssigned(userId: string, taskId: string) {
  const t = await prisma.task.findUnique({ where: { id: taskId }, select: { parentId: true } });
  const ids = [taskId, ...(t?.parentId ? [t.parentId] : [])];
  return (await prisma.taskAssignee.count({ where: { userId, taskId: { in: ids } } })) > 0;
}

/** Cambiar estado o registrar tiempo: editores, o colaboradores en sus propias tareas. */
export async function assertTaskProgress(user: User, taskId: string) {
  const task = await assertTaskAccess(user, taskId);
  const level = await boardLevel(user, task.boardId);
  if (level === "manage" || level === "edit") return task;
  if (await isAssigned(user.id, taskId)) return task;
  throw new Error("Solo puedes actualizar las tareas que tienes asignadas.");
}
