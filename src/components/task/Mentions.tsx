"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";

type P = { id: string; name: string | null; email: string; image: string | null };

const MENTION_SPLIT = /(@[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

/** Texto con las menciones resaltadas (muestra el nombre si la persona es del tablero). */
export function MentionText({ text, people }: { text: string; people: P[] }) {
  return (
    <>
      {text.split(MENTION_SPLIT).map((part, i) => {
        if (i % 2 === 0) return part;
        const email = part.slice(1).toLowerCase();
        const p = people.find((x) => x.email.toLowerCase() === email);
        return (
          <span key={i} title={email} className="rounded bg-[#00A0E3]/10 px-1 font-medium text-[#006a97]">
            @{p?.name ?? email}
          </span>
        );
      })}
    </>
  );
}

/**
 * Área de texto que sugiere personas al escribir «@» e inserta su correo (@persona@empresa.com).
 * Las personas mencionadas reciben un aviso en la app y por correo.
 */
export function MentionTextarea({
  value,
  onChange,
  people,
  onSubmitShortcut,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  people: P[];
  onSubmitShortcut?: () => void;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);

  const detect = (v: string, caret: number) => {
    const before = v.slice(0, caret);
    const m = before.match(/(^|\s)@([^\s@]*)$/);
    setQuery(m ? { start: caret - m[2].length - 1, text: m[2].toLowerCase() } : null);
    setActive(0);
  };
  const matches = query
    ? people.filter((p) => (p.name ?? "").toLowerCase().includes(query.text) || p.email.toLowerCase().includes(query.text)).slice(0, 6)
    : [];

  const pick = (p: P) => {
    if (!query || !ref.current) return;
    const caret = ref.current.selectionStart ?? value.length;
    const insert = `@${p.email} `;
    const next = value.slice(0, query.start) + insert + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = query.start + insert.length;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (matches.length) {
            if (e.key === "ArrowDown") return e.preventDefault(), setActive((a) => (a + 1) % matches.length);
            if (e.key === "ArrowUp") return e.preventDefault(), setActive((a) => (a - 1 + matches.length) % matches.length);
            if (e.key === "Enter" || e.key === "Tab") return e.preventDefault(), pick(matches[active]);
            if (e.key === "Escape") return setQuery(null);
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmitShortcut) {
            e.preventDefault();
            onSubmitShortcut();
          }
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        className="input"
        {...rest}
      />
      {matches.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-lg">
          {matches.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${i === active ? "bg-canvas" : "hover:bg-canvas"}`}
              >
                <Avatar name={p.name} email={p.email} image={p.image} size={22} />
                <span className="min-w-0 flex-1 truncate">{p.name ?? p.email}</span>
                <span className="truncate text-xs text-muted">{p.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
