import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { fmtDateTime } from "@/lib/constants";

type Item = {
  id: string;
  detail: string | null;
  createdAt: Date;
  taskId: string | null;
  boardId: string | null;
  user: { name: string | null; email: string; image: string | null };
  board: { name: string; color: string } | null;
  boardName?: string | null;
};

export function ActivityList({ items, showBoard = true }: { items: Item[]; showBoard?: boolean }) {
  if (!items.length) return <p className="px-4 py-6 text-sm text-muted">Todavía no hay actividad.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => {
        const href = a.boardId ? `/boards/${a.boardId}${a.taskId ? `?task=${a.taskId}` : ""}` : null;
        const body = (
          <>
            <Avatar name={a.user.name} email={a.user.email} image={a.user.image} size={28} />
            <div className="min-w-0 flex-1 text-sm">
              <p>
                <span className="font-medium">{a.user.name ?? a.user.email}</span> {a.detail}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                {showBoard && !a.board && a.boardName && <span>{a.boardName}</span>}
                {showBoard && a.board && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ background: a.board.color }} />
                    {a.board.name}
                  </span>
                )}
                {fmtDateTime(a.createdAt)}
              </p>
            </div>
          </>
        );
        return (
          <li key={a.id}>
            {href ? (
              <Link href={href} className="flex gap-3 px-4 py-3 hover:bg-canvas/60">{body}</Link>
            ) : (
              <div className="flex gap-3 px-4 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
