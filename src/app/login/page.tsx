import { redirect } from "next/navigation";
import { enabledProviders } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { devSignIn, emailSignIn, googleSignIn } from "@/lib/actions";
import { Logo } from "@/components/Logo";

const errors: Record<string, string> = {
  AccessDenied: "Tu correo no tiene acceso. Pide a un administrador que te invite.",
  CredentialsSignin: "Tu correo no tiene acceso. Pide a un administrador que te invite.",
  Verification: "El enlace ya expiró o ya se usó. Pide uno nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check?: string; email?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { error, check, email } = await searchParams;
  const { google, email: emailEnabled, dev } = enabledProviders;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Logo size={36} />
          <h1 className="mt-10 text-2xl font-semibold">Entra a tu espacio de trabajo</h1>
          <p className="mt-2 text-sm text-muted">
            Usa tu cuenta de Google de la empresa. Si te invitaron desde fuera, entra con el correo donde recibiste la invitación.
          </p>

          {error && (
            <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors[error] ?? "No pudimos iniciar tu sesión. Intenta de nuevo."}
            </p>
          )}
          {check && (
            <p className="mt-6 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
              Te enviamos un enlace de acceso. Revisa tu correo.
            </p>
          )}

          <div className="mt-8 space-y-6">
            {google && (
              <form action={googleSignIn}>
                <button className="btn-outline w-full py-2.5">
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                  </svg>
                  Continuar con Google
                </button>
              </form>
            )}

            {emailEnabled && (
              <form action={emailSignIn} className="space-y-2">
                <label className="label" htmlFor="email">¿No usas Google? Te enviamos un enlace</label>
                <input id="email" name="email" type="email" required defaultValue={email} placeholder="tu@correo.com" className="input" />
                <button className="btn-primary w-full py-2">Enviarme un enlace de acceso</button>
              </form>
            )}

            {dev && (
              <form action={devSignIn} className="space-y-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-800">Acceso de prueba (solo en desarrollo)</p>
                <input name="email" type="email" required defaultValue={email} placeholder="admin@edificar.com" className="input" />
                <button className="btn-outline w-full">Entrar sin contraseña</button>
              </form>
            )}

            {!google && !emailEnabled && !dev && (
              <p className="text-sm text-red-700">
                No hay ningún método de acceso configurado. Revisa las variables AUTH_GOOGLE_ID y AUTH_RESEND_KEY.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #14a38b 0, transparent 45%), radial-gradient(circle at 80% 70%, #2563eb 0, transparent 40%)" }} />
        <div className="relative flex h-full flex-col justify-end p-16 text-white">
          <p className="max-w-md text-3xl font-semibold leading-tight">Planifica, asigna y mide el tiempo de cada actividad, todo en un mismo lugar.</p>
          <ul className="mt-8 space-y-2 text-sm text-brand-100">
            <li>Tableros con tareas y subtareas</li>
            <li>Responsables, fechas y prioridades</li>
            <li>Cronómetro y registro de horas</li>
            <li>Reportes con gráficos por persona y proyecto</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
