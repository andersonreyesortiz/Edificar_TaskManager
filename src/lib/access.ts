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
