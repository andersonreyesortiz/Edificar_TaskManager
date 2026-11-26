import { APP_NAME } from "@/lib/constants";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Nodemailer from "next-auth/providers/nodemailer";
import { esc, mailEnabled, sendMail } from "@/lib/mailer";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultRoleFor } from "@/lib/access-rules";

/**
 * Decide si un correo puede entrar:
 *  (los correos de la empresa también necesitan invitación)
 *  - correos de administradores (ADMIN_EMAILS)
 *  - cualquier correo con invitación
 *  - usuarios que ya existen y siguen activos
 */
async function canSignIn(email: string | null | undefined) {
  if (!email) return false;
  const e = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: e } });
  if (existing) return existing.active;
  if (defaultRoleFor(e)) return true;
  const invite = await prisma.invitation.findUnique({ where: { email: e } });
  return Boolean(invite);
}

/** Aplica la invitación pendiente (rol y tablero) la primera vez que alguien entra. */
async function applyInvitation(userId: string, email: string, isNewUser: boolean) {
  const e = email.toLowerCase();
  const invite = await prisma.invitation.findUnique({ where: { email: e } });
  if (isNewUser) {
    const role: Role | null = defaultRoleFor(e) ?? invite?.role ?? null;
    if (role) await prisma.user.update({ where: { id: userId }, data: { role } });
  }
  if (invite && !invite.acceptedAt) {
    await prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    if (invite.boardId) {
      await prisma.boardMember.upsert({
        where: { boardId_userId: { boardId: invite.boardId, userId } },
        create: { boardId: invite.boardId, userId },
        update: {},
      });
    }
  }
}

const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({
      allowDangerousEmailAccountLinking: true,
      // Siempre deja elegir la cuenta de Google, para poder cambiar de usuario.
      authorization: { params: { prompt: "select_account" } },
    }));
}

if (process.env.AUTH_RESEND_KEY) {
  providers.push(
    Resend({
      from: process.env.AUTH_EMAIL_FROM ?? `${APP_NAME} <no-reply@resend.dev>`,
    }),
  );
}

// Enlace de acceso por correo usando el mismo SMTP de las notificaciones.
// Solo llega a correos con invitación (el callback signIn lo revisa antes de enviar).
if (mailEnabled && !process.env.AUTH_RESEND_KEY) {
  providers.push(
    Nodemailer({
      server: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: Number(process.env.SMTP_PORT ?? 465) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      },
      from: process.env.MAIL_FROM ?? `${APP_NAME} <${process.env.SMTP_USER}>`,
      maxAge: 30 * 60,
      async sendVerificationRequest({ identifier, url }) {
        const ok = await sendMail(
          identifier,
          `Tu enlace para entrar a ${APP_NAME}`,
          "Tu enlace de acceso",
          `<p>Usa este botón para entrar a ${APP_NAME} como <b>${esc(identifier)}</b>.</p>
           <p>El enlace funciona una sola vez y vence en 30 minutos. Si no lo pediste, ignora este correo.</p>`,
          { label: `Entrar a ${APP_NAME}`, href: url },
        );
        if (!ok) throw new Error("No se pudo enviar el enlace de acceso");
      },
    }),
  );
}

export const emailProviderId = process.env.AUTH_RESEND_KEY ? "resend" : "nodemailer";

export const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "true";

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Acceso de desarrollo",
      credentials: { email: { label: "Correo", type: "email" } },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        if (!(await canSignIn(email))) return null;
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email, name: email.split("@")[0], emailVerified: new Date() },
          });
          await applyInvitation(user.id, email, true);
        }
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login", verifyRequest: "/login?check=1", error: "/login" },
  providers,
  callbacks: {
    async signIn({ user, profile }) {
      const email = user.email ?? profile?.email;
      return canSignIn(email);
    },
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id && user.email) await applyInvitation(user.id, user.email, true);
    },
    async signIn({ user }) {
      // Si la persona ya existía y luego la invitaron a un tablero, se aplica aquí.
      if (user.id && user.email) await applyInvitation(user.id, user.email, false);
    },
  },
});

export const enabledProviders = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  email: Boolean(process.env.AUTH_RESEND_KEY) || mailEnabled,
  dev: devLoginEnabled,
};
