"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Pause, Play, Plus, Trash2, X } from "lucide-react";
import {
  addComment,
  addTimeEntry,
  createTask,
  deleteTask,
  deleteTimeEntry,
  moveTaskToGroup,
  startTimer,
  stopTimer,
  updateTaskDescription,
  updateTaskEstimate,
  updateTaskTitle,
} from "@/lib/actions";
import { elapsed } from "@/components/RunningTimer";
import { toInputDate } from "@/components/board/cells";
import { MentionTextarea } from "./Mentions";

type MentionPerson = { id: string; name: string | null; email: string; image: string | null };

function useTaskHref() {
  const params = useSearchParams();
  const path = usePathname();
  return (taskId?: string) => {
    const p = new URLSearchParams(params.toString());
    if (taskId) p.set("task", taskId);
    else p.delete("task");
    const q = p.toString();
    return q ? `${path}?${q}` : path;
  };
}

export function PanelShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const href = useTaskHref();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "Escape" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) router.push(href(), { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, href]);
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={() => router.push(href(), { scroll: false })} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col bg-white shadow-2xl">{children}</aside>
    </>
  );
}

export function CloseButton({ toTask, label }: { toTask?: string; label?: string }) {
  const href = useTaskHref();
  if (toTask) {
    return (
      <Link href={href(toTask)} scroll={false} className="font-medium text-brand-700 hover:underline">
        {label}
      </Link>
    );
  }
  return (
    <Link href={href()} scroll={false} className="rounded-md p-1.5 text-muted hover:bg-black/5" title="Cerrar">
      <X size={16} />
    </Link>
  );
}

export function DeleteTaskButton({ taskId, isSubtask }: { taskId: string; isSubtask: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const href = useTaskHref();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(isSubtask ? "¿Borrar esta subtarea?" : "¿Borrar esta tarea con sus subtareas y tiempos?")) return;
        start(async () => {
          await deleteTask(taskId);
          router.push(href(), { scroll: false });
        });
      }}
      className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
      title="Borrar"
    >
      <Trash2 size={15} />
    </button>
  );
}

export function TitleEditor({ taskId, title }: { taskId: string; title: string }) {
  const [, start] = useTransition();
  return (
    <textarea
      key={title}
      defaultValue={title}
      rows={1}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && v !== title) start(() => updateTaskTitle(taskId, v));
      }}
      className="w-full resize-none rounded-md bg-transparent px-1 text-xl font-semibold outline-none focus:bg-canvas"
    />
  );
}

export function DescriptionEditor({ taskId, description, people }: { taskId: string; description: string; people: MentionPerson[] }) {
  const [value, setValue] = useState(description);
  const [pending, start] = useTransition();
  const dirty = value !== description;
  return (
    <div>
      <MentionTextarea
        value={value}
        onChange={setValue}
        people={people}
        rows={4}
        placeholder="Agrega detalles, criterios o enlaces. Escribe @ para mencionar a alguien."
      />
      {dirty && (
        <div className="mt-2 flex justify-end gap-2">
          <button onClick={() => setValue(description)} className="btn-ghost">Cancelar</button>
          <button disabled={pending} onClick={() => start(() => updateTaskDescription(taskId, value))} className="btn-primary">Guardar</button>
        </div>
      )}
    </div>
  );
}

export function EstimateInput({ taskId, minutes }: { taskId: string; minutes: number | null }) {
  const [, start] = useTransition();
  const hours = minutes ? +(minutes / 60).toFixed(2) : "";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <input
        key={String(hours)}
        type="number"
        min={0}
        step={0.25}
        defaultValue={hours}
        placeholder="—"
        onBlur={(e) => {
          const v = e.target.value ? Number(e.target.value) : null;
          if (v !== (hours === "" ? null : hours)) start(() => updateTaskEstimate(taskId, v));
        }}
        className="w-20 rounded-md border border-line px-2 py-1 text-sm text-ink outline-none focus:border-brand-500"
      />
      horas
    </span>
  );
}

export function GroupSelect({
  taskId,
  groupId,
  groups,
}: {
  taskId: string;
  groupId: string | null;
  groups: { id: string; name: string; color: string }[];
}) {
  const [, start] = useTransition();
  return (
    <select
      defaultValue={groupId ?? ""}
      onChange={(e) => start(() => moveTaskToGroup(taskId, e.target.value))}
      className="rounded-md border border-line bg-white px-2 py-1 text-sm"
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  );
}

export function SubtaskTitle({ id, title, done }: { id: string; title: string; done: boolean }) {
  const href = useTaskHref();
  return (
    <Link href={href(id)} scroll={false} className={`min-w-0 flex-1 truncate text-sm hover:text-brand-700 ${done ? "text-muted line-through" : ""}`}>
      {title}
    </Link>
  );
}

export function SubtaskAdd({ boardId, parentId }: { boardId: string; parentId: string }) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const t = title.trim();
        setTitle("");
        start(async () => {
          await createTask({ boardId, parentId, title: t });
        });
      }}
      className="flex items-center gap-2 px-3 py-1.5"
    >
      <Plus size={14} className="text-muted" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={pending}
        placeholder="Agregar subtarea"
        className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted"
      />
    </form>
  );
}

export function TaskTimerButton({ taskId, running }: { taskId: string; running: string | null }) {
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return running ? (
    <button disabled={pending} onClick={() => start(() => stopTimer())} className="btn-primary">
      <Pause size={13} fill="currentColor" /> Detener <span className="font-mono tabular-nums">{elapsed(running, now)}</span>
    </button>
  ) : (
    <button disabled={pending} onClick={() => start(() => startTimer(taskId))} className="btn-outline">
      <Play size={13} fill="currentColor" className="text-brand-700" /> Iniciar cronómetro
    </button>
  );
}

export function ManualTimeForm({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-brand-700 hover:underline">
        + Registrar tiempo manualmente
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          try {
            await addTimeEntry({ taskId, date, hours: Number(hours || 0), minutes: Number(minutes || 0), note });
            setHours("");
            setMinutes("");
            setNote("");
            setOpen(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar.");
          }
        });
      }}
      className="rounded-lg border border-line bg-canvas p-3"
    >
      <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
        <div>
          <label className="label">Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="input" />
        </div>
        <div>
          <label className="label">Horas</label>
          <input type="number" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} className="input" placeholder="0" />
        </div>
        <div>
          <label className="label">Minutos</label>
          <input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="input" placeholder="0" />
        </div>
      </div>
      <div className="mt-2">
        <label className="label">Nota (opcional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="¿Qué hiciste?" />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancelar</button>
        <button disabled={pending} className="btn-primary">Guardar tiempo</button>
      </div>
    </form>
  );
}

export function TimeEntryDelete({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => confirm("¿Borrar este registro de tiempo?") && start(() => deleteTimeEntry(id))}
      className="rounded p-1 text-muted opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
      title="Borrar registro"
    >
      <Trash2 size={13} />
    </button>
  );
}

export function CommentForm({ taskId, people }: { taskId: string; people: MentionPerson[] }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const send = () => {
    if (!body.trim()) return;
    const b = body;
    setBody("");
    start(() => addComment(taskId, b));
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex gap-2"
    >
      <MentionTextarea
        value={body}
        onChange={setBody}
        people={people}
        onSubmitShortcut={send}
        rows={2}
        placeholder="Escribe un comentario. Usa @ para mencionar a alguien."
      />
      <button disabled={pending || !body.trim()} className="btn-primary self-end">Enviar</button>
    </form>
  );
}
