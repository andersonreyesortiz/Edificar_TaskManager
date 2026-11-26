import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/constants";
import { BrandMark } from "@/components/Logo";
import { RECORD_KINDS, buildRecords, localStamp, type RecordKind, type RecordQuery } from "@/lib/records";
import { PrintButton } from "./PrintButton";

export const metadata = { title: `Reporte · ${APP_NAME}` };

/** Versión para imprimir o guardar como PDF de los registros (evidencia para auditoría). */
export default async function PrintPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<RecordQuery> }) {
  const user = await requireUser();
  const { kind } = await params;
  if (!RECORD_KINDS.includes(kind as RecordKind)) notFound();
  const q = await searchParams;
  const table = await buildRecords(kind as RecordKind, user, q);
  const stamp = localStamp(new Date());
  await prisma.activity.create({
    data: {
      userId: user.id,
      action: "records.exported",
      detail: `generó el reporte PDF «${table.title}» (${table.rows.length} filas; ${table.scope.join(" · ")})`,
      boardId: q.board || null,
    },
  });

  return (
    <div className="print-report min-h-screen bg-white text-[#1d1f24]">
      <style>{`
        @page { size: A4 landscape; margin: 12mm 10mm 14mm;
          @bottom-left { content: "${APP_NAME} · ${table.title} · Generado el ${stamp}"; font: 8pt sans-serif; color: #6b7079; }
          @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt sans-serif; color: #6b7079; } }
        @media print { .no-print { display: none !important; } body { background: #fff; } }
        .print-report thead { display: table-header-group; }
        .print-report tr { break-inside: avoid; }
      `}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#e3e5e8] bg-[#F4F5F6] px-6 py-3 text-sm">
        <span className="text-[#5b6068]">Vista para imprimir. Usa «Guardar como PDF» en la ventana de impresión.</span>
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#00A0E3] pb-4">
          <div className="flex items-center gap-3">
            <BrandMark size={34} />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b7079]">Constructora Edificar · {APP_NAME}</p>
              <h1 className="text-xl font-semibold">{table.title}</h1>
            </div>
          </div>
          <dl className="text-right text-[11px] leading-5 text-[#5b6068]">
            {table.scope.map((s) => <div key={s}>{s}</div>)}
            <div>Generado por {user.name ?? user.email} ({user.email})</div>
            <div>Fecha de emisión: {stamp}</div>
            <div>Total de filas: {table.rows.length}</div>
          </dl>
        </header>
        {table.rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6b7079]">No hay registros con estos filtros.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-[10px] leading-snug">
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th key={h} className="border border-[#d5d7db] bg-[#E6E7E8] px-1.5 py-1 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="odd:bg-white even:bg-[#F8F9FA]">
                  {r.map((v, j) => (
                    <td key={j} className={`border border-[#e3e5e8] px-1.5 py-1 align-top ${typeof v === "number" ? "text-right tabular-nums" : ""}`}>
                      {v ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-6 text-[10px] text-[#8a8f97]">
          Documento generado automáticamente por {APP_NAME} a partir de registros que no se pueden editar ni borrar desde la aplicación.
        </p>
      </div>
    </div>
  );
}
