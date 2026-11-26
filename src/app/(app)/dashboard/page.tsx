import Link from "next/link";
import { AlertTriangle, Ban, CheckCircle2, Clock3, FolderKanban, ListTodo } from "lucide-react";
import { addDays, format } from "date-fns";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";
import { buildDashboard, STATUS_ORDER, type PersonRow, type ProjectRow } from "@/lib/dashboard";
import { fmtDate, formatMinutes, statusMeta } from "@/lib/constants";
import type { TaskStatus } from "@prisma/client";
import { Avatar } from "@/components/Avatar";
import { HoursOverTime } from "@/components/reports/Charts";
import { PrintPageButton } from "./PrintPageButton";

type SP = { range?: string; board?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.range)) ? Number(sp.range) : 30;
  const [boards, d] = await Promise.all([
    prisma.board.findMany({ where: visibleBoardsWhere(me), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    buildDashboard(me, { days, boardId: sp.board || undefined }),
  ]);
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ range: String(days), ...(sp.board ? { board: sp.board } : {}), ...extra });
    return `/dashboard?${p.toString()}`;
  };
  const periodText = `${format(d.from, "dd/MM/yyyy")} al ${format(addDays(d.to, -1), "dd/MM/yyyy")}`;
  const maxOpen = Math.max(1, ...d.people.map((p) => p.open));
  const t = d.totals;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Resumen ejecutivo</h1>
          <p className="mt-1 text-sm text-muted">
            Cómo van los proyectos y la carga del equipo. Periodo: {periodText}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="flex rounded-lg border border-line bg-white p-0.5 text-sm">
            {[7, 30, 90].map((v) => (
              <Link key={v} href={qs({ range: String(v) })} className={`rounded-md px-3 py-1 ${days === v ? "bg-[#00A0E3] text-white" : "hover:bg-canvas"}`}>
                {v} días
              </Link>
            ))}
          </div>
          <form className="flex items-center gap-2">
            <input type="hidden" name="range" value={days} />
            <select name="board" defaultValue={sp.board ?? ""} className="input w-auto">
              <option value="">Todos los proyectos</option>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button className="btn-outline">Ver</button>
          </form>
          <PrintPageButton />
        </div>
      </div>

      {/* Indicadores */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={FolderKanban} label="Proyectos activos" value={t.boards} />
        <Kpi icon={ListTodo} label="Tareas abiertas" value={t.open} sub={t.dueThisWeek ? `${t.dueThisWeek} vencen en 7 días` : undefined} />
        <Kpi icon={AlertTriangle} label="Atrasadas" value={t.overdue} tone={t.overdue ? "bad" : "ok"} sub={t.open ? `${Math.round((t.overdue / t.open) * 100)}% de las abiertas` : undefined} />
        <Kpi icon={Ban} label="Bloqueadas" value={t.blocked} tone={t.blocked ? "warn" : "ok"} />
        <Kpi icon={CheckCircle2} label="Terminadas en el periodo" value={t.completedInPeriod} />
        <Kpi icon={Clock3} label="Horas registradas" value={`${(Math.round(t.periodMinutes / 6) / 10).toLocaleString("es")} h`} sub="en el periodo" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Avance por proyecto */}
        <section className="card min-w-0 break-inside-avoid">
          <Header title="Avance por proyecto" hint="Tareas principales por estado" />
          <StatusLegend />
          {d.projects.length === 0 ? (
            <Empty text="No hay proyectos visibles." />
          ) : (
            <ul className="divide-y divide-line">
              {d.projects.map((p) => <ProjectItem key={p.id} p={p} range={days} />)}
            </ul>
          )}
        </section>

        {/* Horas por semana */}
        <section className="card min-w-0 break-inside-avoid">
          <Header title="Horas registradas por semana" hint="Últimas 12 semanas" />
          <div className="px-2 pb-3 pt-4">
            <HoursOverTime data={d.weekly} height={260} />
          </div>
        </section>
      </div>

      {/* Carga de trabajo */}
      <section className="card mt-6 min-w-0 break-inside-avoid">
        <Header title="Carga de trabajo por persona" hint="Tareas y subtareas abiertas asignadas, por estado" />
        <StatusLegend skipDone />
        {d.people.length === 0 ? (
          <Empty text="Nadie tiene tareas asignadas." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Persona</th>
                  <th className="w-[40%] px-4 py-2 font-medium">Tareas abiertas</th>
                  <th className="px-3 py-2 text-right font-medium">Atrasadas</th>
                  <th className="px-3 py-2 text-right font-medium">Vencen en 7 días</th>
                  <th className="px-3 py-2 text-right font-medium">Terminadas</th>
                  <th className="px-4 py-2 text-right font-medium">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.people.map((p) => <PersonItem key={p.id} p={p} maxOpen={maxOpen} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Requiere atención */}
      <section className="card mt-6 min-w-0 break-inside-avoid">
        <Header title="Requiere atención" hint={`${d.attention.length} ${d.attention.length === 1 ? "tarea atrasada o bloqueada" : "tareas atrasadas o bloqueadas"}`} />
        {d.attention.length === 0 ? (
          <Empty text="No hay tareas atrasadas ni bloqueadas. ¡Todo en orden!" />
        ) : (
          <ul className="divide-y divide-line">
            {d.attention.slice(0, 12).map((a) => (
              <li key={a.id}>
                <Link href={`/boards/${a.boardId}?task=${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-canvas">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${a.reason === "overdue" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                  >
                    {a.reason === "overdue" ? <AlertTriangle size={12} /> : <Ban size={12} />}
                    {a.reason === "overdue" ? `Atrasada · ${a.dueDate ? fmtDate(a.dueDate) : ""}` : "Bloqueada"}
                  </span>
                  <span className="min-w-0 basis-full truncate font-medium sm:basis-0 sm:flex-1">{a.title}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <span className="h-2 w-2 rounded-sm" style={{ background: a.boardColor }} />
                    {a.boardName}
                  </span>
                  <span className="truncate text-xs text-muted sm:w-40 sm:text-right">{a.assignees.join(", ") || "Sin responsable"}</span>
                </Link>
              </li>
            ))}
            {d.attention.length > 12 && (
              <li className="px-4 py-2 text-xs text-muted">y {d.attention.length - 12} más. Revisa cada tablero para verlas todas.</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  tone?: "bad" | "warn" | "ok";
}) {
  const color = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-ink";
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Icon size={13} className={tone === "bad" ? "text-red-500" : tone === "warn" ? "text-amber-500" : "text-[#00A0E3]"} />
        {label}
      </p>
      <p className={`mt-1.5 text-[28px] font-semibold leading-none tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function Header({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
      <h2 className="font-semibold">{title}</h2>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function StatusLegend({ skipDone }: { skipDone?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-[11px] text-muted">
      {STATUS_ORDER.filter((s) => !(skipDone && s === "DONE")).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: statusMeta(s).color }} />
          {statusMeta(s).label}
        </span>
      ))}
    </div>
  );
}

/** Barra apilada por estado, con 2px de separación entre segmentos. */
function StatusBar({ counts, total, scale = total, skipDone }: { counts: Record<TaskStatus, number>; total: number; scale?: number; skipDone?: boolean }) {
  const order = STATUS_ORDER.filter((s) => !(skipDone && s === "DONE"));
  return (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded bg-transparent">
      {total === 0 ? (
        <div className="h-full w-full" />
      ) : (
        order.map((s) =>
          counts[s] ? (
            <div
              key={s}
              title={`${statusMeta(s).label}: ${counts[s]}`}
              className="h-full first:rounded-l last:rounded-r"
              style={{ width: `${(counts[s] / scale) * 100}%`, background: statusMeta(s).color }}
            />
          ) : null,
        )
      )}
    </div>
  );
}

function ProjectItem({ p, range }: { p: ProjectRow; range: number }) {
  const pct = Math.round(p.progress * 100);
  const hoursVsEstimate = p.estimateMinutes ? Math.round((p.loggedMinutes / p.estimateMinutes) * 100) : null;
  return (
    <li>
      <Link href={`/boards/${p.id}`} className="block px-4 py-3 hover:bg-canvas">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded" style={{ background: p.color }} />
          <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
          <span className="text-lg font-semibold tabular-nums">{pct}%</span>
          <span className="w-16 text-xs text-muted">terminado</span>
        </div>
        <div className="mt-2 pl-6">
          <StatusBar counts={p.counts} total={p.total} />
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted">
            <span>{p.counts.DONE} de {p.total} tareas</span>
            {p.overdue > 0 && <span className="font-medium text-red-600">{p.overdue} atrasada{p.overdue === 1 ? "" : "s"}</span>}
            {p.counts.BLOCKED > 0 && <span className="text-amber-700">{p.counts.BLOCKED} bloqueada{p.counts.BLOCKED === 1 ? "" : "s"}</span>}
            <span>{formatMinutes(p.periodMinutes)} en {range} días</span>
            {hoursVsEstimate !== null && (
              <span className={hoursVsEstimate > 100 ? "text-red-600" : ""}>
                {formatMinutes(p.loggedMinutes)} de {formatMinutes(p.estimateMinutes)} estimadas ({hoursVsEstimate}%)
              </span>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}

function PersonItem({ p, maxOpen }: { p: PersonRow; maxOpen: number }) {
  return (
    <tr>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={p.name} email={p.email} image={p.image} size={28} />
          <span className="truncate font-medium">{p.name}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1"><StatusBar counts={p.counts} total={p.open} scale={maxOpen} skipDone /></div>
          <span className="w-6 text-right tabular-nums">{p.open}</span>
        </div>
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${p.overdue ? "font-semibold text-red-600" : "text-muted"}`}>{p.overdue}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{p.dueThisWeek}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{p.completedInPeriod}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{formatMinutes(p.periodMinutes)}</td>
    </tr>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{text}</p>;
}
