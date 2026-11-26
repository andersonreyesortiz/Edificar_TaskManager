"use client";

import { useOptimistic, useTransition } from "react";
import { Check, ChevronDown, UserPlus } from "lucide-react";
import type { Priority, TaskStatus } from "@prisma/client";
import { PRIORITIES, STATUSES, priorityMeta, statusMeta } from "@/lib/constants";
import { setTaskAssignees, updateTaskDates, updateTaskPriority, updateTaskStatus } from "@/lib/actions";
import { Popover } from "@/components/Popover";
import { Avatar } from "@/components/Avatar";
import type { Person } from "./types";

export function StatusPill({ status, compact }: { status: TaskStatus; compact?: boolean }) {
  const m = statusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: m.soft, color: m.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {!compact && m.label}
    </span>
  );
}

export function StatusSelect({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const [value, setValue] = useOptimistic(status);
  const [, start] = useTransition();
  return (
    <Popover
      width={180}
      trigger={() => (
        <button className="group inline-flex items-center gap-1">
          <StatusPill status={value} />
          <ChevronDown size={12} className="text-muted opacity-0 group-hover:opacity-100" />
        </button>
      )}
    >
      {(close) =>
        STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => {
              close();
              start(async () => {
                setValue(s.value);
                await updateTaskStatus(taskId, s.value);
              });
            }}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-canvas"
          >
            <StatusPill status={s.value} />
            {s.value === value && <Check size={14} className="text-brand-700" />}
          </button>
        ))
      }
    </Popover>
  );
}

export function PriorityFlag({ priority }: { priority: Priority }) {
  const m = priorityMeta(priority);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink/80">
      <span className="inline-flex gap-0.5">
        {PRIORITIES.map((p, i) => (
          <span
            key={p.value}
            className="h-3 w-1 rounded-sm"
            style={{ background: i <= PRIORITIES.findIndex((x) => x.value === priority) ? m.color : "#e5e3dc" }}
          />
        ))}
      </span>
      {m.label}
    </span>
  );
}

export function PrioritySelect({ taskId, priority }: { taskId: string; priority: Priority }) {
  const [value, setValue] = useOptimistic(priority);
  const [, start] = useTransition();
  return (
    <Popover
      width={160}
      trigger={() => (
        <button className="rounded-md px-1.5 py-1 hover:bg-canvas">
          <PriorityFlag priority={value} />
        </button>
      )}
    >
      {(close) =>
        PRIORITIES.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              close();
              start(async () => {
                setValue(p.value);
                await updateTaskPriority(taskId, p.value);
              });
            }}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-canvas"
          >
            <PriorityFlag priority={p.value} />
            {p.value === value && <Check size={14} className="text-brand-700" />}
          </button>
        ))
      }
    </Popover>
  );
}

export function AvatarStack({ people, max = 3, size = 24 }: { people: Person[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="flex -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} email={p.email} image={p.image} size={size} />
      ))}
      {people.length > max && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-canvas text-[10px] font-semibold text-muted ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

export function AssigneePicker({ taskId, assignees, people }: { taskId: string; assignees: Person[]; people: Person[] }) {
  const [value, setValue] = useOptimistic(assignees.map((a) => a.id));
  const [, start] = useTransition();
  const selected = people.filter((p) => value.includes(p.id));
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    start(async () => {
      setValue(next);
      await setTaskAssignees(taskId, next);
    });
  };
  return (
    <Popover
      width={250}
      trigger={() => (
        <button className="flex min-h-7 items-center rounded-md px-1 hover:bg-canvas" title="Responsables">
          {selected.length ? (
            <AvatarStack people={selected} />
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted/50 text-muted">
              <UserPlus size={12} />
            </span>
          )}
        </button>
      )}
    >
      {() => (
        <div>
          <p className="px-2 py-1 text-xs text-muted">Responsables</p>
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
            >
              <Avatar name={p.name} email={p.email} image={p.image} size={22} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.name ?? p.email}</span>
                {p.name && <span className="block truncate text-[11px] text-muted">{p.email}</span>}
              </span>
              {value.includes(p.id) && <Check size={14} className="text-brand-700" />}
            </button>
          ))}
          {people.length === 0 && <p className="px-2 py-2 text-xs text-muted">Agrega miembros al tablero primero.</p>}
        </div>
      )}
    </Popover>
  );
}

export function toInputDate(d: Date | string | null) {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DateCell({
  taskId,
  value,
  field = "dueDate",
  done,
}: {
  taskId: string;
  value: Date | null;
  field?: "dueDate" | "startDate";
  done?: boolean;
}) {
  const [, start] = useTransition();
  const v = toInputDate(value);
  const overdue = field === "dueDate" && !done && value && new Date(value) < new Date(new Date().toDateString());
  return (
    <input
      type="date"
      defaultValue={v}
      key={v}
      onChange={(e) => {
        const next = e.target.value || null;
        start(() => updateTaskDates(taskId, field, next));
      }}
      className={`w-[8.5rem] rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-line focus:border-brand-500 focus:outline-none ${
        overdue ? "font-medium text-red-600" : v ? "text-ink" : "text-muted"
      }`}
    />
  );
}
