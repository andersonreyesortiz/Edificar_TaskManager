import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/constants";
import { createBackup } from "@/lib/backup";
import { localStamp } from "@/lib/records";

export const maxDuration = 60;

/** Descarga un respaldo completo (solo administradores). Queda registrado en el historial. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Solo un administrador puede descargar respaldos.", { status: 403 });
  const backup = await createBackup(prisma, user.email);
  const total = Object.values(backup.counts).reduce((a, b) => a + b, 0);
  await prisma.activity.create({
    data: { userId: user.id, action: "backup.downloaded", detail: `descargó un respaldo completo de los datos (${total} registros)` },
  });
  const stamp = localStamp(new Date()).replace(" ", "_").replace(":", "");
  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${APP_NAME}-respaldo-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
