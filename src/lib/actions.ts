"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { BoardRole, ColumnType, Prisma, Priority, Role, TaskStatus, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";
import { adminDepartmentIds, assertManageMembers, canManagePeople, isSuperAdmin, assertBoardAccess, assertBoardEdit, assertTaskAccess, assertTaskEdit, assertTaskProgress, canManageBoard } from "@/lib/access";
import { BOARD_COLORS, priorityMeta, statusMeta } from "@/lib/constants";
import { AuthError } from "next-auth";
import { notify, sendInvitationEmail } from "@/lib/notify";
import { BUILTIN_COLUMNS, COLUMN_TYPES, asSettings, columnTypeLabel, defaultSettings, valueToText, type BuiltinKey, type ColumnSettings, type ColumnValue } from "@/lib/columns";
import { emailProviderId, signIn, signOut } from "@/auth";

// ---------- utilidades ----------

/**
 * Guarda una entrada en el historial de actividad. El historial no se puede editar ni borrar
 * (lo impide la base de datos), y guarda una copia del nombre del tablero y de la tarea.
 */
async function log(
  user: User,
  action: string,
  detail: string,
  opts: { boardId?: string | null; taskId?: string | null; boardName?: string; taskTitle?: string },
) {
  const boardId = opts.boardId ?? null;
  const taskId = opts.taskId ?? null;
  const [board, task] = await Promise.all([
    opts.boardName || !boardId ? null : prisma.board.findUnique({ where: { id: boardId }, select: { name: true } }),
    opts.taskTitle || !taskId ? null : prisma.task.findUnique({ where: { id: taskId }, select: { title: true } }),
  ]);
  await prisma.activity.create({
    data: {
      userId: user.id,
      action,
      detail,
      boardId,
      taskId,
      boardName: opts.boardName ?? board?.name ?? null,
      taskTitle: opts.taskTitle ?? task?.title ?? null,
    },
  });
}

function refresh(boardId?: string) {
  if (boardId) revalidatePath(`/boards/${boardId}`);
  revalidatePath("/", "layout");
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// ---------- sesión ----------

async function trySignIn(provider: string, options: Record<string, string>) {
  try {
    await signIn(provider, { ...options, redirectTo: "/" });
  } catch (e) {
    // signIn lanza un redirect cuando todo sale bien; solo atrapamos errores de acceso.
    if (e instanceof AuthError) {
      const code = e.type === "CredentialsSignin" || e.type === "AccessDenied" ? "AccessDenied" : e.type;
      redirect(`/login?error=${code}`);
    }
    throw e;
  }
}

export async function devSignIn(formData: FormData) {
  await trySignIn("dev", { email: str(formData.get("email")) });
}

export async function googleSignIn() {
  await trySignIn("google", {});
}

export async function emailSignIn(formData: FormData) {
  await trySignIn(emailProviderId, { email: str(formData.get("email")).toLowerCase() });
}

export async function doSignOut() {
  await signOut({ redirectTo: "/login" });
}

// ---------- tableros ----------

export async function createBoard(formData: FormData) {
  const user = await requireUser();
  if (user.role === "GUEST") throw new Error("Los invitados no pueden crear tableros.");
  const name = str(formData.get("name")) || "Nuevo tablero";
  const description = str(formData.get("description")) || null;
  let cols: { name: string; type: ColumnType }[] = [];
  try {
    const raw = JSON.parse(str(formData.get("columns")) || "[]");
    if (Array.isArray(raw)) {
      cols = raw
        .filter((c) => c && COLUMN_TYPES.some((t) => t.value === c.type))
        .slice(0, 30)
        .map((c) => ({ name: String(c.name ?? "").trim().slice(0, 60) || columnTypeLabel(c.type), type: c.type as ColumnType }));
    }
  } catch {
    cols = [];
  }
  const hidden = formData.getAll("hide").map(String).filter((k) => BUILTIN_COLUMNS.some((b) => b.key === k));
  // Departamento del tablero: uno de los de la persona (el superadministrador puede elegir cualquiera).
  const myDepts = isSuperAdmin(user)
    ? (await prisma.department.findMany({ select: { id: true } })).map((d) => d.id)
    : (await prisma.departmentMember.findMany({ where: { userId: user.id }, select: { departmentId: true } })).map((d) => d.departmentId);
  const askedDept = str(formData.get("departmentId"));
  const departmentId = askedDept && myDepts.includes(askedDept) ? askedDept : !askedDept && !isSuperAdmin(user) && myDepts.length === 1 ? myDepts[0] : null;
  const count = await prisma.board.count();
  const board = await prisma.board.create({
    data: {
      name,
      description,
      color: BOARD_COLORS[count % BOARD_COLORS.length],
      ownerId: user.id,
      departmentId,
      hiddenColumns: hidden,
      members: { create: { userId: user.id } },
      columns: {
        create: cols.map((c, position) => ({ name: c.name, type: c.type, position, settings: defaultSettings(c.type) as Prisma.InputJsonValue })),
      },
      groups: {
        create: [{ name: "Grupo1", color: "#00A0E3", position: 0 }],
      },
    },
  });
  await log(user, "board.created", `creó el tablero «${name}»`, { boardId: board.id });
  refresh();
  redirect(`/boards/${board.id}`);
}

export async function updateBoard(boardId: string, data: { name?: string; description?: string | null; color?: string }) {
  const user = await requireUser();
  if (!(await canManageBoard(user, boardId))) throw new Error("Solo el dueño del tablero puede editarlo.");
  await prisma.board.update({ where: { id: boardId }, data });
  if (data.name) await log(user, "board.renamed", `renombró el tablero a «${data.name}»`, { boardId });
  refresh(boardId);
}

export async function archiveBoard(boardId: string) {
  const user = await requireUser();
  if (!(await canManageBoard(user, boardId))) throw new Error("Solo el dueño del tablero puede archivarlo.");
  const b = await prisma.board.update({ where: { id: boardId }, data: { archived: true } });
  await log(user, "board.archived", `archivó el tablero «${b.name}»`, { boardId });
  refresh();
  redirect("/");
}

export async function addBoardMember(boardId: string, userId: string, role: BoardRole = "COLLABORATOR") {
  const user = await requireUser();
  await assertManageMembers(user, boardId);
  if (role !== "EDITOR" && role !== "COLLABORATOR") throw new Error("Permiso no válido.");
  const member = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId, userId } },
    create: { boardId, userId, role },
    update: { role },
  });
  await log(user, "board.member_added", `agregó a ${member.name ?? member.email} al tablero como ${role === "EDITOR" ? "Editor" : "Colaborador"}`, { boardId });
  const board = await prisma.board.findUniqueOrThrow({ where: { id: boardId }, select: { name: true } });
  await notify(user, [userId], {
    text: `te agregó al tablero «${board.name}»`,
    link: `/boards/${boardId}`,
    subject: `Te agregaron al tablero «${board.name}»`,
    cta: "Abrir tablero",
  });
  refresh(boardId);
}

