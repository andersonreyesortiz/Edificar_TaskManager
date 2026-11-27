import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessBoard } from "@/lib/access";
import { notify } from "@/lib/notify";
import { esc } from "@/lib/mailer";

/** Menciones con el formato @correo@dominio.com */
export const MENTION_RE = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

export function extractMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase().replace(/[.]+$/, "")))];
}

/**
 * Avisa (campanita y correo) a las personas mencionadas que tengan acceso al tablero.
 * Con `previous`, solo avisa a las menciones nuevas (útil al editar la descripción).
 * Devuelve los ids avisados.
 */
export async function notifyMentions(
  actor: User,
  task: { id: string; title: string; boardId: string },
  text: string,
  where: "comentario" | "descripción",
  previous?: string | null,
) {
  const before = new Set(extractMentions(previous));
  const emails = extractMentions(text).filter((e) => !before.has(e));
  if (!emails.length) return [];
  const users = await prisma.user.findMany({ where: { email: { in: emails }, active: true } });
  const allowed: string[] = [];
  for (const u of users) if (u.id !== actor.id && (await canAccessBoard(u, task.boardId))) allowed.push(u.id);
  if (!allowed.length) return [];
  await notify(actor, allowed, {
    text: `te mencionó en ${where === "comentario" ? "un comentario de" : "la descripción de"} «${task.title}»`,
    link: `/boards/${task.boardId}?task=${task.id}`,
    subject: `Te mencionaron en «${task.title}»`,
    detailHtml: `<p style="background:#f6f5f1;padding:10px 12px;border-radius:8px">${esc(text.trim()).replace(/\n/g, "<br>")}</p>`,
    cta: "Ver tarea",
  });
  return allowed;
}
