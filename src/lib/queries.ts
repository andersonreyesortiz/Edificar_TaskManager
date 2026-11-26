import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";
import type { ListTask } from "@/components/TaskListTable";

export async function myTasks(user: User, extra: Prisma.TaskWhereInput = {}): Promise<ListTask[]> {
  const tasks = await prisma.task.findMany({
    where: { assignees: { some: { userId: user.id } }, board: visibleBoardsWhere(user), ...extra },
    include: {
      board: { select: { name: true, color: true } },
      parent: { select: { title: true } },
      timeEntries: { select: { minutes: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return tasks.map((t) => ({ ...t, minutes: t.timeEntries.reduce((a, e) => a + e.minutes, 0) }));
}