export async function setBoardMemberRole(boardId: string, userId: string, role: BoardRole) {
  const user = await requireUser();
  await assertManageMembers(user, boardId);
  if (role !== "EDITOR" && role !== "COLLABORATOR") throw new Error("Permiso no válido.");
  const m = await prisma.boardMember.update({ where: { boardId_userId: { boardId, userId } }, data: { role }, include: { user: true } });
  await log(user, "board.member_role", `cambió el permiso de ${m.user.name ?? m.user.email} a ${role === "EDITOR" ? "Editor" : "Colaborador"}`, { boardId });
  refresh(boardId);
}

export async function setAutoGroupByStatus(boardId: string, on: boolean) {
  const user = await requireUser();
  if (!(await canManageBoard(user, boardId))) throw new Error("Solo el dueño del tablero puede cambiar esta opción.");
  await prisma.board.update({ where: { id: boardId }, data: { autoGroupByStatus: on } });
  if (on) {
    // Ordena de una vez las tareas que ya existen.
    const tasks = await prisma.task.findMany({ where: { boardId, parentId: null }, select: { id: true, status: true, groupId: true } });
    for (const t of tasks) await placeInStatusGroup(boardId, t);
  }
  await log(user, "board.autogroup", on ? "activó «organizar grupos por estado»" : "desactivó «organizar grupos por estado»", { boardId });
  refresh(boardId);
}

/** Mueve la tarea (y sus subtareas) al grupo con el nombre de su estado; lo crea si no existe. */
async function placeInStatusGroup(boardId: string, t: { id: string; status: TaskStatus; groupId: string | null }) {
  const meta = statusMeta(t.status);
  let group = await prisma.group.findFirst({ where: { boardId, name: { equals: meta.label, mode: "insensitive" } } });
  if (!group) {
    const last = await prisma.group.findFirst({ where: { boardId }, orderBy: { position: "desc" } });
    group = await prisma.group.create({ data: { boardId, name: meta.label, color: meta.color, position: (last?.position ?? -1) + 1 } });
  }
  if (group.id === t.groupId) return;
  const lastTask = await prisma.task.findFirst({ where: { groupId: group.id, parentId: null }, orderBy: { position: "desc" } });
  await prisma.task.update({ where: { id: t.id }, data: { groupId: group.id, position: (lastTask?.position ?? -1) + 1 } });
  await prisma.task.updateMany({ where: { parentId: t.id }, data: { groupId: group.id } });
}

export async function removeBoardMember(boardId: string, userId: string) {
  const user = await requireUser();
  await assertManageMembers(user, boardId);
  const member = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.boardMember.deleteMany({ where: { boardId, userId } });
  await log(user, "board.member_removed", `quitó a ${member.name ?? member.email} del tablero`, { boardId });
  refresh(boardId);
}

// ---------- grupos ----------

