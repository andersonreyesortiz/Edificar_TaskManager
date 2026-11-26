"use client";

import { LogOut, Repeat } from "lucide-react";
import { doSignOut } from "@/lib/actions";
import { Popover } from "@/components/Popover";
import { Avatar } from "@/components/Avatar";

/** Menú de la persona en la barra superior: ver con qué cuenta entró, cambiar de usuario o salir. */
export function UserMenu({ name, email, image, role }: { name: string | null; email: string; image: string | null; role: string }) {
  return (
    <Popover
      align="right"
      width={260}
      trigger={() => (
        <button className="flex items-center rounded-full ring-offset-2 hover:ring-2 hover:ring-line" title="Tu cuenta">
          <Avatar name={name} email={email} image={image} size={30} />
        </button>
      )}
    >
      {() => (
        <div className="text-sm">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={name} email={email} image={image} size={36} />
            <div className="min-w-0">
              <p className="truncate font-medium">{name ?? email}</p>
              <p className="truncate text-xs text-muted">{email}</p>
              <p className="text-[11px] text-muted">{role}</p>
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          <form action={doSignOut}>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-canvas">
              <Repeat size={15} className="text-muted" /> Cambiar de usuario
            </button>
          </form>
          <form action={doSignOut}>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-red-600 hover:bg-red-50">
              <LogOut size={15} /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}
