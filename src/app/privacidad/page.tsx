import Link from "next/link";
import { Logo } from "@/components/Logo";

import { APP_NAME } from "@/lib/constants";

export const metadata = { title: `Privacidad · ${APP_NAME}` };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed">
      <Link href="/login"><Logo /></Link>
      <h1 className="mt-8 text-2xl font-semibold">Política de privacidad</h1>
      <p className="mt-4">
        {APP_NAME} es la herramienta interna de gestión de tareas de Edificar. Solo pueden usarla el personal de la empresa y las
        personas invitadas por un administrador.
      </p>
      <h2 className="mt-6 font-semibold">Qué datos usamos</h2>
      <p className="mt-2">
        Al iniciar sesión con Google recibimos tu nombre, tu correo y tu foto de perfil. Además guardamos lo que registras en la
        aplicación: tareas, comentarios, tiempos y el historial de cambios.
      </p>
      <h2 className="mt-6 font-semibold">Para qué los usamos</h2>
      <p className="mt-2">
        Solo para identificarte dentro de la aplicación y mostrar el trabajo del equipo. No vendemos ni compartimos tus datos con
        terceros, ni los usamos para publicidad.
      </p>
      <h2 className="mt-6 font-semibold">Contacto y eliminación</h2>
      <p className="mt-2">
        Para consultar o eliminar tus datos, escribe al administrador de la aplicación en Edificar.
      </p>
    </main>
  );
}
