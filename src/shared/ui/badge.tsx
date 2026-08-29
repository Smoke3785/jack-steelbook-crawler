import type { ReactNode } from "react";

type Tone = "neutral" | "label" | "available" | "sold-out" | "new";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-zinc-800 text-zinc-300 ring-zinc-700",
  label: "bg-blue-950 text-blue-300 ring-blue-900",
  available:
    "bg-emerald-950 text-emerald-300 ring-emerald-900",
  "sold-out":
    "bg-rose-950 text-rose-300 ring-rose-900",
  new: "bg-amber-950 text-amber-300 ring-amber-900",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
