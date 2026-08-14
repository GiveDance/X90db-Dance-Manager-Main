"use client";

import { Trash2 } from "lucide-react";
import type { PlacedPerformingClip } from "@/lib/composition";
import type { GeneratedStageTemplate } from "@/lib/types";
import { Toggle } from "./Toggle";

const GENERATED_NAMES: Record<GeneratedStageTemplate, string> = {
  street: "街舞信号",
  pulse: "极光脉冲",
  constellation: "聚合提示",
  minimal: "极简舞台",
};

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
    const displayName = clip.generatedTemplate
      ? GENERATED_NAMES[clip.generatedTemplate]
      : clip.name;
    return (
      <div className="space-y-4">
        <div className="flex min-h-7 items-center gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium text-white"
              title={displayName}
            >
              {displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDelete(clip.id)}
            aria-label={`删除 ${displayName}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.07] bg-black/40 px-3 py-2">
            <span className="block text-[11px] text-neutral-500">开始</span>
            <span className="mt-1 block text-xs tabular-nums text-neutral-300">
              {clip.timelineStart.toFixed(1)}s
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-black/40 px-3 py-2">
            <span className="block text-[11px] text-neutral-500">结束</span>
            <span className="mt-1 block text-xs tabular-nums text-neutral-300">
              {clip.timelineEnd.toFixed(1)}s
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex min-h-7 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white" title={clip.name}>
            {clip.name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(clip.id)}
          aria-label={`删除 ${clip.name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {[
        {
          label: "素材入点",
          value: clip.sourceIn,
          min: 0,
          max: Math.max(0, clip.sourceDuration - 0.1),
          step: 0.1,
          key: "sourceIn" as const,
          unit: "s",
          help: "设置从原视频的哪个时间点开始播放。",
        },
        {
          label: "播放速度",
          value: clip.playbackRate,
          min: 0.25,
          max: 4,
          step: 0.05,
          key: "playbackRate" as const,
          unit: "×",
          help: "调整速度会同步改变素材在时间线中的长度。",
        },
      ].map((control) => (
        <label key={control.key} className="block">
          <span className="flex items-center justify-between text-[11px] text-neutral-500">
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
          <span className="mt-1.5 block text-[11px] leading-4 text-neutral-500">
            {control.help}
          </span>
        </label>
      ))}

      <div className="h-px bg-white/5" />

      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-200">循环播放</p>
            <p className="mt-1 text-[11px] leading-4 text-neutral-500">
              循环原视频以填充更长的时间范围。
            </p>
          </div>
          <Toggle
            checked={clip.repeat === true}
            onChange={(repeat) => onChange(clip.id, { repeat })}
            label="循环播放"
          />
        </div>
      </div>
    </div>
  );
}
