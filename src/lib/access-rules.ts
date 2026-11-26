import type { Role } from "@prisma/client";

function list(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export function companyDomains() {
  return list(process.env.ALLOWED_DOMAINS);
}

export function adminEmails() {
  return list(process.env.ADMIN_EMAILS);
}

export function isCompanyEmail(email: string) {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return companyDomains().includes(domain);
}

/** Rol que recibe una persona nueva según su correo (si no tiene invitación). */
export function defaultRoleFor(email: string): Role | null {
  const e = email.toLowerCase();
  if (adminEmails().includes(e)) return "ADMIN";
  if (isCompanyEmail(e)) return "MEMBER";
  return null;
}
