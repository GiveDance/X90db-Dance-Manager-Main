"use client";

import { Trash2 } from "lucide-react";
import type { PlacedPerformingClip } from "@/lib/composition";

interface ClipInspectorProps {
  clip: PlacedPerformingClip;
  onChange: (
    id: string,
    patch: Partial<
      Pick<
        PlacedPerformingClip,
        "sourceIn" | "timelineDuration" | "playbackRate"
      >
    >,
  ) => void;
  onDelete: (id: string) => void;
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ClipInspector({
  clip,
  onChange,
  onDelete,
}: ClipInspectorProps) {
  const sourceNeeded = clip.sourceIn + clip.timelineDuration * clip.playbackRate;
  const exceedsSource = sourceNeeded > clip.sourceDuration + 0.05;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white" title={clip.name}>
            {clip.name}
          </p>
          <p className="mt-1 text-[11px] text-neutral-600">
            Source {clip.sourceDuration.toFixed(1)}s
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(clip.id)}
          aria-label={`Delete ${clip.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {[
        {
          label: "Source in",
          value: clip.sourceIn,
          min: 0,
          max: Math.max(0, clip.sourceDuration - 0.1),
          step: 0.1,
          key: "sourceIn" as const,
          unit: "s",
        },
        {
          label: "Speed",
          value: clip.playbackRate,
          min: 0.25,
          max: 4,
          step: 0.05,
          key: "playbackRate" as const,
          unit: "×",
        },
        {
          label: "Timeline duration",
          value: clip.timelineDuration,
          min: 0.2,
          max: 120,
          step: 0.1,
          key: "timelineDuration" as const,
          unit: "s",
        },
      ].map((control) => (
        <label key={control.key} className="block">
          <span className="flex items-center justify-between text-xs text-neutral-400">
            {control.label}
            <span className="tabular-nums text-neutral-200">
              {control.value.toFixed(control.key === "playbackRate" ? 2 : 1)}
              {control.unit}
            </span>
          </span>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={control.value}
            onChange={(event) =>
              onChange(clip.id, {
                [control.key]: numericValue(event.target.value, control.value),
              })
            }
            className="mt-2 w-full accent-violet-400"
          />
        </label>
      ))}

      {exceedsSource && (
        <p className="rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-[11px] leading-5 text-amber-200/70">
          The source ends before this timeline clip. Shorten the duration or reduce
          speed to avoid holding the final frame.
        </p>
      )}
    </div>
  );
}