export async function createGroup(boardId: string, name: string) {
  const user = await requireUser();
  await assertBoardEdit(user, boardId);
  const last = await prisma.group.findFirst({ where: { boardId }, orderBy: { position: "desc" } });
  const colors = ["#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#ec4899", "#8b5cf6"];
  await prisma.group.create({
    data: { boardId, name: name || "Nuevo grupo", position: (last?.position ?? -1) + 1, color: colors[((last?.position ?? -1) + 1) % colors.length] },
  });
  await log(user, "group.created", `creó el grupo «${name}»`, { boardId });
  refresh(boardId);
}

export async function renameGroup(groupId: string, name: string) {
  const user = await requireUser();
  const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  await assertBoardEdit(user, g.boardId);
  await prisma.group.update({ where: { id: groupId }, data: { name } });
  refresh(g.boardId);
}

/**
 * Borra un grupo (dueño, editores y administradores). Si se indica `moveTo`, sus tareas pasan a ese grupo;
 * si no, se borran con el grupo. Siempre debe quedar al menos un grupo en el tablero.
 */
export async function deleteGroup(groupId: string, opts: { moveTo?: string | null } = {}) {
  const user = await requireUser();
  const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  await assertBoardEdit(user, g.boardId);
  const others = await prisma.group.count({ where: { boardId: g.boardId, id: { not: groupId } } });
  if (others === 0) throw new Error("El tablero debe tener al menos un grupo.");

  if (opts.moveTo) {
    const target = await prisma.group.findFirstOrThrow({ where: { id: opts.moveTo, boardId: g.boardId } });
    const last = await prisma.task.aggregate({ where: { groupId: target.id, parentId: null }, _max: { position: true } });
    const start = (last._max.position ?? -1) + 1;
    const moving = await prisma.task.findMany({ where: { groupId, parentId: null }, orderBy: { position: "asc" }, select: { id: true } });
    await prisma.$transaction([
      ...moving.map((t, i) => prisma.task.update({ where: { id: t.id }, data: { groupId: target.id, position: start + i } })),
      prisma.task.updateMany({ where: { groupId }, data: { groupId: target.id } }), // subtareas
      prisma.group.delete({ where: { id: groupId } }),
    ]);
    await log(user, "group.deleted", `borró el grupo «${g.name}» y movió sus ${moving.length} tareas a «${target.name}»`, { boardId: g.boardId });
    refresh(g.boardId);
    return;
  }

  const [tasks, time] = await Promise.all([
    prisma.task.count({ where: { groupId, parentId: null } }),
    prisma.timeEntry.aggregate({ where: { task: { OR: [{ groupId }, { parent: { groupId } }] } }, _sum: { minutes: true }, _count: true }),
  ]);
  await prisma.group.delete({ where: { id: groupId } });
  const extra = time._count ? `, con ${time._count} registros de tiempo (${time._sum.minutes ?? 0} min)` : "";
  await log(user, "group.deleted", `borró el grupo «${g.name}» y sus ${tasks} tareas${extra}`, { boardId: g.boardId });
  refresh(g.boardId);
}

// ---------- columnas personalizadas ----------

async function columnWithAccess(user: User, columnId: string) {
  const col = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  await assertBoardEdit(user, col.boardId);
  return col;
}

export async function createColumn(boardId: string, name: string, type: ColumnType) {
  const user = await requireUser();
  await assertBoardEdit(user, boardId);
  if (!COLUMN_TYPES.some((t) => t.value === type)) throw new Error("Tipo de columna no válido.");
  const clean = name.trim().slice(0, 60) || columnTypeLabel(type);
  const last = await prisma.boardColumn.findFirst({ where: { boardId }, orderBy: { position: "desc" } });
  await prisma.boardColumn.create({
    data: { boardId, name: clean, type, position: (last?.position ?? -1) + 1, settings: defaultSettings(type) as Prisma.InputJsonValue },
  });
  await log(user, "column.created", `agregó la columna «${clean}» (${columnTypeLabel(type)})`, { boardId });
  refresh(boardId);
}

export async function updateColumn(columnId: string, data: { name?: string; settings?: ColumnSettings }) {
  const user = await requireUser();
  const col = await columnWithAccess(user, columnId);
  const name = data.name?.trim().slice(0, 60);
  await prisma.boardColumn.update({
    where: { id: columnId },
    data: {
      ...(name ? { name } : {}),
      ...(data.settings ? { settings: { ...asSettings(col.settings), ...asSettings(data.settings) } as Prisma.InputJsonValue } : {}),
    },
  });
  if (name && name !== col.name) await log(user, "column.renamed", `renombró la columna «${col.name}» a «${name}»`, { boardId: col.boardId });
  refresh(col.boardId);
}

