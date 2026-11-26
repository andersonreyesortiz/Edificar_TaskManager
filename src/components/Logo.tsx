import { APP_NAME } from "@/lib/constants";

/** Símbolo de Edificar (tres piezas geométricas azules). */
export function BrandMark({ size = 28, color = "#00A0E3", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 508 508" aria-hidden className={className}>
      <g fill={color}>
        <polygon points="242,0 411,0 72,339 72,170" />
        <polygon points="242,170 411,170 242,339" />
        <polygon points="242,339 411,339 242,508 72,508" />
      </g>
    </svg>
  );
}

export function Logo({ size = 28, withText = true, dark = false }: { size?: number; withText?: boolean; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center rounded-lg"
        style={{ width: size, height: size, background: dark ? "rgba(255,255,255,0.08)" : "#E6E7E8" }}
      >
        <BrandMark size={size * 0.72} />
      </span>
      {withText && <span className={`text-lg font-semibold tracking-tight ${dark ? "text-white" : ""}`}>{APP_NAME}</span>}
    </span>
  );
}
