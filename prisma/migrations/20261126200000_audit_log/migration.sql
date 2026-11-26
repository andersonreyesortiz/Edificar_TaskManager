-- Historial de actividad inalterable (control de registros, ISO 9001 §7.5.3).

-- 1) Copia de nombres para que el registro se entienda aunque se borre la tarea o el tablero.
ALTER TABLE "Activity" ADD COLUMN "boardName" TEXT;
ALTER TABLE "Activity" ADD COLUMN "taskTitle" TEXT;

UPDATE "Activity" a SET "boardName" = b."name" FROM "Board" b WHERE a."boardId" = b."id";
UPDATE "Activity" a SET "taskTitle" = t."title" FROM "Task" t WHERE a."taskId" = t."id";

-- 2) Borrar una tarea, tablero o usuario ya no borra su historial.
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_boardId_fkey";
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_taskId_fkey";
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_userId_fkey";
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) La base de datos rechaza editar o borrar registros del historial.
--    Solo se permite soltar el vínculo (boardId/taskId -> NULL) cuando se borra la tarea o el tablero.
--    Para cargar datos de prueba o restaurar un respaldo en una base vacía se puede activar
--    temporalmente, dentro de una transacción: SELECT set_config('edificar.audit_override', 'on', true);
CREATE OR REPLACE FUNCTION activity_guard() RETURNS trigger AS $$
BEGIN
  IF current_setting('edificar.audit_override', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" = OLD."id" AND NEW."userId" = OLD."userId" AND NEW."action" = OLD."action"
       AND NEW."detail" IS NOT DISTINCT FROM OLD."detail"
       AND NEW."createdAt" = OLD."createdAt"
       AND NEW."boardName" IS NOT DISTINCT FROM OLD."boardName"
       AND NEW."taskTitle" IS NOT DISTINCT FROM OLD."taskTitle"
       AND (NEW."boardId" IS NOT DISTINCT FROM OLD."boardId" OR NEW."boardId" IS NULL)
       AND (NEW."taskId" IS NOT DISTINCT FROM OLD."taskId" OR NEW."taskId" IS NULL) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'El historial de actividad no se puede modificar ni borrar (%).', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_no_update_delete
  BEFORE UPDATE OR DELETE ON "Activity"
  FOR EACH ROW EXECUTE FUNCTION activity_guard();

CREATE TRIGGER activity_no_truncate
  BEFORE TRUNCATE ON "Activity"
  FOR EACH STATEMENT EXECUTE FUNCTION activity_guard();
