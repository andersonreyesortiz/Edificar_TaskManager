"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Square } from "lucide-react";
import { stopTimer } from "@/lib/actions";

export function elapsed(fromIso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function RunningTimer({ startedAt, taskTitle, href }: { startedAt: string; taskTitle: string; href: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-1 text-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600" />
      </span>
      <Link href={href} className="max-w-48 truncate text-brand-900 hover:underline">{taskTitle}</Link>
      <span className="font-mono tabular-nums text-brand-900">{elapsed(startedAt, now)}</span>
      <button
        onClick={() => start(() => stopTimer())}
        disabled={pending}
        className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-700 px-2.5 text-xs font-medium text-white hover:bg-brand-600"
      >
        <Square size={11} fill="currentColor" /> Detener
      </button>
    </div>
  );
}
