const palette = ["#0f6e60", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#ca8a04", "#0891b2", "#4d7c0f"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name?: string | null, email?: string | null) {
  const base = (name || email || "?").trim();
  const parts = base.split(/[\s._@-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({
  name,
  email,
  image,
  size = 28,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
}) {
  const label = name || email || "";
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={label} title={label} width={size} height={size} className="rounded-full ring-2 ring-white" />;
  }
  return (
    <span
      title={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: palette[hash(label) % palette.length] }}
    >
      {initials(name, email)}
    </span>
  );
}
