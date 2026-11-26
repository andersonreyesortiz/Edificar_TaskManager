import type { Group, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtDateTime, formatMinutes } from "@/lib/constants";
import { Avatar } from "@/components/Avatar";
import { AssigneePicker, DateCell, PrioritySelect, StatusSelect } from "@/components/board/cells";
import type { Person } from "@/components/board/types";
import { ColumnCell } from "@/components/board/columns";
import { TYPE_ICONS } from "@/components/board/column-icons";
import { ReadOnly } from "@/components/ReadOnly";
import { isAssigned } from "@/lib/access";
import type { BoardColumnDef, ColumnValue } from "@/lib/columns";
import {
  CloseButton,
  CommentForm,
  DeleteTaskButton,
  DescriptionEditor,
  EstimateInput,
  GroupSelect,
  ManualTimeForm,
  PanelShell,
  SubtaskAdd,
  SubtaskTitle,
  TaskTimerButton,
  TimeEntryDelete,
  TitleEditor,
} from "./parts";

const personSelect = { id: true, name: true, email: true, image: true } as const;

const relative = fmtDateTime;

export async function TaskPanel({
  taskId,
  boardId,
  people,
  groups,
  user,
  columns,
  canEdit,
}: {
  taskId: string;
  boardId: string;
  people: Person[];
  groups: Group[];
  user: User;
  columns: BoardColumnDef[];
  canEdit: boolean;
}) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      parent: { select: { id: true, title: true } },
      createdBy: { select: personSelect },
      assignees: { include: { user: { select: personSelect } } },
      subtasks: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { assignees: { include: { user: { select: personSelect } } }, timeEntries: { select: { minutes: true } } },
      },
      timeEntries: { orderBy: { startedAt: "desc" }, include: { user: { select: personSelect } } },
      comments: { orderBy: { createdAt: "asc" }, include: { user: { select: personSelect } } },
      activities: { orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: personSelect } } },
      values: { select: { columnId: true, value: true } },
    },
  });
  if (!task || task.boardId !== boardId) return null;

  const canProgress = canEdit || (await isAssigned(user.id, task.id));
  const running = await prisma.timeEntry.findFirst({ where: { userId: user.id, endedAt: null, taskId } });
  const ownMinutes = task.timeEntries.reduce((a, e) => a + e.minutes, 0);
  const subMinutes = task.subtasks.reduce((a, s) => a + s.timeEntries.reduce((b, e) => b + e.minutes, 0), 0);
  const total = ownMinutes + subMinutes;
  const values = Object.fromEntries(task.values.map((v) => [v.columnId, v.value as ColumnValue]));
  const byPerson = new Map<string, { person: Person; minutes: number }>();
  for (const e of task.timeEntries) {
    const cur = byPerson.get(e.userId) ?? { person: e.user, minutes: 0 };
    cur.minutes += e.minutes;
    byPerson.set(e.userId, cur);
  }

  return (
    <PanelShell>
      <div className="flex items-center gap-2 border-b border-line px-6 py-3 text-xs text-muted">
        {task.parent ? (
          <>
            <span>Subtarea de</span>
            <CloseButton toTask={task.parent.id} label={task.parent.title} />
          </>
        ) : (
          <span>Tarea creada por {task.createdBy.name ?? task.createdBy.email} el {relative(task.createdAt)}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {canEdit && <DeleteTaskButton taskId={task.id} isSubtask={!!task.parentId} />}
          <CloseButton />
        </div>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-5">
        {canEdit ? <TitleEditor taskId={task.id} title={task.title} /> : <h2 className="px-1 text-xl font-semibold">{task.title}</h2>}
        {!canEdit && (
          <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
            {canProgress
              ? "Eres colaborador en este tablero: puedes cambiar el estado, registrar tiempo y comentar."
              : "Eres colaborador en este tablero: solo puedes comentar en tareas que no tienes asignadas."}
          </p>
        )}

        <dl className="grid grid-cols-[8rem_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-muted">Estado</dt>
          <dd><ReadOnly on={!canProgress}><StatusSelect taskId={task.id} status={task.status} /></ReadOnly></dd>
          <ReadOnly on={!canEdit}>
          <dt className="text-muted">Responsables</dt>
          <dd><AssigneePicker taskId={task.id} assignees={task.assignees.map((a) => a.user)} people={people} /></dd>
          <dt className="text-muted">Prioridad</dt>
          <dd><PrioritySelect taskId={task.id} priority={task.priority} /></dd>
          <dt className="text-muted">Inicio</dt>
          <dd><DateCell taskId={task.id} value={task.startDate} field="startDate" /></dd>
          <dt className="text-muted">Fecha límite</dt>
          <dd><DateCell taskId={task.id} value={task.dueDate} done={task.status === "DONE"} /></dd>
          <dt className="text-muted">Estimado</dt>
          <dd><EstimateInput taskId={task.id} minutes={task.estimateMinutes} /></dd>
          {!task.parentId && (
            <>
              <dt className="text-muted">Grupo</dt>
              <dd><GroupSelect taskId={task.id} groupId={task.groupId} groups={groups.map((g) => ({ id: g.id, name: g.name, color: g.color }))} /></dd>
            </>
          )}
          {columns.map((c) => {
            const Icon = TYPE_ICONS[c.type];
            return (
              <div key={c.id} className="contents">
                <dt className="flex min-w-0 items-center gap-1.5 text-muted"><Icon size={13} className="shrink-0" /><span className="truncate">{c.name}</span></dt>
                <dd className="min-w-0 max-w-xs"><ColumnCell taskId={task.id} column={c} value={values[c.id] ?? null} people={people} wide /></dd>
              </div>
            );
          })}
          </ReadOnly>
        </dl>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Descripción</h3>
          {canEdit ? (
            <DescriptionEditor taskId={task.id} description={task.description ?? ""} />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-ink/80">{task.description || <span className="text-muted">Sin descripción</span>}</p>
          )}
        </section>

        {!task.parentId && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">
              Subtareas{" "}
              {task.subtasks.length > 0 && (
                <span className="font-normal text-muted">
                  {task.subtasks.filter((s) => s.status === "DONE").length}/{task.subtasks.length}
                </span>
              )}
            </h3>
            <div className="card divide-y divide-line">
              {task.subtasks.map((s) => {
                const mins = s.timeEntries.reduce((a, e) => a + e.minutes, 0);
                return (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-1.5">
                    <SubtaskTitle id={s.id} title={s.title} done={s.status === "DONE"} />
                    {mins > 0 && <span className="text-xs text-muted">{formatMinutes(mins)}</span>}
                    <ReadOnly on={!canEdit}><AssigneePicker taskId={s.id} assignees={s.assignees.map((a) => a.user)} people={people} /></ReadOnly>
                    <ReadOnly on={!canProgress}><StatusSelect taskId={s.id} status={s.status} /></ReadOnly>
                  </div>
                );
              })}
              {canEdit && <SubtaskAdd boardId={boardId} parentId={task.id} />}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Tiempo registrado <span className="font-normal text-muted">{formatMinutes(total)}</span>
              {task.estimateMinutes ? <span className="font-normal text-muted"> de {formatMinutes(task.estimateMinutes)} estimadas</span> : null}
            </h3>
            {canProgress && <TaskTimerButton taskId={task.id} running={running ? running.startedAt.toISOString() : null} />}
          </div>
          {byPerson.size > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {[...byPerson.values()].map(({ person, minutes }) => (
                <span key={person.id} className="inline-flex items-center gap-1.5 rounded-full bg-canvas py-0.5 pl-0.5 pr-2.5 text-xs">
                  <Avatar name={person.name} email={person.email} image={person.image} size={20} />
                  {formatMinutes(minutes)}
                </span>
              ))}
              {subMinutes > 0 && <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs text-muted">+ {formatMinutes(subMinutes)} en subtareas</span>}
            </div>
          )}
          {canProgress && <ManualTimeForm taskId={task.id} />}
          {task.timeEntries.length > 0 && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {task.timeEntries.map((e) => (
                <li key={e.id} className="group flex items-center gap-3 py-2">
                  <Avatar name={e.user.name} email={e.user.email} image={e.user.image} size={22} />
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-medium">{e.endedAt ? formatMinutes(e.minutes) : "En curso"}</span>
                      <span className="text-muted"> · {e.user.name ?? e.user.email} · {fmtDate(e.startedAt)}</span>
                    </p>
                    {e.note && <p className="truncate text-xs text-muted">{e.note}</p>}
                  </div>
                  {(e.userId === user.id || user.role === "ADMIN") && e.endedAt && <TimeEntryDelete id={e.id} />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Comentarios</h3>
          <div className="space-y-3">
            {task.comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar name={c.user.name} email={c.user.email} image={c.user.image} size={28} />
                <div className="min-w-0 flex-1 rounded-lg bg-canvas px-3 py-2">
                  <p className="text-xs text-muted"><span className="font-medium text-ink">{c.user.name ?? c.user.email}</span> · {relative(c.createdAt)}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
              </div>
            ))}
            <CommentForm taskId={task.id} />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Historial</h3>
          <ul className="space-y-2 text-xs">
            {task.activities.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>
                  <span className="font-medium">{a.user.name ?? a.user.email}</span> {a.detail}
                  <span className="text-muted"> · {relative(a.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PanelShell>
  );
}
