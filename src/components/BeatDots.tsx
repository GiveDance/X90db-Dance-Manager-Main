"use client";

import { cn } from "@/lib/cn";
import { BEATS_PER_SEGMENT } from "@/lib/segments";

interface BeatDotsProps {
  activeBeat: number;
  segmentNumber: number | null;
  musicStarted: boolean;
  orientation: "horizontal" | "vertical";
}

export function BeatDots({
  activeBeat,
  segmentNumber,
  musicStarted,
  orientation,
}: BeatDotsProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 items-center justify-center gap-2",
        orientation === "vertical" ? "flex-col" : "flex-row",
      )}
    >
      {Array.from({ length: BEATS_PER_SEGMENT }).map((_, index) => {
        const isActive = index === activeBeat;
        const isStrong = index === 0;
        const label = isStrong && segmentNumber != null
          ? segmentNumber
          : index + 1;

        return (
          <div
            key={index}
            className={cn(
              "flex shrink-0 items-center justify-center gap-1.5",
              orientation === "vertical" ? "flex-row" : "flex-col",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-100",
                !musicStarted && !isActive && isStrong && "border-neutral-500 bg-neutral-600/25",
                !musicStarted && !isActive && !isStrong && "border-neutral-700 bg-neutral-800/80",
                !musicStarted && isActive && "scale-110 border-neutral-300 bg-gradient-to-br from-neutral-500 to-neutral-700 shadow-[0_0_14px_3px_rgba(163,163,163,0.55)]",
                musicStarted && isStrong && !isActive && "border-pink-500/55 bg-pink-500/10",
                musicStarted && !isStrong && !isActive && "border-blue-500/45 bg-blue-500/10",
                musicStarted && isStrong && isActive && "scale-110 border-pink-300 bg-gradient-to-br from-pink-500 to-purple-600 shadow-[0_0_14px_3px_rgba(219,39,119,0.72)]",
                musicStarted && !isStrong && isActive && "scale-110 border-cyan-300 bg-gradient-to-br from-blue-600 to-cyan-400 shadow-[0_0_12px_2px_rgba(37,99,235,0.7)]",
              )}
            />
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums transition-colors",
                !musicStarted
                  ? isActive
                    ? "text-neutral-100"
                    : isStrong
                      ? "text-neutral-400"
                      : "text-neutral-500"
                  : isStrong
                    ? isActive
                      ? "text-pink-200"
                      : "text-pink-300/55"
                    : isActive
                      ? "text-blue-200"
                      : "text-blue-300/45",
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
