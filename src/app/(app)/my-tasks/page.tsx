import { requireUser } from "@/lib/session";
import { myTasks } from "@/lib/queries";
import { TaskListTable } from "@/components/TaskListTable";
import { CLOSED_STATUSES } from "@/lib/constants";

export default async function MyTasksPage() {
  const user = await requireUser();
  const [open, done] = await Promise.all([myTasks(user, { status: { notIn: CLOSED_STATUSES } }), myTasks(user, { status: { in: CLOSED_STATUSES } })]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">Mis tareas</h1>
      <p className="mt-1 text-sm text-muted">Tareas y subtareas donde eres responsable, en todos tus tableros.</p>
      <section className="card mt-6">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Abiertas <span className="font-normal text-muted">{open.length}</span></h2>
        <TaskListTable tasks={open} empty="No tienes tareas abiertas." />
      </section>
      <section className="card mt-6">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Terminadas <span className="font-normal text-muted">{done.length}</span></h2>
        <TaskListTable tasks={done.slice(0, 50)} empty="Aún no has terminado tareas." />
      </section>
    </div>
  );
}
