"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TaskStatus } from "@prisma/client";
import { formatMinutes, statusMeta } from "@/lib/constants";

const BAR = "#00A0E3";
const AXIS = { fontSize: 11, fill: "#66706d" };

type TipProps = { active?: boolean; payload?: { value: number; payload: { label: string } }[] };

function HoursTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{payload[0].payload.label}</p>
      <p className="text-muted">{formatMinutes(payload[0].value * 60)}</p>
    </div>
  );
}

const hours = (m: number) => Math.round((m / 60) * 100) / 100;

export function HoursOverTime({ data, height = 240 }: { data: { label: string; minutes: number }[]; height?: number }) {
  const rows = data.map((d) => ({ label: d.label, hours: hours(d.minutes) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="#eeece6" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e5e3dc" }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} unit=" h" allowDecimals={false} />
        <Tooltip content={<HoursTooltip />} cursor={{ fill: "rgba(0,160,227,0.08)" }} />
        <Bar animationDuration={400} dataKey="hours" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HoursRanking({ data }: { data: { label: string; minutes: number }[] }) {
  if (!data.length) return <Empty />;
  const rows = data.slice(0, 10).map((d) => ({ label: d.label, hours: hours(d.minutes) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 34 + 24)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={140} tick={{ ...AXIS, fill: "#1c2321" }} tickLine={false} axisLine={false} />
        <Tooltip content={<HoursTooltip />} cursor={{ fill: "rgba(0,160,227,0.08)" }} />
        <Bar
          dataKey="hours"
          fill={BAR}
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          label={{ position: "right", fontSize: 11, fill: "#66706d", formatter: (v: unknown) => `${v} h` }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusChart({ data }: { data: { status: TaskStatus; count: number }[] }) {
  const order: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE"];
  const rows = order.map((s) => ({ label: statusMeta(s).label, count: data.find((d) => d.status === s)?.count ?? 0, color: statusMeta(s).color }));
  if (!rows.some((r) => r.count)) return <Empty text="No hay tareas con estos filtros." />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={96} tick={{ ...AXIS, fill: "#1c2321" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.03)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
                <p className="font-medium">{(payload[0].payload as { label: string }).label}</p>
                <p className="text-muted">{String(payload[0].value)} tareas</p>
              </div>
            ) : null
          }
        />
        <Bar animationDuration={400} dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: "right", fontSize: 11, fill: "#66706d" }}>
          {rows.map((r) => (
            <Cell key={r.label} fill={r.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ text = "Sin tiempo registrado en este periodo." }: { text?: string }) {
  return <p className="py-10 text-center text-sm text-muted">{text}</p>;
}
