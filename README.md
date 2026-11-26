# Ritmo

Gestor de tareas para equipos: tableros, tareas y subtareas, responsables, registro de tiempos, historial de actividad y reportes con gráficos.

## Qué incluye

- **Tableros** con grupos de tareas, en vista de **tabla** o **Kanban** (arrastrar y soltar entre estados).
- **Tareas y subtareas** con estado, prioridad, fechas, estimado en horas, descripción y comentarios.
- **Responsables**: una o varias personas por tarea. "Mis tareas" junta todo lo asignado a ti.
- **Registro de tiempos**: cronómetro (uno activo por persona, visible en la barra superior) o captura manual con nota.
- **Historial de actividad** por tarea y general, filtrable por tablero y persona.
- **Reportes**: horas por día o semana, por persona, por tablero y por tarea, tareas por estado, vencidas, y descarga de tiempos en CSV.
- **Notificaciones**: campanita en la app y correo (si se configura SMTP) cuando te asignan una tarea, comentan en tus tareas o te agregan a un tablero. Las invitaciones también se envían por correo.
- **Acceso**: Google para el personal de la empresa; invitaciones a personas externas con cualquier correo.

### Roles

| Rol | Puede |
| --- | --- |
| Administrador | Ver todos los tableros, cambiar roles, desactivar personas |
| Miembro | Crear tableros, invitar, trabajar en los tableros donde está |
| Invitado | Solo ver y trabajar en los tableros a los que lo agregan |

Los correos de `ADMIN_EMAILS` entran como Administrador. Cualquier otra persona, incluso de la empresa, necesita una invitación de un administrador (desde **Equipo**, eligiendo Miembro o Invitado), y puede entrar con su cuenta de Google si la tiene, o con un enlace por correo si se configura Resend.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · PostgreSQL + Prisma · Auth.js · Tailwind CSS 4 · Recharts.

## Desarrollo local

```bash
cp .env.example .env        # y completa DATABASE_URL, DATABASE_URL_UNPOOLED, AUTH_SECRET
# para probar sin Google: AUTH_DEV_LOGIN="true"
npm install
npx prisma migrate dev
npm run db:seed             # datos de ejemplo (borra lo que haya)
npm run dev
```

Con los datos de ejemplo, entra en el acceso de prueba con `admin@edificar.com` (o `ana.lopez@edificar.com`, `consultor@estudio-externo.com` para ver el rol de invitado). Ajusta `ALLOWED_DOMAINS="edificar.com"` y `ADMIN_EMAILS="admin@edificar.com"` para que coincidan.

## Despliegue en Vercel + Neon

1. **Neon**: crea un proyecto y una base `ritmo`. Lo más fácil es crearla desde Vercel (Infrastructure → Integrations → Create Database → Neon), que agrega `DATABASE_URL` y `DATABASE_URL_UNPOOLED` al proyecto.
2. **Google**: en Google Cloud Console crea un cliente OAuth de tipo "Aplicación web".
   - Orígenes autorizados: `https://TU-APP.vercel.app`
   - URI de redirección: `https://TU-APP.vercel.app/api/auth/callback/google`
   - En la pantalla de consentimiento usa tipo **Externo**, para que también puedan entrar invitados con Gmail.
3. **Resend** (opcional): crea una API key y verifica tu dominio para enviar los enlaces de acceso a invitados sin Google.
4. **Correo** (opcional): agrega `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`. Con Gmail usa `smtp.gmail.com`, puerto `465` y una clave de aplicación.
5. **Vercel**: importa el repositorio y agrega las variables de `.env.example` (sin `AUTH_DEV_LOGIN`). El comando de build ya aplica las migraciones (`prisma migrate deploy`).

## Estructura

```
prisma/schema.prisma        modelo de datos
prisma/seed.ts              datos de ejemplo
src/auth.ts                 inicio de sesión y reglas de acceso
src/lib/actions.ts          todas las acciones (crear, editar, tiempos, invitaciones) con su registro de actividad
src/lib/access.ts           quién puede ver y editar cada tablero
src/lib/reports.ts          cálculos de reportes
src/app/(app)/              pantallas: inicio, tableros, mis tareas, reportes, actividad, equipo
src/components/             tabla, Kanban, panel de tarea, gráficos
```
