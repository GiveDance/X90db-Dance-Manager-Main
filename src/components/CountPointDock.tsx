"use client";

import { BeatDots } from "./BeatDots";
import { CountTiles } from "./CountTiles";
import type {
  CountPointPosition,
  CountPointStyle,
} from "@/lib/types";
import { cn } from "@/lib/cn";

interface CountPointDockProps {
  style: CountPointStyle;
  position: CountPointPosition;
  activeBeat: number;
  segmentNumber: number | null;
  phase: number;
  active: boolean;
  isPlaying: boolean;
  musicStarted: boolean;
  secondsPerBeat: number;
}

export function CountPointDock({
  style,
  position,
  activeBeat,
  segmentNumber,
  phase,
  active,
  isPlaying,
  musicStarted,
  secondsPerBeat,
}: CountPointDockProps) {
  const vertical = position === "left" || position === "right";
  const orientation = vertical ? "vertical" : "horizontal";

  return (
    <aside
      className={cn(
        "pointer-events-none flex shrink-0 overflow-hidden bg-[#0e0e10]",
        vertical
          ? style === "dots"
            ? "h-full w-[76px] flex-col px-2 py-3"
            : "h-full w-[clamp(112px,16.666vw,280px)] flex-col p-3 sm:p-4"
          : "h-[clamp(76px,12vh,116px)] w-full flex-row px-4 py-3",
        position === "left" && "border-r border-[#1f1f22]",
        position === "right" && "border-l border-[#1f1f22]",
        position === "top" && "border-b border-[#1f1f22]",
        position === "bottom" && "border-t border-[#1f1f22]",
      )}
      aria-hidden="true"
    >
      {style === "tiles" ? (
        <CountTiles
          activeBeat={activeBeat}
          segmentNumber={segmentNumber}
          phase={phase}
          active={active}
          isPlaying={isPlaying}
          musicStarted={musicStarted}
          secondsPerBeat={secondsPerBeat}
          orientation={orientation}
        />
      ) : (
        <BeatDots
          activeBeat={activeBeat}
          segmentNumber={segmentNumber}
          musicStarted={musicStarted}
          orientation={orientation}
        />
      )}
    </aside>
  );
}
