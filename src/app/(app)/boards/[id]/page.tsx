import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { adminDepartmentIds, boardLevel, canAccessBoard, canManageMembers, isSuperAdmin } from "@/lib/access";
import { BoardView } from "@/components/board/BoardView";
import { BoardHeader } from "@/components/board/BoardHeader";
import { TaskPanel } from "@/components/task/TaskPanel";
import type { BoardTask, Person } from "@/components/board/types";
import { asSettings, type BoardColumnDef, type BuiltinKey, type ColumnValue } from "@/lib/columns";

const personSelect = { id: true, name: true, email: true, image: true } as const;

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; task?: string }>;
}) {
  const { id } = await params;
  const { view, task: openTaskId } = await searchParams;
  const user = await requireUser();
  if (!(await canAccessBoard(user, id))) notFound();

  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      owner: { select: personSelect },
      members: { include: { user: { select: personSelect } }, orderBy: { addedAt: "asc" } },
      groups: { orderBy: { position: "asc" } },
      columns: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      department: { select: { id: true, name: true } },
    },
  });
  if (!board || board.archived) notFound();

  const manageMembers = await canManageMembers(user, id);
  const [rawTasks, subtasks, timeByTask, running, allUsers, deptOptions] = await Promise.all([
    prisma.task.findMany({
      where: { boardId: id, parentId: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { assignees: { include: { user: { select: personSelect } } }, values: { select: { columnId: true, value: true } } },
    }),
    prisma.task.findMany({
      where: { boardId: id, parentId: { not: null } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { assignees: { include: { user: { select: personSelect } } }, values: { select: { columnId: true, value: true } } },
    }),
    prisma.timeEntry.groupBy({ by: ["taskId"], where: { task: { boardId: id } }, _sum: { minutes: true } }),
    prisma.timeEntry.findMany({ where: { userId: user.id, endedAt: null }, select: { taskId: true } }),
    // La lista de personas para agregar solo la reciben quienes pueden gestionar miembros.
    manageMembers ? prisma.user.findMany({ where: { active: true }, select: personSelect, orderBy: { name: "asc" } }) : Promise.resolve([]),
    adminDepartmentIds(user).then((ids) =>
      prisma.department.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ),
  ]);

  const minutesOf = new Map(timeByTask.map((t) => [t.taskId, t._sum.minutes ?? 0]));
  const runningIds = new Set(running.map((r) => r.taskId));

  const toSubtask = (s: (typeof subtasks)[number], parentMine: boolean): BoardTask => ({
    id: s.id,
    title: s.title,
    status: s.status,
    priority: s.priority,
    dueDate: s.dueDate,
    groupId: s.groupId,
    estimateMinutes: s.estimateMinutes,
    assignees: s.assignees.map((a) => a.user),
    subtaskCount: 0,
    subtaskDone: 0,
    minutes: minutesOf.get(s.id) ?? 0,
    running: runningIds.has(s.id),
    // Quien es responsable de la tarea principal también puede avanzar sus subtareas.
    mine: parentMine || s.assignees.some((a) => a.userId === user.id),
    values: Object.fromEntries(s.values.map((v) => [v.columnId, v.value as ColumnValue])),
    parentId: s.parentId,
  });

  const tasks: BoardTask[] = rawTasks.map((t) => {
    const subs = subtasks.filter((s) => s.parentId === t.id);
    const mine = t.assignees.some((a) => a.userId === user.id);
    return {
      subtasks: subs.map((s) => toSubtask(s, mine)),
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      groupId: t.groupId,
      estimateMinutes: t.estimateMinutes,
      assignees: t.assignees.map((a) => a.user),
      subtaskCount: subs.length,
      subtaskDone: subs.filter((s) => s.status === "DONE").length,
      minutes: (minutesOf.get(t.id) ?? 0) + subs.reduce((a, s) => a + (minutesOf.get(s.id) ?? 0), 0),
      running: runningIds.has(t.id) || subs.some((s) => runningIds.has(s.id)),
      mine: t.assignees.some((a) => a.userId === user.id),
      values: Object.fromEntries(t.values.map((v) => [v.columnId, v.value as ColumnValue])),
    };
  });

  const peopleMap = new Map<string, Person>();
  peopleMap.set(board.owner.id, board.owner);
  board.members.forEach((m) => peopleMap.set(m.user.id, m.user));
  const people = [...peopleMap.values()];
  const level = await boardLevel(user, id);
  const canManage = level === "manage";
  const canEdit = canManage || level === "edit";
  const memberRoles = Object.fromEntries(board.members.map((m) => [m.user.id, m.role]));
  const currentView = view === "kanban" ? "kanban" : "table";
  const columns: BoardColumnDef[] = board.columns.map((c) => ({ id: c.id, name: c.name, type: c.type, position: c.position, settings: asSettings(c.settings) }));
  const hidden = (board.hiddenColumns ?? []) as BuiltinKey[];

  return (
    <div className="px-4 py-6 md:px-8">
      <BoardHeader
        board={{ id: board.id, name: board.name, description: board.description, color: board.color, ownerId: board.ownerId, autoGroupByStatus: board.autoGroupByStatus }}
        members={people}
        memberRoles={memberRoles}
        isAdmin={manageMembers}
        allUsers={allUsers}
        canManage={canManage}
        department={board.department}
        departmentOptions={isSuperAdmin(user) || canManage ? deptOptions : []}
        canUnsetDepartment={isSuperAdmin(user)}
        view={currentView}
        stats={{
          total: tasks.length,
          done: tasks.filter((t) => t.status === "DONE").length,
          minutes: tasks.reduce((a, t) => a + t.minutes, 0),
        }}
      />
      <BoardView
        boardId={board.id}
        groups={board.groups.map((g) => ({ id: g.id, name: g.name, color: g.color }))}
        tasks={tasks}
        people={people}
        meId={user.id}
        canManage={canManage}
        canEdit={canEdit}
        view={currentView}
        columns={columns}
        hidden={hidden}
        columnOrder={board.columnOrder ?? []}
        columnWidths={(board.columnWidths ?? {}) as Record<string, number>}
      />
      {openTaskId && <TaskPanel taskId={openTaskId} boardId={board.id} people={people} groups={board.groups} user={user} columns={columns} canEdit={canEdit} />}
    </div>
  );
}
