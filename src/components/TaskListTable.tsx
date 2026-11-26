import Link from "next/link";
import { formatMinutes } from "@/lib/constants";
import { DateCell, PrioritySelect, StatusSelect } from "@/components/board/cells";
import type { Priority, TaskStatus } from "@prisma/client";

export type ListTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  boardId: string;
  board: { name: string; color: string };
  parent: { title: string } | null;
  minutes: number;
};

export function TaskListTable({ tasks, empty }: { tasks: ListTask[]; empty: string }) {
  if (!tasks.length) return <p className="px-4 py-6 text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-4 py-2 font-medium">Tarea</th>
            <th className="px-2 py-2 font-medium">Tablero</th>
            <th className="w-36 px-2 py-2 font-medium">Estado</th>
            <th className="w-32 px-2 py-2 font-medium">Prioridad</th>
            <th className="w-36 px-2 py-2 font-medium">Fecha límite</th>
            <th className="w-24 px-2 py-2 font-medium">Tiempo</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-b border-line/70 last:border-0 hover:bg-canvas/60">
              <td className="px-4 py-1.5">
                <Link href={`/boards/${t.boardId}?task=${t.id}`} className="hover:text-brand-700">
                  {t.parent && <span className="text-xs text-muted">{t.parent.title} › </span>}
                  <span className="font-medium">{t.title}</span>
                </Link>
              </td>
              <td className="px-2 py-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-sm" style={{ background: t.board.color }} />
                  {t.board.name}
                </span>
              </td>
              <td className="px-2 py-1.5"><StatusSelect taskId={t.id} status={t.status} /></td>
              <td className="px-2 py-1.5"><PrioritySelect taskId={t.id} priority={t.priority} /></td>
              <td className="px-2 py-1.5"><DateCell taskId={t.id} value={t.dueDate} done={t.status === "DONE"} /></td>
              <td className="px-2 py-1.5 text-xs tabular-nums">{t.minutes ? formatMinutes(t.minutes) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
