# Procedimiento de uso de EdificarTM

| | |
|---|---|
| **Código** | PR-TM-01 (asignar según el sistema documental de Edificar) |
| **Versión** | 1.0 · 26 de noviembre de 2026 |
| **Responsable** | Administrador de EdificarTM |
| **Herramienta** | https://edificar-task-manager.vercel.app |

## 1. Objetivo

Definir cómo se planifican, asignan, ejecutan y registran las actividades de los proyectos de Constructora Edificar en EdificarTM, y cómo se conservan sus registros como evidencia del sistema de gestión de calidad (ISO 9001:2015, cláusulas 7.5 Información documentada, 8.1 Planificación y control operacional y 9.1 Seguimiento y medición).

## 2. Alcance

Aplica a todo el personal de Edificar y a terceros invitados (proveedores, consultores, clientes) que usan EdificarTM para dar seguimiento a actividades de diseño, obra, licitaciones y gestión.

## 3. Roles y responsabilidades

| Rol | Quién | Puede |
|---|---|---|
| **Superadministrador** | Personas en la lista `ADMIN_EMAILS` o que otro superadministrador nombre | Ver todos los tableros y departamentos, crear departamentos y nombrar a sus administradores, invitar personas, dar y quitar acceso, ver todo el historial, descargar respaldos. |
| **Administrador de departamento** | Nombrado por un superadministrador (una persona puede estar en varios departamentos) | Ver y gestionar todos los tableros de los departamentos que administra, invitar personas a ellos, agregar o quitar miembros del departamento y de sus tableros, y ver su Resumen ejecutivo. |
| **Dueño del tablero** | Quien crea el tablero | Todo lo del editor, más columnas, agrupar por estado, archivar el tablero y borrar grupos. |
| **Editor** (de un tablero) | Asignado por un administrador | Crear, editar, asignar y mover tareas; editar columnas y valores. |
| **Colaborador** (de un tablero) | Asignado por un administrador | En las tareas que tiene asignadas: cambiar el estado, registrar tiempo y comentar. No puede editar ni reasignar. |
| **Invitado** | Personas externas | Solo ven los tableros a los que se les agrega. |

**Privacidad:** cada persona solo ve los tableros donde es dueña o miembro (y los de los departamentos que administra). Reportes, actividad, exportaciones y la lista de personas se limitan a esos tableros. El Resumen ejecutivo lo ven los superadministradores, los administradores de departamento y los dueños o editores de algún tablero, cada uno con sus tableros.

## 4. Acceso

1. Nadie entra sin invitación. El administrador invita desde **Equipo › Invitar** con el correo de la persona y, si aplica, el tablero.
2. La persona entra con **Continuar con Google** o, si no usa Google, con **Enviarme un enlace de acceso** (llega al correo invitado, sirve una vez y vence en 30 minutos).
3. Cuando alguien deja la empresa o termina su participación, el administrador lo **desactiva** en **Equipo** el mismo día. Las personas no se borran, para conservar su historial.

## 5. Planificación de un proyecto

1. Crear un tablero por proyecto o frente de trabajo (**Nuevo tablero**), indicando su departamento y eligiendo la plantilla que corresponda (Proyecto de diseño u obra, Licitación, Seguimiento con terceros o En blanco).
2. Organizar las tareas en grupos (fases, entregables o semanas).
3. Para cada tarea definir: responsable(s), fecha límite, prioridad y, cuando aplique, estimado de horas y columnas propias del proyecto (fase, disciplina, costo, plano).
4. El administrador agrega a los miembros del tablero con el permiso que les corresponde (Editor o Colaborador).

## 6. Ejecución y seguimiento

1. Cada responsable actualiza el **estado** de sus tareas: Por hacer → En curso → En revisión → Terminada (o Bloqueada, con un comentario que explique el motivo).
2. El tiempo se registra en la tarea con el cronómetro o como registro manual, con una nota de lo realizado.
3. Las decisiones, aclaraciones y entregas se documentan como **comentarios** en la tarea, no por chat externo.
4. Al marcar una tarea como Terminada, quien la asignó recibe un correo para revisarla.
5. El dueño del tablero revisa semanalmente las tareas atrasadas y bloqueadas en **Reportes** y en el tablero.

## 7. Registros (información documentada)

| Registro | Dónde | Protección | Cómo obtener la evidencia |
|---|---|---|---|
| Historial de actividad (quién hizo qué y cuándo) | **Actividad** | No se puede editar ni borrar desde la app; la base de datos lo impide. Se conserva aunque se borre la tarea o el tablero. | **Actividad › Exportar** (Excel, CSV o PDF), con filtro de fechas, tablero y persona. |
| Tareas y su estado | Cada tablero | Cada cambio queda en el historial. | **Exportar** en el tablero o en **Reportes › Tareas**. |
| Tiempos registrados | Tareas y **Reportes** | Cada registro y cada borrado quedan en el historial, con los minutos. | **Reportes › Tiempos**. |
| Respaldos de datos | Archivo `.json` | Solo administradores; cada descarga queda en el historial. | Ver `docs/respaldos-y-restauracion.md`. |

- Cada exportación y cada respaldo dejan constancia en el historial de quién los generó y con qué filtros.
- Los PDF llevan la fecha de emisión, la persona que los generó, los filtros aplicados y la numeración de páginas.
- Retención: los registros se conservan en EdificarTM mientras la herramienta esté en uso. Los respaldos descargados se guardan en la carpeta de calidad del Drive de la empresa por al menos el tiempo que defina el procedimiento de control de registros de Edificar.

## 8. Seguimiento y medición

Los dueños de tablero y la gerencia usan **Reportes** (horas por persona, por proyecto y por tarea; tareas por estado; tareas terminadas y atrasadas) para las reuniones de seguimiento. Para una revisión por la dirección se exporta el reporte del periodo en PDF.

## 9. Respaldo y continuidad

El administrador descarga un respaldo **cada semana** (y antes de cualquier cambio grande) desde **Equipo › Respaldo de datos** y lo guarda en el Drive de la empresa. El procedimiento de restauración está en `docs/respaldos-y-restauracion.md` y debe probarse al menos una vez al año, dejando constancia.

## 10. Control de cambios de la herramienta

Los cambios a EdificarTM se hacen en el repositorio de GitHub `Edificar_TaskManager`; cada publicación queda registrada como un commit con fecha, autor y descripción, y se despliega automáticamente en Vercel. Los cambios en la base de datos se hacen solo mediante migraciones versionadas en `prisma/migrations`.

## 11. Historial de este documento

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-11-26 | Emisión inicial. |
