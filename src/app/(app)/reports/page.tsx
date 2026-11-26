import Link from "next/link";
import { ExportMenu } from "@/components/ExportMenu";
import { format, addDays } from "date-fns";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { visibleBoardsWhere } from "@/lib/access";
import { buildReport, parseFilters } from "@/lib/reports";
import { formatMinutes } from "@/lib/constants";
import { HoursOverTime, HoursRanking, StatusChart } from "@/components/reports/Charts";

type SP = { range?: string; from?: string; to?: string; board?: string; user?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [boards, people, report] = await Promise.all([
    prisma.board.findMany({ where: visibleBoardsWhere(me), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    buildReport(me, filters),
  ]);
  const fromStr = format(filters.from, "yyyy-MM-dd");
  const toStr = format(addDays(filters.to, -1), "yyyy-MM-dd");
  const range = sp.from ? "" : sp.range ?? "30";
  const exportQs = new URLSearchParams({ from: fromStr, to: toStr, ...(filters.boardId ? { board: filters.boardId } : {}), ...(filters.userId ? { user: filters.userId } : {}) });
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (filters.boardId) p.set("board", filters.boardId);
    if (filters.userId) p.set("user", filters.userId);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return `/reports?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reportes</h1>
          <p className="mt-1 text-sm text-muted">Tiempo invertido y avance de tareas del {format(filters.from, "dd/MM/yyyy")} al {format(addDays(filters.to, -1), "dd/MM/yyyy")}.</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu kind="tiempos" label="Tiempos" query={Object.fromEntries(exportQs)} />
          <ExportMenu kind="tareas" label="Tareas" query={{ board: filters.boardId, user: filters.userId }} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-white p-0.5 text-sm">
          {[["7", "7 días"], ["30", "30 días"], ["90", "90 días"]].map(([v, l]) => (
            <Link key={v} href={qs({ range: v })} className={`rounded-md px-3 py-1 ${range === v ? "bg-brand-700 text-white" : "hover:bg-canvas"}`}>{l}</Link>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <input type="date" name="from" defaultValue={fromStr} className="input w-auto" />
          <span className="text-sm text-muted">a</span>
          <input type="date" name="to" defaultValue={toStr} className="input w-auto" />
          <select name="board" defaultValue={filters.boardId ?? ""} className="input w-auto">
            <option value="">Todos los tableros</option>
            {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select name="user" defaultValue={filters.userId ?? ""} className="input w-auto">
            <option value="">Todas las personas</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}
          </select>
          <button className="btn-primary">Aplicar</button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Horas registradas" value={formatMinutes(report.totalMinutes)} />
        <Stat label="Tareas terminadas en el periodo" value={String(report.completed)} />
        <Stat label="Tareas abiertas" value={String(report.open)} />
        <Stat label="Tareas vencidas" value={String(report.overdue)} bad={report.overdue > 0} />
      </div>

      <section className="card mt-6 p-4">
        <h2 className="font-semibold">Horas por {report.weekly ? "semana" : "día"}</h2>
        <div className="mt-3"><HoursOverTime data={report.series} /></div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold">Horas por persona</h2>
          <div className="mt-3"><HoursRanking data={report.byPerson} /></div>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Horas por tablero</h2>
          <div className="mt-3"><HoursRanking data={report.byBoard} /></div>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Tareas por estado</h2>
          <p className="text-xs text-muted">Estado actual de todas las tareas y subtareas{filters.boardId ? " del tablero" : ""}.</p>
          <div className="mt-3"><StatusChart data={report.byStatus} /></div>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Tareas con más tiempo</h2>
          <div className="mt-3"><HoursRanking data={report.byTask} /></div>
        </section>
      </div>

      {report.matrix.length > 0 && (
        <section className="card mt-6 overflow-x-auto">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Detalle por persona y tablero</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Persona</th>
                {report.byBoard.map((b) => <th key={b.key} className="px-3 py-2 text-right font-medium">{b.label}</th>)}
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.matrix.map((r) => (
                <tr key={r.person} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-2 font-medium">{r.person}</td>
                  {report.byBoard.map((b) => (
                    <td key={b.key} className="px-3 py-2 text-right tabular-nums">{r.boards[b.key] ? formatMinutes(r.boards[b.key]) : "—"}</td>
                  ))}
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{formatMinutes(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${bad ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}
