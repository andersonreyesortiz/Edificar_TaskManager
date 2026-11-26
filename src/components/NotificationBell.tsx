"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/lib/actions";
import { Avatar } from "@/components/Avatar";

export type BellItem = {
  id: string;
  text: string;
  link: string | null;
  read: boolean;
  when: string;
  actor: { name: string | null; email: string; image: string | null } | null;
};

export function NotificationBell({ items, unread }: { items: BellItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-muted hover:bg-black/5 hover:text-ink"
        title="Notificaciones"
        aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">Notificaciones</p>
            {unread > 0 && (
              <button onClick={() => start(() => markNotificationsRead())} className="text-xs font-medium text-brand-700 hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link ?? "#"}
                  onClick={() => {
                    setOpen(false);
                    if (!n.read) start(() => markNotificationsRead([n.id]));
                  }}
                  className={`flex gap-3 px-4 py-3 hover:bg-canvas ${n.read ? "" : "bg-brand-50/60"}`}
                >
                  {n.actor ? <Avatar name={n.actor.name} email={n.actor.email} image={n.actor.image} size={28} /> : <span className="w-7" />}
                  <div className="min-w-0 flex-1 text-sm">
                    <p>
                      <span className="font-medium">{n.actor?.name ?? n.actor?.email ?? "Alguien"}</span> {n.text}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{n.when}</p>
                  </div>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                </Link>
              </li>
            ))}
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">No tienes notificaciones.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