export async function moveColumn(columnId: string, dir: -1 | 1) {
  const user = await requireUser();
  const col = await columnWithAccess(user, columnId);
  const cols = await prisma.boardColumn.findMany({ where: { boardId: col.boardId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = cols.findIndex((c) => c.id === columnId);
  const j = i + dir;
  if (j < 0 || j >= cols.length) return;
  [cols[i], cols[j]] = [cols[j], cols[i]];
  await prisma.$transaction(cols.map((c, position) => prisma.boardColumn.update({ where: { id: c.id }, data: { position } })));
  refresh(col.boardId);
}

/** Guarda el orden y el ancho de las columnas de la tabla del tablero. */
export async function setColumnLayout(boardId: string, layout: { order?: string[]; widths?: Record<string, number> }) {
  const user = await requireUser();
  await assertBoardEdit(user, boardId);
  const data: Prisma.BoardUpdateInput = {};
  if (layout.order) data.columnOrder = layout.order.map(String).slice(0, 100);
  if (layout.widths) {
    const widths: Record<string, number> = {};
    for (const [k, v] of Object.entries(layout.widths).slice(0, 100)) {
      const n = Math.round(Number(v));
      if (Number.isFinite(n)) widths[String(k)] = Math.min(800, Math.max(60, n));
    }
    data.columnWidths = widths;
  }
  await prisma.board.update({ where: { id: boardId }, data });
  refresh(boardId);
}

export async function deleteColumn(columnId: string) {
  const user = await requireUser();
  const col = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  if (!(await canManageBoard(user, col.boardId))) throw new Error("Solo el dueño del tablero puede borrar columnas.");
  await prisma.boardColumn.delete({ where: { id: columnId } });
  await log(user, "column.deleted", `borró la columna «${col.name}»`, { boardId: col.boardId });
  refresh(col.boardId);
}

export async function setBuiltinColumnHidden(boardId: string, key: BuiltinKey, hidden: boolean) {
  const user = await requireUser();
  if (!(await canManageBoard(user, boardId))) throw new Error("Solo el dueño del tablero puede ocultar columnas.");
  if (!BUILTIN_COLUMNS.some((c) => c.key === key)) throw new Error("Columna no válida.");
  const b = await prisma.board.findUniqueOrThrow({ where: { id: boardId }, select: { hiddenColumns: true } });
  const set = new Set(b.hiddenColumns);
  if (hidden) set.add(key);
  else set.delete(key);
  await prisma.board.update({ where: { id: boardId }, data: { hiddenColumns: [...set] } });
  refresh(boardId);
}

function cleanValue(type: ColumnType, settings: ColumnSettings, v: unknown): ColumnValue {
  if (v === null || v === undefined || v === "") return null;
  const ids = new Set((settings.labels ?? []).map((l) => l.id));
  switch (type) {
    case "TEXT":
    case "LINK":
    case "EMAIL":
    case "PHONE":
      return String(v).trim().slice(0, 2000) || null;
    case "NUMBER": {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "RATING": {
      const n = Math.round(Number(v));
      return n >= 1 && n <= 5 ? n : null;
    }
    case "CHECKBOX":
      return v === true ? true : null;
    case "DATE":
      return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null;
    case "STATUS":
      return ids.has(String(v)) ? String(v) : null;
    case "DROPDOWN": {
      const arr = (Array.isArray(v) ? v : []).map(String).filter((x) => ids.has(x));
      return arr.length ? [...new Set(arr)] : null;
    }
    case "PEOPLE": {
      const arr = (Array.isArray(v) ? v : []).map(String);
      return arr.length ? [...new Set(arr)] : null;
    }
  }
}

export async function setColumnValue(taskId: string, columnId: string, raw: ColumnValue) {
  const user = await requireUser();
  const t = await assertTaskEdit(user, taskId);
  const col = await prisma.boardColumn.findUniqueOrThrow({ where: { id: columnId } });
  if (col.boardId !== t.boardId) throw new Error("La columna no es de este tablero.");
  const settings = asSettings(col.settings);
  const value = cleanValue(col.type, settings, raw);
  if (value === null) {
    await prisma.taskColumnValue.deleteMany({ where: { taskId, columnId } });
  } else {
    await prisma.taskColumnValue.upsert({
      where: { taskId_columnId: { taskId, columnId } },
      create: { taskId, columnId, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
  }
  const def = { id: col.id, name: col.name, type: col.type, position: col.position, settings };
  const people = col.type === "PEOPLE" && Array.isArray(value)
    ? await prisma.user.findMany({ where: { id: { in: value } }, select: { id: true, name: true, email: true } })
    : [];
  const text = valueToText(def, value, people);
  await log(user, "task.column", text ? `cambió «${col.name}» de «${t.title}» a ${text}` : `vació «${col.name}» en «${t.title}»`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

// ---------- tareas ----------

const taskInput = z.object({
  boardId: z.string(),
  groupId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  title: z.string().min(1).max(300),
});

export async function createTask(input: z.infer<typeof taskInput>) {
  const user = await requireUser();
  const data = taskInput.parse(input);
  await assertBoardEdit(user, data.boardId);
  let groupId = data.groupId ?? null;
  if (data.parentId) {
    const parent = await prisma.task.findUniqueOrThrow({ where: { id: data.parentId } });
    if (parent.boardId !== data.boardId) throw new Error("La subtarea debe estar en el mismo tablero.");
    groupId = parent.groupId;
  }
  const last = await prisma.task.findFirst({
    where: { boardId: data.boardId, groupId, parentId: data.parentId ?? null },
    orderBy: { position: "desc" },
  });
  const task = await prisma.task.create({
    data: {
      boardId: data.boardId,
      groupId,
      parentId: data.parentId ?? null,
      title: data.title,
      createdById: user.id,
      position: (last?.position ?? -1) + 1,
    },
  });
  await log(
    user,
    data.parentId ? "subtask.created" : "task.created",
    data.parentId ? `agregó la subtarea «${task.title}»` : `creó la tarea «${task.title}»`,
    { boardId: data.boardId, taskId: data.parentId ?? task.id },
  );
  refresh(data.boardId);
  return task.id;
}

export async function updateTaskTitle(taskId: string, title: string) {
  const user = await requireUser();
  const t = await assertTaskEdit(user, taskId);
  if (!title.trim() || title.trim() === t.title) return;
  await prisma.task.update({ where: { id: taskId }, data: { title: title.trim() } });
  await log(user, "task.renamed", `renombró «${t.title}» a «${title.trim()}»`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function updateTaskDescription(taskId: string, description: string) {
  const user = await requireUser();
  const t = await assertTaskEdit(user, taskId);
  await prisma.task.update({ where: { id: taskId }, data: { description: description.trim() || null } });
  await log(user, "task.description", `actualizó la descripción de «${t.title}»`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const user = await requireUser();
  const t = await assertTaskProgress(user, taskId);
  const before = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      status: true,
      groupId: true,
      parentId: true,
      createdById: true,
      parent: { select: { title: true } },
      board: { select: { name: true, autoGroupByStatus: true } },
      assignees: { select: { assignedById: true } },
    },
  });
  if (before.status === status) return;
  await prisma.task.update({
    where: { id: taskId },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  await log(user, "task.status", `cambió el estado de «${t.title}» a ${statusMeta(status).label}`, { boardId: t.boardId, taskId });
  if (before.board.autoGroupByStatus && !before.parentId) {
    await placeInStatusGroup(t.boardId, { id: taskId, status, groupId: before.groupId });
  }
  if (status === "DONE") {
    // Avisar a quien asignó la tarea (o a quien la creó, si no hay registro de la asignación).
    const assigners = before.assignees.map((a) => a.assignedById).filter((x): x is string => !!x);
    const recipients = assigners.length ? assigners : [before.createdById];
    const title = before.parent ? `${t.title} (subtarea de «${before.parent.title}»)` : t.title;
    await notify(user, recipients, {
      text: `terminó la tarea «${title}»`,
      link: `/boards/${t.boardId}?task=${taskId}`,
      subject: `Tarea terminada: ${t.title}`,
      detailHtml: `<p>Tablero: <b>${escapeHtml(before.board.name)}</b></p>`,
      cta: "Ver tarea",
    });
  }
  refresh(t.boardId);
}

export async function updateTaskPriority(taskId: string, priority: Priority) {
  const user = await requireUser();
  const t = await assertTaskEdit(user, taskId);
  await prisma.task.update({ where: { id: taskId }, data: { priority } });
  await log(user, "task.priority", `cambió la prioridad de «${t.title}» a ${priorityMeta(priority).label}`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function updateTaskDates(taskId: string, field: "startDate" | "dueDate", value: string | null) {
  const user = await requireUser();
  const t = await assertTaskEdit(user, taskId);
  const date = value ? new Date(`${value}T12:00:00`) : null;
  await prisma.task.update({ where: { id: taskId }, data: { [field]: date } });
  const label = field === "dueDate" ? "la fecha límite" : "la fecha de inicio";
  await log(
    user,
    `task.${field}`,
    value ? `puso ${label} de «${t.title}» el ${value.split("-").reverse().join("/")}` : `quitó ${label} de «${t.title}»`,
    { boardId: t.boardId, taskId },
  );
  refresh(t.boardId);
}

export async function updateTaskEstimate(taskId: string, hours: number | null) {
  const user = await requireUser();
  const t = await assertTaskEdit(user, taskId);
  const minutes = hours && hours > 0 ? Math.round(hours * 60) : null;
  await prisma.task.update({ where: { id: taskId }, data: { estimateMinutes: minutes } });
  await log(user, "task.estimate", minutes ? `estimó «${t.title}» en ${hours} h` : `quitó la estimación de «${t.title}»`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function moveTaskToGroup(taskId: string, groupId: string) {
  const user = await requireUser();
  const t = await assertTaskEdit(user, taskId);
  const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  if (g.boardId !== t.boardId) throw new Error("El grupo es de otro tablero.");
  await prisma.task.updateMany({ where: { OR: [{ id: taskId }, { parentId: taskId }] }, data: { groupId } });
  await log(user, "task.moved", `movió «${t.title}» al grupo «${g.name}»`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function setTaskAssignees(taskId: string, userIds: string[]) {
  const user = await requireUser();
  const t = await assertTaskEdit(user, taskId);
  const before = await prisma.taskAssignee.findMany({ where: { taskId }, select: { userId: true } });
  const beforeIds = new Set(before.map((b) => b.userId));
  const afterIds = new Set(userIds);
  const added = userIds.filter((id) => !beforeIds.has(id));
  const removed = [...beforeIds].filter((id) => !afterIds.has(id));
  if (!added.length && !removed.length) return;
  if (added.length && user.role !== "ADMIN") {
    // Solo los administradores pueden sumar gente nueva al tablero; los demás asignan entre los miembros.
    const board = await prisma.board.findUniqueOrThrow({ where: { id: t.boardId }, select: { ownerId: true, members: { select: { userId: true } } } });
    const allowed = new Set([board.ownerId, ...board.members.map((m) => m.userId)]);
    if (added.some((id) => !allowed.has(id))) throw new Error("Solo puedes asignar a miembros del tablero. Pide a un administrador que agregue a la persona.");
  }

  await prisma.$transaction([
    prisma.taskAssignee.deleteMany({ where: { taskId, userId: { in: removed } } }),
    prisma.taskAssignee.createMany({ data: added.map((userId) => ({ taskId, userId, assignedById: user.id })), skipDuplicates: true }),
    // Quien es responsable de una tarea debe poder ver el tablero.
    prisma.boardMember.createMany({ data: added.map((userId) => ({ boardId: t.boardId, userId })), skipDuplicates: true }),
  ]);
  const people = await prisma.user.findMany({ where: { id: { in: [...added, ...removed] } } });
  const name = (id: string) => {
    const p = people.find((x) => x.id === id);
    return p?.name ?? p?.email ?? "alguien";
  };
  for (const id of added) await log(user, "task.assigned", `asignó a ${name(id)} en «${t.title}»`, { boardId: t.boardId, taskId });
  for (const id of removed) await log(user, "task.unassigned", `quitó a ${name(id)} de «${t.title}»`, { boardId: t.boardId, taskId });
  if (added.length) {
    const info = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: { dueDate: true, board: { select: { name: true } } },
    });
    const due = info.dueDate ? info.dueDate.toLocaleDateString("es", { day: "numeric", month: "long", timeZone: "UTC" }) : null;
    await notify(user, added, {
      text: `te asignó la tarea «${t.title}»`,
      link: `/boards/${t.boardId}?task=${taskId}`,
      subject: `Nueva tarea asignada: ${t.title}`,
      detailHtml: `<p>Tablero: <b>${escapeHtml(info.board.name)}</b>${due ? `<br>Fecha límite: <b>${due}</b>` : ""}</p>`,
      cta: "Ver tarea",
    });
  }
  refresh(t.boardId);
}

export async function deleteTask(taskId: string) {
  const user = await requireUser();
  const t = await assertTaskEdit(user, taskId);
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  // Deja constancia del tiempo registrado que se pierde con la tarea (incluye subtareas).
  const time = await prisma.timeEntry.aggregate({
    where: { OR: [{ taskId }, { task: { parentId: taskId } }] },
    _sum: { minutes: true },
    _count: true,
  });
  await prisma.task.delete({ where: { id: taskId } });
  const mins = time._sum.minutes ?? 0;
  const extra = time._count ? ` (tenía ${time._count} registro${time._count === 1 ? "" : "s"} de tiempo, ${mins} min en total)` : "";
  await log(user, "task.deleted", `borró ${task.parentId ? "la subtarea" : "la tarea"} «${t.title}»${extra}`, {
    boardId: t.boardId,
    taskId: task.parentId,
  });
  refresh(t.boardId);
}

// ---------- comentarios ----------

export async function addComment(taskId: string, body: string) {
  const user = await requireUser();
  const t = await assertTaskAccess(user, taskId);
  if (!body.trim()) return;
  await prisma.comment.create({ data: { taskId, userId: user.id, body: body.trim() } });
  await log(user, "task.comment", `comentó en «${t.title}»`, { boardId: t.boardId, taskId });
  const people = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { createdById: true, assignees: { select: { userId: true } } },
  });
  await notify(user, [people.createdById, ...people.assignees.map((a) => a.userId)], {
    text: `comentó en «${t.title}»`,
    link: `/boards/${t.boardId}?task=${taskId}`,
    subject: `Nuevo comentario en «${t.title}»`,
    detailHtml: `<p style="background:#f6f5f1;padding:10px 12px;border-radius:8px">${escapeHtml(body.trim()).replace(/\n/g, "<br>")}</p>`,
    cta: "Responder",
  });
  refresh(t.boardId);
}

// ---------- tiempos ----------

async function stopRunning(user: User) {
  const running = await prisma.timeEntry.findMany({ where: { userId: user.id, endedAt: null }, include: { task: true } });
  const now = new Date();
  for (const r of running) {
    const minutes = Math.max(1, Math.round((now.getTime() - r.startedAt.getTime()) / 60000));
    await prisma.timeEntry.update({ where: { id: r.id }, data: { endedAt: now, minutes } });
    await log(user, "time.stopped", `registró ${minutes} min en «${r.task.title}» con el cronómetro`, {
      boardId: r.task.boardId,
      taskId: r.taskId,
    });
  }
  return running;
}

export async function startTimer(taskId: string) {
  const user = await requireUser();
  const t = await assertTaskProgress(user, taskId);
  const stopped = await stopRunning(user);
  await prisma.timeEntry.create({ data: { taskId, userId: user.id, startedAt: new Date() } });
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (task.status === "TODO") {
    await prisma.task.update({ where: { id: taskId }, data: { status: "IN_PROGRESS" } });
    await log(user, "task.status", `cambió el estado de «${t.title}» a En curso`, { boardId: t.boardId, taskId });
  }
  await log(user, "time.started", `inició el cronómetro en «${t.title}»`, { boardId: t.boardId, taskId });
  for (const s of stopped) refresh(s.task.boardId);
  refresh(t.boardId);
}

export async function stopTimer() {
  const user = await requireUser();
  const stopped = await stopRunning(user);
  for (const s of stopped) refresh(s.task.boardId);
  refresh();
}

const manualEntry = z.object({
  taskId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0).max(24),
  minutes: z.number().min(0).max(59),
  note: z.string().max(500).optional(),
});

export async function addTimeEntry(input: z.infer<typeof manualEntry>) {
  const user = await requireUser();
  const data = manualEntry.parse(input);
  const t = await assertTaskProgress(user, data.taskId);
  const total = Math.round(data.hours * 60 + data.minutes);
  if (total <= 0) throw new Error("Escribe un tiempo mayor que cero.");
  const startedAt = new Date(`${data.date}T09:00:00`);
  await prisma.timeEntry.create({
    data: {
      taskId: data.taskId,
      userId: user.id,
      startedAt,
      endedAt: new Date(startedAt.getTime() + total * 60000),
      minutes: total,
      note: data.note?.trim() || null,
    },
  });
  await log(user, "time.manual", `registró ${total} min en «${t.title}»`, { boardId: t.boardId, taskId: data.taskId });
  refresh(t.boardId);
}

export async function deleteTimeEntry(entryId: string) {
  const user = await requireUser();
  const entry = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId }, include: { task: true } });
  if (entry.userId !== user.id && user.role !== "ADMIN") throw new Error("Solo puedes borrar tus propios registros.");
  await prisma.timeEntry.delete({ where: { id: entryId } });
  await log(user, "time.deleted", `borró un registro de ${entry.minutes} min en «${entry.task.title}»`, {
    boardId: entry.task.boardId,
    taskId: entry.taskId,
  });
  refresh(entry.task.boardId);
}

// ---------- equipo e invitaciones ----------

export async function inviteUser(formData: FormData) {
  const admin = await requireUser();
  if (!(await canManagePeople(admin))) throw new Error("Solo un administrador puede invitar personas.");
  const email = str(formData.get("email")).toLowerCase();
  const role = (str(formData.get("role")) || "GUEST") as Role;
  const boardId = str(formData.get("boardId")) || null;
  const departmentId = str(formData.get("departmentId")) || null;
  if (!z.string().email().safeParse(email).success) throw new Error("Correo no válido.");
  if (role === "ADMIN" && !isSuperAdmin(admin)) throw new Error("Solo el superadministrador puede invitar administradores.");
  if (boardId) await assertManageMembers(admin, boardId);
  if (departmentId && !(await adminDepartmentIds(admin)).includes(departmentId)) throw new Error("Solo puedes invitar a departamentos que administras.");
  if (!isSuperAdmin(admin) && !departmentId && !boardId) throw new Error("Elige el departamento o el tablero al que invitas a la persona.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Ya tiene cuenta: se agrega al departamento y al tablero.
    if (departmentId) {
      await prisma.departmentMember.upsert({
        where: { departmentId_userId: { departmentId, userId: existing.id } },
        create: { departmentId, userId: existing.id },
        update: {},
      });
    }
    if (boardId) await addBoardMember(boardId, existing.id);
    revalidatePath("/team");
    return { emailed: false, existing: true };
  }
  await prisma.invitation.upsert({
    where: { email },
    create: { email, role, boardId, departmentId, invitedById: admin.id },
    update: { role, boardId, departmentId, invitedById: admin.id, acceptedAt: null },
  });
  await log(admin, "team.invited", `invitó a ${email}`, { boardId });
  const board = boardId ? await prisma.board.findUnique({ where: { id: boardId }, select: { name: true } }) : null;
  const sent = await sendInvitationEmail(admin, email, board?.name);
  revalidatePath("/team");
  return { emailed: sent };
}

export async function revokeInvitation(id: string) {
  const user = await requireUser();
  const inv = await prisma.invitation.findUniqueOrThrow({ where: { id } });
  const allowed =
    isSuperAdmin(user) ||
    inv.invitedById === user.id ||
    (!!inv.departmentId && (await adminDepartmentIds(user)).includes(inv.departmentId));
  if (!allowed) throw new Error("No puedes anular esta invitación.");
  await prisma.invitation.delete({ where: { id } });
  revalidatePath("/team");
}

export async function setUserRole(userId: string, role: Role) {
  const admin = await requireAdmin();
  if (userId === admin.id && role !== "ADMIN") throw new Error("No puedes quitarte el rol de administrador.");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/team");
}

export async function setUserActive(userId: string, active: boolean) {
  const admin = await requireAdmin();
  if (userId === admin.id) throw new Error("No puedes desactivarte a ti mismo.");
  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/team");
}

// ---------- departamentos ----------

export async function createDepartment(formData: FormData) {
  const admin = await requireAdmin();
  const name = str(formData.get("name")).slice(0, 80);
  if (!name) throw new Error("Escribe el nombre del departamento.");
  if (await prisma.department.findUnique({ where: { name } })) throw new Error("Ya existe un departamento con ese nombre.");
  await prisma.department.create({ data: { name } });
  await log(admin, "department.created", `creó el departamento «${name}»`, {});
  revalidatePath("/team");
}

export async function renameDepartment(id: string, name: string) {
  const admin = await requireAdmin();
  const n = name.trim().slice(0, 80);
  if (!n) return;
  const d = await prisma.department.update({ where: { id }, data: { name: n } });
  await log(admin, "department.renamed", `renombró un departamento a «${d.name}»`, {});
  revalidatePath("/team");
}

export async function deleteDepartment(id: string) {
  const admin = await requireAdmin();
  const d = await prisma.department.findUniqueOrThrow({ where: { id }, include: { _count: { select: { boards: true } } } });
  if (d._count.boards) throw new Error("El departamento tiene tableros. Muévelos a otro departamento antes de eliminarlo.");
  await prisma.department.delete({ where: { id } });
  await log(admin, "department.deleted", `eliminó el departamento «${d.name}»`, {});
  revalidatePath("/team");
}

/**
 * Agrega o quita a una persona de un departamento, o cambia si lo administra.
 * Superadministrador: todo. Administrador del departamento: agrega o quita miembros (no nombra administradores).
 */
export async function setDepartmentMember(departmentId: string, userId: string, state: "none" | "member" | "admin") {
  const user = await requireUser();
  const mine = await adminDepartmentIds(user);
  if (!mine.includes(departmentId)) throw new Error("Solo puedes cambiar los miembros de los departamentos que administras.");
  const current = await prisma.departmentMember.findUnique({ where: { departmentId_userId: { departmentId, userId } } });
  if (!isSuperAdmin(user) && (state === "admin" || current?.isAdmin)) throw new Error("Solo el superadministrador nombra o quita administradores de departamento.");
  const [dept, person] = await Promise.all([
    prisma.department.findUniqueOrThrow({ where: { id: departmentId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);
  const who = person.name ?? person.email;
  if (state === "none") {
    await prisma.departmentMember.deleteMany({ where: { departmentId, userId } });
    await log(user, "department.member_removed", `quitó a ${who} del departamento «${dept.name}»`, {});
  } else {
    await prisma.departmentMember.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      create: { departmentId, userId, isAdmin: state === "admin" },
      update: { isAdmin: state === "admin" },
    });
    await log(user, "department.member_set", `puso a ${who} como ${state === "admin" ? "administrador" : "miembro"} del departamento «${dept.name}»`, {});
  }
  revalidatePath("/team");
  revalidatePath("/", "layout");
}

/** Cambia el departamento de un tablero (superadministrador, o quien administra el tablero y el departamento destino). */
export async function setBoardDepartment(boardId: string, departmentId: string | null) {
  const user = await requireUser();
  if (!isSuperAdmin(user)) {
    if (!(await canManageBoard(user, boardId))) throw new Error("No puedes cambiar el departamento de este tablero.");
    if (!departmentId || !(await adminDepartmentIds(user)).includes(departmentId)) throw new Error("Solo puedes mover el tablero a un departamento que administras.");
  }
  const dept = departmentId ? await prisma.department.findUniqueOrThrow({ where: { id: departmentId } }) : null;
  await prisma.board.update({ where: { id: boardId }, data: { departmentId } });
  await log(user, "board.department", dept ? `asignó el tablero al departamento «${dept.name}»` : "quitó el departamento del tablero", { boardId });
  refresh(boardId);
}

export async function updateProfileName(formData: FormData) {
  const user = await requireUser();
  const name = str(formData.get("name"));
  if (name) await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/", "layout");
}

// ---------- notificaciones ----------

export async function markNotificationsRead(ids?: string[]) {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
