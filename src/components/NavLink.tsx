"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CheckSquare, Clock, Home, LayoutDashboard, Users } from "lucide-react";
import clsx from "clsx";

const icons = { dashboard: LayoutDashboard, home: Home, check: CheckSquare, chart: BarChart3, clock: Clock, users: Users };

export function NavLink({
  href,
  icon,
  color,
  children,
}: {
  href: string;
  icon?: keyof typeof icons;
  color?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  const Icon = icon ? icons[icon] : null;
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2.5 rounded-lg px-2 py-1.5",
        active ? "bg-brand-50 font-medium text-brand-900" : "text-ink/80 hover:bg-black/5",
      )}
    >
      {Icon && <Icon size={16} className={active ? "text-brand-700" : "text-muted"} />}
      {color && <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: color }} />}
      <span className="truncate">{children}</span>
    </Link>
  );
}
