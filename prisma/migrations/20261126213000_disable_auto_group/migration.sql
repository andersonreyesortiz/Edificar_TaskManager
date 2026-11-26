-- Se retiró la opción "Agrupar por estado" que movía tareas entre grupos; queda solo la vista personal.
UPDATE "Board" SET "autoGroupByStatus" = false WHERE "autoGroupByStatus" = true;
