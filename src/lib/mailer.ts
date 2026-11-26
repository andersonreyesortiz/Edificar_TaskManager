import { APP_NAME } from "@/lib/constants";
import nodemailer from "nodemailer";

/** Envío de correos por SMTP. Si no hay SMTP configurado, no hace nada. */
export const mailEnabled = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (!mailEnabled) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export function appUrl(path = "") {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function layout(title: string, body: string, cta?: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f5f1;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#1c2321">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-weight:600;font-size:18px;color:#00A0E3">${APP_NAME}</div>
    <div style="background:#fff;border:1px solid #e5e3dc;border-radius:12px;padding:24px;margin-top:16px">
      <h1 style="font-size:18px;margin:0 0 12px">${esc(title)}</h1>
      <div style="font-size:14px;line-height:1.6">${body}</div>
      ${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.href)}" style="background:#00A0E3;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;display:inline-block">${esc(cta.label)}</a></p>` : ""}
    </div>
    <p style="font-size:12px;color:#66706d;margin-top:16px">Recibes este correo porque usas ${APP_NAME}, el gestor de tareas de tu equipo.</p>
  </div></body></html>`;
}

export async function sendMail(to: string, subject: string, title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM ?? `${APP_NAME} <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: layout(title, bodyHtml, cta),
      text: `${title}\n\n${bodyHtml.replace(/<[^>]+>/g, "")}${cta ? `\n\n${cta.label}: ${cta.href}` : ""}`,
    });
    return true;
  } catch (e) {
    console.error("[mail] no se pudo enviar", e);
    return false;
  }
}

export { esc };
