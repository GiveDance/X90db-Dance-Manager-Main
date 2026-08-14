"use client";

import { cn } from "@/lib/cn";

export function Toggle({
  checked,
  onChange,
  label,
  accent = "blue",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  accent?: "blue" | "violet";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2",
        accent === "violet"
          ? "focus-visible:ring-violet-400"
          : "focus-visible:ring-blue-400",
        checked
          ? accent === "violet"
            ? "bg-violet-500"
            : "bg-blue-500"
          : "bg-neutral-600",
      )}
    >
      <span
        className={cn(
          "absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
