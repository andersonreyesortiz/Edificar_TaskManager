export function Logo({ size = 28, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#0f6e60" />
        <rect x="7" y="17" width="4" height="8" rx="2" fill="#94e9d6" />
        <rect x="14" y="11" width="4" height="14" rx="2" fill="#c9f5ea" />
        <rect x="21" y="7" width="4" height="18" rx="2" fill="#ffffff" />
      </svg>
      {withText && <span className="text-lg font-semibold tracking-tight">Ritmo</span>}
    </span>
  );
}
