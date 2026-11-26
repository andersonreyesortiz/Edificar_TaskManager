import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Reglas de privacidad:
 * - Superadministrador (rol ADMIN): ve y gestiona todo.
 * - Administrador de departamento (DepartmentMember.isAdmin; una persona puede estar en varios departamentos):
 *   ve y gestiona los tableros de los departamentos que administra, invita personas y maneja sus miembros.
 * - Todos los demás: solo ven los tableros donde son dueños o miembros.
 */
export const isSuperAdmin = (user: Pick<User, "role">) => user.role === "ADMIN";
/** Departamentos que la persona administra (filtro reutilizable). */
const adminOfDept = (user: User): Prisma.DepartmentWhereInput => ({ members: { some: { userId: user.id, isAdmin: true } } });

/** ¿Administra al menos un departamento? */
export async function isDeptAdmin(user: User) {
  return (await prisma.departmentMember.count({ where: { userId: user.id, isAdmin: true } })) > 0;
}

/** Ids de los departamentos que administra. */
export async function adminDepartmentIds(user: User) {
  if (isSuperAdmin(user)) return (await prisma.department.findMany({ select: { id: true } })).map((d) => d.id);
  return (await prisma.departmentMember.findMany({ where: { userId: user.id, isAdmin: true }, select: { departmentId: true } })).map((d) => d.departmentId);
}

/** Puede invitar personas y gestionar miembros (en su alcance). */
export async function canManagePeople(user: User) {
  return isSuperAdmin(user) || (await isDeptAdmin(user));
}

/** Filtro de tableros visibles para una persona. */
export function visibleBoardsWhere(user: User): Prisma.BoardWhereInput {
  if (isSuperAdmin(user)) return { archived: false };
  return {
    archived: false,
    OR: [
      { ownerId: user.id },
      { members: { some: { userId: user.id } } },
      { department: adminOfDept(user) },
    ],
  };
}

/** Tableros que entran en el Resumen ejecutivo: los que la persona administra o edita. */
export function dashboardBoardsWhere(user: User): Prisma.BoardWhereInput {
  if (isSuperAdmin(user)) return { archived: false };
  return {
    archived: false,
    OR: [
      { ownerId: user.id },
      { members: { some: { userId: user.id, role: "EDITOR" } } },
      { department: adminOfDept(user) },
    ],
  };
}

export async function canSeeDashboard(user: User) {
  if (isSuperAdmin(user)) return true;
  return (await prisma.board.count({ where: dashboardBoardsWhere(user) })) > 0;
}

/** Personas que alguien puede ver: las que comparten algún tablero con ella (y las de su departamento si lo administra). */
export function visiblePeopleWhere(user: User): Prisma.UserWhereInput {
  if (isSuperAdmin(user)) return {};
  const boards = visibleBoardsWhere(user);
  return {
    OR: [
      { id: user.id },
      { boardMembers: { some: { board: boards } } },
      { boardsOwned: { some: boards } },
      { departments: { some: { department: adminOfDept(user) } } },
    ],
  };
}

export async function canAccessBoard(user: User, boardId: string) {
  if (isSuperAdmin(user)) return true;
  const { archived: _a, ...where } = visibleBoardsWhere(user);
  return (await prisma.board.count({ where: { id: boardId, ...where } })) > 0;
}

/** Puede agregar, quitar o cambiar el permiso de los miembros de un tablero. */
export async function canManageMembers(user: User, boardId: string) {
  if (isSuperAdmin(user)) return true;
  return (await prisma.board.count({ where: { id: boardId, department: adminOfDept(user) } })) > 0;
}

export async function assertManageMembers(user: User, boardId: string) {
  if (!(await canManageMembers(user, boardId)))
    throw new Error("Solo un administrador (o el administrador del departamento del tablero) puede gestionar miembros.");
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
  return (await boardLevel(user, boardId)) === "manage";
}

/**
 * Nivel de una persona en un tablero:
 * - manage: superadministrador, dueño o administrador del departamento del tablero
 * - edit: miembro con permiso de Editor
 * - collab: miembro Colaborador (solo avanza las tareas que tiene asignadas)
 */
export type BoardLevel = "manage" | "edit" | "collab";

export async function boardLevel(user: User, boardId: string): Promise<BoardLevel | null> {
  if (isSuperAdmin(user)) return "manage";
  const b = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      ownerId: true,
      members: { where: { userId: user.id }, select: { role: true } },
      department: { select: { members: { where: { userId: user.id, isAdmin: true }, select: { userId: true } } } },
    },
  });
  if (!b) return null;
  if (b.ownerId === user.id) return "manage";
  if (b.department?.members.length) return "manage";
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

/** Departamentos en los que la persona puede crear tableros: todos (superadmin) o aquellos a los que pertenece. */
export async function boardDepartmentChoices(user: User) {
  return prisma.department.findMany({
    where: isSuperAdmin(user) ? {} : { members: { some: { userId: user.id } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
