import { NextRequest } from "next/server";
import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/constants";
import { RECORD_KINDS, buildRecords, localStamp, recordsToCsv, type RecordKind } from "@/lib/records";

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const { kind } = await params;
  if (!RECORD_KINDS.includes(kind as RecordKind)) return new Response("No encontrado", { status: 404 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const format = sp.format === "csv" ? "csv" : "xlsx";
  const table = await buildRecords(kind as RecordKind, user, sp);
  const stamp = localStamp(new Date());
  const fileBase = `${APP_NAME}-${kind}-${stamp.slice(0, 10)}`;

  // Deja constancia de quién exportó qué (evidencia de control de registros).
  await prisma.activity.create({
    data: {
      userId: user.id,
      action: "records.exported",
      detail: `exportó «${table.title}» (${format.toUpperCase()}, ${table.rows.length} filas; ${table.scope.join(" · ")})`,
      boardId: sp.board || null,
    },
  });

  if (format === "csv") {
    return new Response(recordsToCsv(table), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
      },
    });
  }

  const head = (v: string) => ({ value: v, fontWeight: "bold" as const, backgroundColor: "#E6E7E8" });
  const data: SheetData = [
    [{ value: `${APP_NAME} · ${table.title}`, fontWeight: "bold" as const, fontSize: 14 }],
    ...table.scope.map((s) => [s]),
    [`Generado por: ${user.name ?? user.email} (${user.email}) el ${stamp}`],
    [],
    table.headers.map(head),
    ...table.rows.map((r) => r.map((v) => (v === null || v === "" ? null : v))),
  ];
  const buffer = await writeXlsxFile(data, {
    sheet: table.title.slice(0, 31),
    columns: table.widths.map((width) => ({ width })),
    stickyRowsCount: table.scope.length + 4,
  }).toBuffer();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
    },
  });
}
