import { APP_NAME } from "@/lib/constants";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appUrl, esc, sendMail } from "@/lib/mailer";

type Notice = {
  /** Texto corto, sin el nombre de quien lo hizo (se antepone). */
  text: string;
  link: string;
  subject: string;
  detailHtml?: string;
  cta: string;
};

/** Crea avisos en la app y envía correo (si está configurado) a cada destinatario, excepto a quien hizo la acción. */
export async function notify(actor: User, recipientIds: string[], n: Notice) {
  const ids = [...new Set(recipientIds)].filter((id) => id !== actor.id);
  if (!ids.length) return;
  const recipients = await prisma.user.findMany({ where: { id: { in: ids }, active: true } });
  if (!recipients.length) return;
  await prisma.notification.createMany({
    data: recipients.map((r) => ({ userId: r.id, actorId: actor.id, text: n.text, link: n.link })),
  });
  const who = actor.name ?? actor.email;
  await Promise.all(
    recipients.map((r) =>
      sendMail(
        r.email,
        n.subject,
        `${who} ${n.text}`,
        n.detailHtml ?? "",
        { label: n.cta, href: appUrl(n.link) },
      ),
    ),
  );
}

export async function sendInvitationEmail(inviter: User, email: string, boardName?: string | null) {
  const who = esc(inviter.name ?? inviter.email);
  return sendMail(
    email,
    `${inviter.name ?? inviter.email} te invitó a ${APP_NAME}`,
    `Te invitaron a ${APP_NAME}`,
    `<p>${who} te invitó a colaborar en ${APP_NAME}, el gestor de tareas de su equipo${boardName ? `, en el tablero <b>${esc(boardName)}</b>` : ""}.</p>
     <p>Entra con tu cuenta de Google usando este mismo correo: <b>${esc(email)}</b>.</p>`,
    { label: "Aceptar invitación", href: appUrl(`/login?email=${encodeURIComponent(email)}`) },
  );
}
