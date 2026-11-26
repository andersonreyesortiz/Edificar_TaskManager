# Respaldos y restauración de EdificarTM

Este documento describe cómo se respaldan los datos de EdificarTM y cómo se restauran. Forma parte del procedimiento de uso (`docs/procedimiento-de-uso.md`).

## 1. Dónde viven los datos

- **Base de datos:** PostgreSQL en Neon (proyecto creado desde la integración de Vercel).
- **Aplicación:** Vercel, desplegada desde la rama `main` de GitHub. El código y las migraciones de la base están en el repositorio, así que la aplicación se puede volver a desplegar en cualquier momento.

## 2. Dos niveles de respaldo

| Nivel | Qué cubre | Quién | Frecuencia |
|---|---|---|---|
| **Restauración instantánea de Neon** | Volver la base completa a un momento reciente (errores de las últimas horas). | Automático en Neon | Continuo. En el plan gratis la ventana es corta (horas); revisa el valor actual en Neon › Settings › *Instant restore* / *History retention*. |
| **Respaldo descargable** | Copia completa en un archivo `.json` que se guarda fuera de Neon. | Administrador | **Semanal**, y antes de cualquier cambio grande. |

Como la ventana de Neon gratis es corta, el respaldo descargable es el control principal.

## 3. Descargar un respaldo (semanal)

1. Entrar como administrador y abrir **Equipo**.
2. En **Respaldo de datos**, pulsar **Descargar respaldo**. Se descarga `EdificarTM-respaldo-AAAA-MM-DD_HHMM.json`.
3. Guardar el archivo en la carpeta de calidad del Drive de la empresa (por ejemplo `Calidad/EdificarTM/Respaldos/AAAA`). Conviene que esa carpeta tenga acceso restringido, porque el archivo contiene los correos del equipo y todo el contenido de las tareas.
4. La descarga queda registrada en el historial de actividad (acción `backup.downloaded`) y se ve en la misma tarjeta como «Últimos respaldos».

**Qué incluye:** personas, invitaciones, tableros, miembros y permisos, columnas, grupos, tareas y subtareas, responsables, valores de columnas, registros de tiempo, comentarios, notificaciones e historial de actividad.

**Qué no incluye:** sesiones y tokens de inicio de sesión. Después de restaurar, cada persona vuelve a entrar con Google o con el enlace por correo.

## 4. Restaurar

### 4.1 Error reciente (últimas horas): restauración de Neon

1. En la consola de Neon, abrir el proyecto › **Branches** (o **Restore**).
2. Elegir *Restore* a un momento anterior al error. Neon permite primero crear una rama con ese momento para revisarla antes de reemplazar la principal.
3. Verificar en la app que los datos estén bien y registrar lo hecho (ver 4.3).

### 4.2 Pérdida mayor: restaurar desde el respaldo descargado

Necesita a alguien con acceso a una terminal con Node.js y al repositorio.

1. Crear una base de datos **vacía** (en Neon: una rama nueva vacía o un proyecto nuevo) y copiar su cadena de conexión.
2. Crear las tablas en esa base:
   ```bash
   DATABASE_URL="postgresql://…" npx prisma migrate deploy
   ```
3. Cargar el respaldo:
   ```bash
   DATABASE_URL="postgresql://…" npm run db:restore -- ruta/EdificarTM-respaldo-AAAA-MM-DD_HHMM.json
   ```
   El script se niega a escribir en una base que ya tenga datos, carga todo en una sola transacción (si algo falla no queda nada a medias) y muestra cuántos registros cargó de cada tabla, comparándolos con los del archivo.
4. En Vercel › proyecto › **Settings › Environment Variables**, cambiar `DATABASE_URL` y `DATABASE_URL_UNPOOLED` a la base restaurada y volver a desplegar.
5. Entrar a la app y verificar tableros, tareas e historial.

### 4.3 Dejar constancia

Después de cada restauración (o prueba de restauración), registrar: fecha, motivo, respaldo usado, quién la hizo, resultado y conteo de registros que mostró el script. Se recomienda una tarea en un tablero interno de «Sistema de gestión» para que quede en el historial de EdificarTM.

## 5. Prueba anual de restauración

Una vez al año, restaurar el último respaldo en una rama vacía de Neon siguiendo 4.2 (pasos 1 a 3) sin cambiar la base de producción, comprobar que los conteos coinciden y dejar constancia según 4.3.

## 6. Protección del historial

El historial de actividad está protegido en la base de datos: un disparador (`activity_guard`, migración `20261126200000_audit_log`) rechaza cualquier edición o borrado de sus registros. Solo se permite soltar el vínculo con una tarea o tablero cuando estos se borran, y el registro conserva una copia de sus nombres. El único modo de saltarse esta protección es activar a propósito `edificar.audit_override` dentro de una transacción en la base de datos, lo que solo se usa para cargar datos de prueba en un entorno local.
