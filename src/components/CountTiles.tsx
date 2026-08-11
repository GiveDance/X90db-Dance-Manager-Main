"use client";

import { cn } from "@/lib/cn";

interface CountTilesProps {
  activeBeat: number;
  segmentNumber: number | null;
  phase: number;
  active: boolean;
  isPlaying: boolean;
  musicStarted: boolean;
  secondsPerBeat: number;
  orientation: "horizontal" | "vertical";
}

const TILE_COUNT = 4;
const FLASH_DURATION_SECONDS = 0.22;

export function CountTiles({
  activeBeat,
  segmentNumber,
  phase,
  active,
  isPlaying,
  musicStarted,
  secondsPerBeat,
  orientation,
}: CountTilesProps) {
  const isSecondHalf = activeBeat >= 4;
  const activeTile = active && activeBeat >= 0
    ? activeBeat % TILE_COUNT
    : -1;
  const elapsedInBeat = phase * secondsPerBeat;
  const isFlashing = isPlaying && elapsedInBeat <= FLASH_DURATION_SECONDS;
  const labels = isSecondHalf
    ? ["5", "6", "7", "8"]
    : [String(segmentNumber ?? 1), "2", "3", "4"];

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 gap-2.5",
        orientation === "vertical" ? "flex-col" : "flex-row",
      )}
    >
      {Array.from({ length: TILE_COUNT }).map((_, index) => {
        const isStrong = !isSecondHalf && index === 0;
        const isActive = isFlashing && index === activeTile;

        return (
          <div
            key={index}
            className={cn(
              "relative flex min-h-10 min-w-10 flex-1 items-center justify-center rounded-[14px] border font-extrabold tracking-[-0.035em] tabular-nums transition-[filter] duration-75",
              orientation === "vertical"
                ? "text-[clamp(28px,4vw,58px)]"
                : "text-[clamp(24px,3vw,44px)]",
              !musicStarted && !isActive && isStrong && "border-neutral-500 bg-neutral-600/25",
              !musicStarted && !isActive && !isStrong && "border-neutral-700 bg-neutral-800/80",
              !musicStarted && isActive && "border-transparent bg-gradient-to-br from-neutral-500 to-neutral-700 text-white shadow-[0_0_34px_rgba(163,163,163,0.55),0_0_70px_rgba(82,82,91,0.3)]",
              musicStarted && isStrong && !isActive && "border-[rgba(219,39,119,0.22)] bg-[rgba(219,39,119,0.07)]",
              musicStarted && !isStrong && !isActive && "border-[rgba(37,99,235,0.20)] bg-[rgba(37,99,235,0.06)]",
              musicStarted && isStrong && isActive && "border-transparent bg-gradient-to-br from-[#db2777] to-[#9333ea] text-white shadow-[0_0_40px_rgba(219,39,119,0.7),0_0_90px_rgba(147,51,234,0.4)]",
              musicStarted && !isStrong && isActive && "border-transparent bg-gradient-to-br from-[#2563eb] to-[#22d3ee] text-white shadow-[0_0_34px_rgba(37,99,235,0.6),0_0_70px_rgba(34,211,238,0.3)]",
            )}
          >
            <span
              className={cn(
                "transition-colors duration-75",
                !musicStarted
                 ? isActive
                   ? "text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.35)]"
                   : isStrong
                     ? "text-neutral-400"
                     : "text-neutral-500"
                  : isActive
                    ? "text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.35),0_0_24px_rgba(255,255,255,0.25)]"
                    : isStrong
                      ? "text-pink-200/35"
                      : "text-blue-200/30",
              )}
            >
              {labels[index]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
