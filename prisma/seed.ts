/**
 * Datos de ejemplo para desarrollo. Ejecuta: npm run db:seed
 * Borra todo y crea un equipo, dos tableros, tareas, subtareas y tiempos.
 */
import { PrismaClient, type Priority, type TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

const daysAgo = (n: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setUTCHours(hour + 6, 0, 0, 0); // hora de Guatemala (UTC-6)
  return d;
};

async function main() {
  // El historial está protegido en la base de datos; para los datos de prueba se permite vaciarlo.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('edificar.audit_override', 'on', true)`;
    await tx.activity.deleteMany();
  });
  await prisma.timeEntry.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.group.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();

  const [admin, ana, carlos, lucia, externo] = await Promise.all(
    [
      { email: "admin@edificar.com", name: "Administrador", role: "ADMIN" as const },
      { email: "ana.lopez@edificar.com", name: "Ana López", role: "MEMBER" as const },
      { email: "carlos.mendez@edificar.com", name: "Carlos Méndez", role: "MEMBER" as const },
      { email: "lucia.ramirez@edificar.com", name: "Lucía Ramírez", role: "MEMBER" as const },
      { email: "consultor@estudio-externo.com", name: "Consultor Externo", role: "GUEST" as const },
    ].map((u) => prisma.user.create({ data: { ...u, emailVerified: new Date() } })),
  );

  type Seed = {
    title: string;
    status: TaskStatus;
    priority: Priority;
    due?: number;
    who: string[];
    est?: number;
    subs?: { title: string; status: TaskStatus; who: string[] }[];
    time?: [string, number, number][]; // [userId, díasAtrás, minutos]
  };

  async function board(name: string, description: string, color: string, members: string[], groups: { name: string; color: string; tasks: Seed[] }[]) {
    const b = await prisma.board.create({
      data: { name, description, color, ownerId: admin.id, members: { create: members.map((userId) => ({ userId, role: userId === externo.id || userId === lucia.id ? ("COLLABORATOR" as const) : ("EDITOR" as const) })) } },
    });
    await prisma.activity.create({ data: { userId: admin.id, boardId: b.id, action: "board.created", detail: `creó el tablero «${name}»`, createdAt: daysAgo(21) } });
    for (const [gi, g] of groups.entries()) {
      const group = await prisma.group.create({ data: { boardId: b.id, name: g.name, color: g.color, position: gi } });
      for (const [ti, t] of g.tasks.entries()) {
        const task = await prisma.task.create({
          data: {
            boardId: b.id,
            groupId: group.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            position: ti,
            createdById: admin.id,
            estimateMinutes: t.est ? t.est * 60 : null,
            dueDate: t.due !== undefined ? daysAgo(-t.due, 12) : null,
            completedAt: t.status === "DONE" ? daysAgo(Math.floor(Math.random() * 14)) : null,
            createdAt: daysAgo(20),
            assignees: { create: t.who.map((userId) => ({ userId, assignedById: admin.id })) },
          },
        });
        await prisma.activity.create({ data: { userId: admin.id, boardId: b.id, taskId: task.id, action: "task.created", detail: `creó la tarea «${t.title}»`, createdAt: daysAgo(20) } });
        for (const [si, s] of (t.subs ?? []).entries()) {
          await prisma.task.create({
            data: {
              boardId: b.id,
              groupId: group.id,
              parentId: task.id,
              title: s.title,
              status: s.status,
              position: si,
              createdById: admin.id,
              assignees: { create: s.who.map((userId) => ({ userId })) },
            },
          });
        }
        for (const [userId, ago, minutes] of t.time ?? []) {
          const startedAt = daysAgo(ago, 8 + (minutes % 5));
          await prisma.timeEntry.create({
            data: { taskId: task.id, userId, startedAt, endedAt: new Date(startedAt.getTime() + minutes * 60000), minutes },
          });
          await prisma.activity.create({
            data: { userId, boardId: b.id, taskId: task.id, action: "time.manual", detail: `registró ${minutes} min en «${t.title}»`, createdAt: startedAt },
          });
        }
      }
    }
    return b;
  }

  const torre = await board(
    "Proyecto Torre Norte",
    "Diseño y coordinación del edificio de oficinas, fase de anteproyecto.",
    "#0f766e",
    [admin.id, ana.id, carlos.id, lucia.id, externo.id],
    [
      {
        name: "Diseño",
        color: "#6366f1",
        tasks: [
          {
            title: "Planos arquitectónicos de planta tipo",
            status: "IN_PROGRESS",
            priority: "HIGH",
            due: 4,
            who: [ana.id],
            est: 24,
            subs: [
              { title: "Distribución de núcleos", status: "DONE", who: [ana.id] },
              { title: "Fachada norte", status: "IN_PROGRESS", who: [ana.id] },
              { title: "Revisión con estructura", status: "TODO", who: [carlos.id] },
            ],
            time: [[ana.id, 1, 180], [ana.id, 2, 240], [ana.id, 5, 150], [ana.id, 8, 200], [carlos.id, 3, 60]],
          },
          {
            title: "Modelo estructural preliminar",
            status: "REVIEW",
            priority: "URGENT",
            due: 1,
            who: [carlos.id],
            est: 16,
            time: [[carlos.id, 1, 210], [carlos.id, 4, 300], [carlos.id, 6, 240], [carlos.id, 11, 120]],
          },
          {
            title: "Memoria descriptiva",
            status: "TODO",
            priority: "MEDIUM",
            due: 10,
            who: [lucia.id],
          },
        ],
      },
      {
        name: "Instalaciones",
        color: "#0ea5e9",
        tasks: [
          {
            title: "Cálculo de cargas eléctricas",
            status: "BLOCKED",
            priority: "HIGH",
            due: -2,
            who: [externo.id, lucia.id],
            est: 8,
            time: [[externo.id, 6, 120], [lucia.id, 9, 90]],
          },
          {
            title: "Red hidrosanitaria",
            status: "DONE",
            priority: "MEDIUM",
            who: [lucia.id],
            est: 10,
            time: [[lucia.id, 10, 240], [lucia.id, 12, 300], [lucia.id, 13, 180]],
          },
        ],
      },
    ],
  );

  // Columnas personalizadas de ejemplo
  const fase = { listo: "l1", proceso: "l2", detenido: "l3" };
  const [colFase, colCosto, colRev] = await Promise.all([
    prisma.boardColumn.create({ data: { boardId: torre.id, name: "Fase", type: "STATUS", position: 0, settings: { labels: [
      { id: fase.listo, name: "Aprobado", color: "#00c875" }, { id: fase.proceso, name: "En diseño", color: "#fdab3d" }, { id: fase.detenido, name: "Observado", color: "#e2445c" },
    ] } } }),
    prisma.boardColumn.create({ data: { boardId: torre.id, name: "Costo estimado", type: "NUMBER", position: 1, settings: { unit: "Q" } } }),
    prisma.boardColumn.create({ data: { boardId: torre.id, name: "Revisado", type: "CHECKBOX", position: 2, settings: {} } }),
  ]);
  const torreTasks = await prisma.task.findMany({ where: { boardId: torre.id, parentId: null }, orderBy: { createdAt: "asc" } });
  for (const [i, t] of torreTasks.entries()) {
    await prisma.taskColumnValue.createMany({ data: [
      { taskId: t.id, columnId: colFase.id, value: [fase.proceso, fase.listo, fase.detenido][i % 3] },
      { taskId: t.id, columnId: colCosto.id, value: 12500 + i * 4300 },
      ...(i % 2 ? [{ taskId: t.id, columnId: colRev.id, value: true }] : []),
    ] });
  }

  await board(
    "Licitación Residencial Las Flores",
    "Preparación de la propuesta técnica y económica.",
    "#7c3aed",
    [admin.id, ana.id, carlos.id],
    [
      {
        name: "Propuesta",
        color: "#8b5cf6",
        tasks: [
          { title: "Presupuesto de obra gris", status: "IN_PROGRESS", priority: "HIGH", due: 6, who: [carlos.id], est: 12, time: [[carlos.id, 0, 90], [carlos.id, 2, 150]] },
          { title: "Cronograma general", status: "TODO", priority: "MEDIUM", due: 8, who: [ana.id] },
          { title: "Documentos legales", status: "DONE", priority: "LOW", who: [admin.id], time: [[admin.id, 7, 60], [admin.id, 15, 45]] },
        ],
      },
    ],
  );

  console.log("Datos de ejemplo creados. Entra con admin@edificar.com en el acceso de prueba.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
