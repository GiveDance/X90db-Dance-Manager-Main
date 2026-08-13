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
        | "sourceIn"
        | "timelineStart"
        | "timelineDuration"
        | "playbackRate"
        | "repeat"
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
  if (clip.kind === "generated") {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium text-white"
              title={clip.name}
            >
              {clip.name}
            </p>
            <p className="mt-1 text-[11px] text-neutral-600">
              Generated video material
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
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.07] bg-black/40 px-3 py-2">
            <span className="block text-[10px] text-neutral-600">Start</span>
            <span className="mt-1 block text-xs tabular-nums text-neutral-300">
              {clip.timelineStart.toFixed(1)}s
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-black/40 px-3 py-2">
            <span className="block text-[10px] text-neutral-600">End</span>
            <span className="mt-1 block text-xs tabular-nums text-neutral-300">
              {clip.timelineEnd.toFixed(1)}s
            </span>
          </div>
        </div>
        <p className="text-[11px] leading-5 text-neutral-600">
          Drag the material or its left and right timeline edges to adjust this
          range. Generated content always uses the matching source timestamp.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white" title={clip.name}>
            {clip.name}
          </p>
          <p className="mt-1 text-[11px] text-neutral-600">
            Video clip · Source {clip.sourceDuration.toFixed(1)}s
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
          help: "Choose where playback starts in the source video.",
        },
        {
          label: "Speed",
          value: clip.playbackRate,
          min: 0.25,
          max: 4,
          step: 0.05,
          key: "playbackRate" as const,
          unit: "×",
          help: "Speed changes this clip's visible timeline length.",
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
            className="mt-2 w-full accent-[#30E6FF]"
          />
          <span className="mt-1.5 block text-[10px] leading-4 text-neutral-600">
            {control.help}
          </span>
        </label>
      ))}

      <div className="h-px bg-white/5" />

      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-300">Repeat</p>
            <p className="mt-1 text-[10px] leading-4 text-neutral-600">
              Loop the source to fill any timeline length.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Repeat video clip"
            aria-checked={clip.repeat === true}
            onClick={() => onChange(clip.id, { repeat: !clip.repeat })}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              clip.repeat ? "bg-[#30E6FF]" : "bg-neutral-800"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                clip.repeat ? "translate-x-[18px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        <p className="mt-3 rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2 text-[10px] leading-4 text-neutral-500">
          {clip.repeat
            ? "Repeat is on. Drag the right edge to extend this clip across the available range."
            : "Repeat is off. The right edge is limited by the remaining source video."}
        </p>
      </div>
    </div>
  );
}
