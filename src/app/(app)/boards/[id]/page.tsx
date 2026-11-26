import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessBoard, canManageBoard } from "@/lib/access";
import { BoardView } from "@/components/board/BoardView";
import { BoardHeader } from "@/components/board/BoardHeader";
import { TaskPanel } from "@/components/task/TaskPanel";
import type { BoardTask, Person } from "@/components/board/types";

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
    },
  });
  if (!board || board.archived) notFound();

  const [rawTasks, subtasks, timeByTask, running, allUsers] = await Promise.all([
    prisma.task.findMany({
      where: { boardId: id, parentId: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { assignees: { include: { user: { select: personSelect } } } },
    }),
    prisma.task.findMany({ where: { boardId: id, parentId: { not: null } }, select: { id: true, parentId: true, status: true } }),
    prisma.timeEntry.groupBy({ by: ["taskId"], where: { task: { boardId: id } }, _sum: { minutes: true } }),
    prisma.timeEntry.findMany({ where: { userId: user.id, endedAt: null }, select: { taskId: true } }),
    prisma.user.findMany({ where: { active: true }, select: personSelect, orderBy: { name: "asc" } }),
  ]);

  const minutesOf = new Map(timeByTask.map((t) => [t.taskId, t._sum.minutes ?? 0]));
  const runningIds = new Set(running.map((r) => r.taskId));

  const tasks: BoardTask[] = rawTasks.map((t) => {
    const subs = subtasks.filter((s) => s.parentId === t.id);
    return {
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
    };
  });

  const peopleMap = new Map<string, Person>();
  peopleMap.set(board.owner.id, board.owner);
  board.members.forEach((m) => peopleMap.set(m.user.id, m.user));
  const people = [...peopleMap.values()];
  const canManage = await canManageBoard(user, id);
  const currentView = view === "kanban" ? "kanban" : "table";

  return (
    <div className="px-4 py-6 md:px-8">
      <BoardHeader
        board={{ id: board.id, name: board.name, description: board.description, color: board.color, ownerId: board.ownerId }}
        members={people}
        allUsers={allUsers}
        canManage={canManage}
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
        view={currentView}
      />
      {openTaskId && <TaskPanel taskId={openTaskId} boardId={board.id} people={people} groups={board.groups} user={user} />}
    </div>
  );
}
