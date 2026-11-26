import { redirect } from "next/navigation";
import { enabledProviders } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { devSignIn, emailSignIn, googleSignIn } from "@/lib/actions";
import { BrandMark } from "@/components/Logo";
import { APP_NAME } from "@/lib/constants";

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
    <main className="grid min-h-screen bg-[#0B0C0E] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Formulario */}
      <section className="relative flex flex-col bg-[#F4F5F6] px-6 py-10 sm:px-12 lg:rounded-r-[28px]">
        {/* Banner compacto para celular */}
        <MobileBanner />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
              <BrandMark size={28} />
            </span>
            <div className="leading-tight">
              <p className="text-lg font-semibold tracking-tight text-[#1d1f24]">{APP_NAME}</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b7079]">Constructora Edificar</p>
            </div>
          </div>
          <h1 className="mt-10 text-[26px] font-semibold leading-tight tracking-tight text-[#1d1f24]">Bienvenido a tu espacio de trabajo</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5b6068]">
            Entra con tu cuenta de Google de Edificar, o con el correo donde recibiste tu invitación.
          </p>

          {error && (
            <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors[error] ?? "No pudimos iniciar tu sesión. Intenta de nuevo."}
            </p>
          )}
          {check && (
            <p className="mt-6 rounded-lg border border-[#00A0E3]/30 bg-[#00A0E3]/10 px-3 py-2 text-sm text-[#005f87]">
              Te enviamos un enlace de acceso. Revisa tu correo.
            </p>
          )}

          <div className="mt-8 space-y-6">
            {google && (
              <form action={googleSignIn}>
                <button className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#d5d7db] bg-white py-2.5 text-sm font-medium text-[#1d1f24] shadow-sm transition hover:border-[#00A0E3] hover:shadow">
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
                <button className="w-full rounded-lg bg-[#00A0E3] py-2 text-sm font-medium text-white hover:bg-[#008cc7]">Enviarme un enlace de acceso</button>
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

          <p className="mt-10 flex items-center gap-2 text-[11px] text-[#8a8f97]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00A0E3]" />
            Acceso solo con invitación · Uso interno de Edificar
          </p>
        </div>
        <p className="mx-auto mt-8 w-full max-w-sm text-[11px] text-[#8a8f97]">
          © {new Date().getFullYear()} Constructora Edificar ·{" "}
          <a href="/privacidad" className="hover:text-[#00A0E3]">Privacidad</a>
        </p>
      </section>

      {/* Banner */}
      <Banner />
    </main>
  );
}

/** Retícula tipo plano técnico. */
function Blueprint({ id }: { id: string }) {
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id={`${id}-s`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#00A0E3" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
        <pattern id={`${id}-l`} width="120" height="120" patternUnits="userSpaceOnUse">
          <rect width="120" height="120" fill={`url(#${id}-s)`} />
          <path d="M120 0H0V120" fill="none" stroke="#00A0E3" strokeOpacity="0.16" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-l)`} />
    </svg>
  );
}

function Banner() {
  return (
    <section className="relative hidden overflow-hidden lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_35%,#0f2a3a_0%,#0B0C0E_60%)]" />
      <Blueprint id="bp" />
      {/* Símbolo de la marca, grande y en trazo, como un plano */}
      <svg viewBox="0 0 508 508" className="absolute -right-40 top-1/2 h-[78%] -translate-y-1/2 opacity-60" aria-hidden>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00A0E3" stopOpacity="0.55" />
            <stop offset="1" stopColor="#00A0E3" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <g fill="url(#g)" stroke="#00A0E3" strokeOpacity="0.7" strokeWidth="1.5">
          <polygon points="242,0 411,0 72,339 72,170" />
          <polygon points="242,170 411,170 242,339" />
          <polygon points="242,339 411,339 242,508 72,508" />
        </g>
        <g stroke="#6EC1E4" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="4 6" fill="none">
          <line x1="72" y1="-40" x2="72" y2="548" />
          <line x1="242" y1="-40" x2="242" y2="548" />
          <line x1="411" y1="-40" x2="411" y2="548" />
          <line x1="20" y1="170" x2="470" y2="170" />
          <line x1="20" y1="339" x2="470" y2="339" />
        </g>
      </svg>

      <div className="relative flex h-full flex-col justify-between p-14 text-white">
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-[#6EC1E4]">
          <span className="h-px w-10 bg-[#00A0E3]" />
          Gestión de proyectos · Edificar
        </div>

        <div className="max-w-lg">
          <p className="text-[40px] font-semibold leading-[1.1] tracking-tight">
            Cada obra,
            <br />
            <span className="text-[#00A0E3]">bajo control.</span>
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
            Planifica actividades, asigna responsables y mide el tiempo de cada equipo en un solo lugar, con la misma
            transparencia y eficiencia con la que construimos.
          </p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10">
            {[
              ["1984", "Construyendo desde"],
              ["+3,5 M", "m² en Centroamérica"],
              ["100%", "Trazabilidad por tarea"],
            ].map(([n, l]) => (
              <div key={l} className="bg-[#0B0C0E]/70 px-4 py-4 backdrop-blur">
                <p className="text-xl font-semibold text-white">{n}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/55">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-[12px] text-white/50">
          {["Tableros y tareas", "Registro de horas", "Reportes por proyecto"].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <span className="h-1 w-1 rotate-45 bg-[#00A0E3]" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileBanner() {
  return (
    <div className="relative -mx-6 -mt-10 mb-8 overflow-hidden bg-[#0B0C0E] px-6 py-8 text-white sm:-mx-12 sm:px-12 lg:hidden">
      <Blueprint id="bpm" />
      <BrandMark size={120} className="absolute -right-6 -top-4 opacity-25" />
      <p className="relative text-[11px] font-medium uppercase tracking-[0.22em] text-[#6EC1E4]">Constructora Edificar</p>
      <p className="relative mt-2 text-2xl font-semibold leading-tight">
        Cada obra, <span className="text-[#00A0E3]">bajo control.</span>
      </p>
    </div>
  );
}
