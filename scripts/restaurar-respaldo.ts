/**
 * Restaura un respaldo de EdificarTM (archivo .json descargado desde Equipo › Respaldo de datos)
 * en una base de datos VACÍA que ya tenga las tablas creadas (prisma migrate deploy).
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/restaurar-respaldo.ts ruta/al/respaldo.json
 *
 * Por seguridad se niega a escribir en una base que ya tenga datos.
 * Ver el procedimiento completo en docs/respaldos-y-restauracion.md
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { BACKUP_FORMAT, BACKUP_TABLES, type BackupFile } from "../src/lib/backup";

type Row = Record<string, unknown>;
type Delegate = { createMany: (args: { data: Row[] }) => Promise<{ count: number }>; count: () => Promise<number> };

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Indica la ruta del archivo de respaldo. Ej.: npx tsx scripts/restaurar-respaldo.ts respaldo.json");
  const backup = JSON.parse(readFileSync(file, "utf8")) as BackupFile;
  if (backup.format !== BACKUP_FORMAT) throw new Error("El archivo no es un respaldo de EdificarTM.");

  const prisma = new PrismaClient();
  try {
    const existing = (await Promise.all(BACKUP_TABLES.map((t) => (prisma[t] as unknown as Delegate).count()))).reduce((a, b) => a + b, 0);
    if (existing > 0) throw new Error(`La base de destino ya tiene ${existing} registros. Restaura solo en una base vacía.`);

    console.log(`Respaldo del ${backup.createdAt} hecho por ${backup.createdBy} (esquema ${backup.schema ?? "?"})`);
    await prisma.$transaction(
      async (tx) => {
        for (const t of BACKUP_TABLES) {
          let rows = (backup.data[t] ?? []) as Row[];
          if (!rows.length) continue;
          // Las subtareas van después de su tarea principal.
          if (t === "task") {
            const ordered: Row[] = [];
            const done = new Set<string>();
            let pending = rows;
            while (pending.length) {
              const ready = pending.filter((r) => !r.parentId || done.has(r.parentId as string));
              if (!ready.length) throw new Error("Hay subtareas cuya tarea principal no está en el respaldo.");
              ready.forEach((r) => { ordered.push(r); done.add(r.id as string); });
              pending = pending.filter((r) => !done.has(r.id as string));
            }
            rows = ordered;
          }
          const delegate = tx[t] as unknown as Delegate;
          let n = 0;
          for (let i = 0; i < rows.length; i += 500) n += (await delegate.createMany({ data: rows.slice(i, i + 500) })).count;
          console.log(`  ${t}: ${n} de ${backup.counts[t]}`);
          if (n !== backup.counts[t]) throw new Error(`No coincide el número de registros en ${t}.`);
        }
      },
      { timeout: 10 * 60_000 },
    );
    console.log("Restauración completa.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
