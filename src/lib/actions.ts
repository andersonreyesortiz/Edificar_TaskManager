"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Priority, Role, TaskStatus, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";
import { assertBoardAccess, assertTaskAccess, canManageBoard } from "@/lib/access";
import { BOARD_COLORS, priorityMeta, statusMeta } from "@/lib/constants";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

// ---------- utilidades ----------

async function log(user: User, action: string, detail: string, opts: { boardId?: string | null; taskId?: string | null }) {
  await prisma.activity.create({
    data: { userId: user.id, action, detail, boardId: opts.boardId ?? null, taskId: opts.taskId ?? null },
  });
}

function refresh(boardId?: string) {
  if (boardId) revalidatePath(`/boards/${boardId}`);
  revalidatePath("/", "layout");
}

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
  await trySignIn("resend", { email: str(formData.get("email")) });
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
  const count = await prisma.board.count();
  const board = await prisma.board.create({
    data: {
      name,
      description,
      color: BOARD_COLORS[count % BOARD_COLORS.length],
      ownerId: user.id,
      members: { create: { userId: user.id } },
      groups: {
        create: [
          { name: "Pendientes", color: "#6366f1", position: 0 },
          { name: "Esta semana", color: "#0ea5e9", position: 1 },
        ],
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

export async function addBoardMember(boardId: string, userId: string) {
  const user = await requireUser();
  if (!(await canManageBoard(user, boardId))) throw new Error("Solo el dueño del tablero puede agregar miembros.");
  const member = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId, userId } },
    create: { boardId, userId },
    update: {},
  });
  await log(user, "board.member_added", `agregó a ${member.name ?? member.email} al tablero`, { boardId });
  refresh(boardId);
}

export async function removeBoardMember(boardId: string, userId: string) {
  const user = await requireUser();
  if (!(await canManageBoard(user, boardId))) throw new Error("Solo el dueño del tablero puede quitar miembros.");
  const member = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.boardMember.deleteMany({ where: { boardId, userId } });
  await log(user, "board.member_removed", `quitó a ${member.name ?? member.email} del tablero`, { boardId });
  refresh(boardId);
}

// ---------- grupos ----------

export async function createGroup(boardId: string, name: string) {
  const user = await requireUser();
  await assertBoardAccess(user, boardId);
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
  await assertBoardAccess(user, g.boardId);
  await prisma.group.update({ where: { id: groupId }, data: { name } });
  refresh(g.boardId);
}

export async function deleteGroup(groupId: string) {
  const user = await requireUser();
  const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  if (!(await canManageBoard(user, g.boardId))) throw new Error("Solo el dueño del tablero puede borrar grupos.");
  await prisma.group.delete({ where: { id: groupId } });
  await log(user, "group.deleted", `borró el grupo «${g.name}» y sus tareas`, { boardId: g.boardId });
  refresh(g.boardId);
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
  await assertBoardAccess(user, data.boardId);
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
  const t = await assertTaskAccess(user, taskId);
  if (!title.trim() || title.trim() === t.title) return;
  await prisma.task.update({ where: { id: taskId }, data: { title: title.trim() } });
  await log(user, "task.renamed", `renombró «${t.title}» a «${title.trim()}»`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function updateTaskDescription(taskId: string, description: string) {
  const user = await requireUser();
  const t = await assertTaskAccess(user, taskId);
  await prisma.task.update({ where: { id: taskId }, data: { description: description.trim() || null } });
  await log(user, "task.description", `actualizó la descripción de «${t.title}»`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const user = await requireUser();
  const t = await assertTaskAccess(user, taskId);
  await prisma.task.update({
    where: { id: taskId },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  await log(user, "task.status", `cambió el estado de «${t.title}» a ${statusMeta(status).label}`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function updateTaskPriority(taskId: string, priority: Priority) {
  const user = await requireUser();
  const t = await assertTaskAccess(user, taskId);
  await prisma.task.update({ where: { id: taskId }, data: { priority } });
  await log(user, "task.priority", `cambió la prioridad de «${t.title}» a ${priorityMeta(priority).label}`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function updateTaskDates(taskId: string, field: "startDate" | "dueDate", value: string | null) {
  const user = await requireUser();
  const t = await assertTaskAccess(user, taskId);
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
  const t = await assertTaskAccess(user, taskId);
  const minutes = hours && hours > 0 ? Math.round(hours * 60) : null;
  await prisma.task.update({ where: { id: taskId }, data: { estimateMinutes: minutes } });
  await log(user, "task.estimate", minutes ? `estimó «${t.title}» en ${hours} h` : `quitó la estimación de «${t.title}»`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function moveTaskToGroup(taskId: string, groupId: string) {
  const user = await requireUser();
  const t = await assertTaskAccess(user, taskId);
  const g = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  if (g.boardId !== t.boardId) throw new Error("El grupo es de otro tablero.");
  await prisma.task.updateMany({ where: { OR: [{ id: taskId }, { parentId: taskId }] }, data: { groupId } });
  await log(user, "task.moved", `movió «${t.title}» al grupo «${g.name}»`, { boardId: t.boardId, taskId });
  refresh(t.boardId);
}

export async function setTaskAssignees(taskId: string, userIds: string[]) {
  const user = await requireUser();
  const t = await assertTaskAccess(user, taskId);
  const before = await prisma.taskAssignee.findMany({ where: { taskId }, select: { userId: true } });
  const beforeIds = new Set(before.map((b) => b.userId));
  const afterIds = new Set(userIds);
  const added = userIds.filter((id) => !beforeIds.has(id));
  const removed = [...beforeIds].filter((id) => !afterIds.has(id));
  if (!added.length && !removed.length) return;

  await prisma.$transaction([
    prisma.taskAssignee.deleteMany({ where: { taskId, userId: { in: removed } } }),
    prisma.taskAssignee.createMany({ data: added.map((userId) => ({ taskId, userId })), skipDuplicates: true }),
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
  refresh(t.boardId);
}

export async function deleteTask(taskId: string) {
  const user = await requireUser();
  const t = await assertTaskAccess(user, taskId);
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  await prisma.task.delete({ where: { id: taskId } });
  await log(user, "task.deleted", `borró ${task.parentId ? "la subtarea" : "la tarea"} «${t.title}»`, {
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
  const t = await assertTaskAccess(user, taskId);
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
  const t = await assertTaskAccess(user, data.taskId);
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
  if (admin.role === "GUEST") throw new Error("Los invitados no pueden invitar a otras personas.");
  const email = str(formData.get("email")).toLowerCase();
  const role = (str(formData.get("role")) || "GUEST") as Role;
  const boardId = str(formData.get("boardId")) || null;
  if (!z.string().email().safeParse(email).success) throw new Error("Correo no válido.");
  if (role === "ADMIN" && admin.role !== "ADMIN") throw new Error("Solo un administrador puede invitar administradores.");
  if (boardId) await assertBoardAccess(admin, boardId);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Ya tiene cuenta: solo se agrega al tablero.
    if (boardId) await addBoardMember(boardId, existing.id);
    revalidatePath("/team");
    return;
  }
  await prisma.invitation.upsert({
    where: { email },
    create: { email, role, boardId, invitedById: admin.id },
    update: { role, boardId, invitedById: admin.id, acceptedAt: null },
  });
  await log(admin, "team.invited", `invitó a ${email}`, { boardId });
  revalidatePath("/team");
}

export async function revokeInvitation(id: string) {
  await requireAdmin();
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

export async function updateProfileName(formData: FormData) {
  const user = await requireUser();
  const name = str(formData.get("name"));
  if (name) await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/", "layout");
}
