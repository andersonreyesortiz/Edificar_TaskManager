import type { PrismaClient } from "@prisma/client";

/**
 * Respaldo completo de los datos de la app en un archivo JSON.
 * No incluye sesiones ni tokens de inicio de sesión (Account, Session, VerificationToken):
 * al restaurar, cada persona vuelve a entrar con Google o con el enlace por correo.
 *
 * El orden importa: es el orden en que se restauran las tablas (primero las que no dependen de otras).
 */
export const BACKUP_TABLES = [
  "user",
  "board",
  "invitation",
  "boardMember",
  "boardColumn",
  "group",
  "task",
  "taskAssignee",
  "taskColumnValue",
  "timeEntry",
  "comment",
  "notification",
  "activity",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_FORMAT = "edificartm-respaldo";
export const BACKUP_VERSION = 1;

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  createdBy: string;
  /** Última migración aplicada a la base cuando se hizo el respaldo. */
  schema: string | null;
  counts: Record<BackupTable, number>;
  data: Record<BackupTable, Record<string, unknown>[]>;
};

type Delegate = { findMany: (args?: unknown) => Promise<Record<string, unknown>[]> };

export async function createBackup(prisma: PrismaClient, createdBy: string): Promise<BackupFile> {
  const data = {} as BackupFile["data"];
  const counts = {} as BackupFile["counts"];
  // Una transacción de solo lectura para que todas las tablas correspondan al mismo momento.
  await prisma.$transaction(
    async (tx) => {
      for (const t of BACKUP_TABLES) {
        const rows = await (tx[t] as unknown as Delegate).findMany();
        data[t] = rows;
        counts[t] = rows.length;
      }
    },
    { isolationLevel: "RepeatableRead", timeout: 60_000 },
  );
  let schema: string | null = null;
  try {
    const m = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
    schema = m[0]?.migration_name ?? null;
  } catch {}
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), createdBy, schema, counts, data };
}
