"use client";

import { useState } from "react";
import {
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  FormationAudiencePosition,
  FormationChange,
  FormationPosition,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { FormationStageEditor } from "./FormationStageEditor";
import { beatLabelTime, beatTimeLabel } from "@/lib/formations";

type Endpoint = "start" | "end";

function BeatTimeInput({
  time,
  bpm,
  offset,
  label,
  minTime,
  maxTime,
  onChange,
}: {
  time: number;
  bpm: number;
  offset: number;
  label: string;
  minTime: number;
  maxTime: number;
  onChange: (time: number) => void;
}) {
  const initialValue = beatTimeLabel(time, bpm, offset);
  const [value, setValue] = useState(initialValue);
  const applyTime = (nextTime: number) => {
    const boundedTime = Math.min(maxTime, Math.max(minTime, nextTime));
    setValue(beatTimeLabel(boundedTime, bpm, offset));
    onChange(boundedTime);
  };
  const commit = () => {
    const parsed = beatLabelTime(value, bpm, offset);
    if (parsed == null) {
      setValue(initialValue);
      return;
    }
    applyTime(parsed);
  };
  const step = (direction: -1 | 1) => {
    const parsed = beatLabelTime(value, bpm, offset);
    applyTime((parsed ?? time) + direction * (60 / Math.max(1, bpm)));
  };

  return (
    <div className="flex h-9 overflow-hidden rounded-lg border border-white/10 bg-black/30 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/40">
      <button
        type="button"
        aria-label={`${label}提前一拍`}
        data-tooltip="提前一拍"
        onClick={() => step(-1)}
        className="flex w-8 shrink-0 items-center justify-center text-neutral-500 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        aria-label={label}
        placeholder="1-1"
        className="min-w-0 flex-1 cursor-text appearance-none border-x border-white/10 bg-transparent px-1 text-center text-sm tabular-nums text-white outline-none hover:bg-transparent"
      />
      <button
        type="button"
        aria-label={`${label}延后一拍`}
        data-tooltip="延后一拍"
        onClick={() => step(1)}
        className="flex w-8 shrink-0 items-center justify-center text-neutral-500 transition-colors hover:text-white"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FormationKeyframeThumbnail({
  positions,
  audiencePosition,
  label,
  selected,
  onClick,
}: {
  positions: FormationPosition[];
  audiencePosition: FormationAudiencePosition;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tooltip={`编辑${label}走位`}
      data-formation-thumbnail={label}
      className={cn(
        "relative z-10 h-14 w-24 shrink-0 overflow-hidden rounded-lg border bg-neutral-900 transition-colors",
        selected
          ? "border-blue-400 ring-1 ring-blue-400/40"
          : "border-white/10 hover:border-white/25",
      )}
    >
      <FormationStageEditor
        positions={positions}
        audiencePosition={audiencePosition}
        editable={false}
        framed={false}
        onChange={() => undefined}
      />
      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white">
        {label}
      </span>
    </button>
  );
}

export function FormationSidebar({
  changes,
  duration,
  bpm,
  offset,
  audiencePosition,
  selected,
  onAdd,
  onDelete,
  onSelectEndpoint,
  onTimeChange,
}: {
  changes: FormationChange[];
  duration: number;
  bpm: number;
  offset: number;
  audiencePosition: FormationAudiencePosition;
  selected: { id: string; endpoint: Endpoint } | null;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onSelectEndpoint: (
    id: string,
    endpoint: Endpoint,
    previewTime?: number,
  ) => void;
  onTimeChange: (id: string, endpoint: Endpoint, time: number) => void;
}) {
  return (
    <aside className="flex h-full w-[clamp(310px,28vw,380px)] shrink-0 flex-col border-l border-white/5 bg-neutral-950">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 px-5">
        <h2 className="text-base font-semibold text-white">走位变化</h2>
        <span className="text-xs tabular-nums text-neutral-600">
          {changes.length}
        </span>
      </div>

      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-3">
        {changes.length === 0 && (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium text-neutral-400">暂无走位变化</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              添加后设置目标走位与变化的开始、结束拍子。
            </p>
          </div>
        )}

        {changes.map((change, index) => {
          const previousChange = index > 0 ? changes[index - 1] : null;
          const sourceChange = previousChange ?? change;
          const sourceEndpoint: Endpoint = previousChange ? "end" : "start";
          const sourceLabel = previousChange ? `走位 ${index}` : "初始";
          const targetLabel = `走位 ${index + 1}`;
          const sourceSelected =
            selected?.id === sourceChange.id &&
            selected.endpoint === sourceEndpoint;
          const targetSelected =
            selected?.id === change.id && selected.endpoint === "end";
          return (
            <div
              key={change.id}
              className="relative rounded-xl border border-white/5 bg-neutral-900/60 p-3"
            >
              {index > 0 && (
                <span
                  data-shared-connector
                  className={cn(
                    "pointer-events-none absolute -top-6 left-[60px] h-[76px] border-l border-dashed",
                    sourceSelected
                      ? "border-blue-400"
                      : "border-neutral-600/70",
                  )}
                />
              )}
              <span
                data-transition-connector
                className="pointer-events-none absolute left-[60px] top-[108px] z-20 h-5"
              >
                <ArrowDown
                  strokeWidth={2.5}
                  className="absolute left-0 top-0 h-5 w-4 -translate-x-1/2 text-blue-400"
                />
              </span>

              <div className="mb-3 flex h-7 items-center justify-between pl-[108px]">
                <span className="text-sm font-medium text-neutral-200">
                  走位变化 {index + 1}
                </span>
                <button
                  type="button"
                  data-tooltip="删除走位变化"
                  aria-label={`删除走位变化 ${index + 1}`}
                  onClick={() => onDelete(change.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-red-500/15 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <FormationKeyframeThumbnail
                  audiencePosition={audiencePosition}
                  positions={
                    previousChange
                      ? previousChange.endPositions
                      : change.startPositions
                  }
                  label={sourceLabel}
                  selected={sourceSelected}
                  onClick={() =>
                    onSelectEndpoint(
                      sourceChange.id,
                      sourceEndpoint,
                      change.startTime,
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <span className="mb-1 block text-[10px] text-neutral-500">
                    开始
                  </span>
                  <BeatTimeInput
                    key={`${change.id}-start-${change.startTime}-${bpm}-${offset}`}
                    time={change.startTime}
                    bpm={bpm}
                    offset={offset}
                    label={`走位变化 ${index + 1} 开始拍子`}
                    minTime={0}
                    maxTime={duration || Number.POSITIVE_INFINITY}
                    onChange={(nextTime) =>
                      onTimeChange(change.id, "start", nextTime)
                    }
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <FormationKeyframeThumbnail
                  audiencePosition={audiencePosition}
                  positions={change.endPositions}
                  label={targetLabel}
                  selected={targetSelected}
                  onClick={() =>
                    onSelectEndpoint(change.id, "end", change.endTime)
                  }
                />
                <div className="min-w-0 flex-1">
                  <span className="mb-1 block text-[10px] text-neutral-500">
                    结束
                  </span>
                  <BeatTimeInput
                    key={`${change.id}-end-${change.endTime}-${bpm}-${offset}`}
                    time={change.endTime}
                    bpm={bpm}
                    offset={offset}
                    label={`走位变化 ${index + 1} 结束拍子`}
                    minTime={Math.min(
                      duration || Number.POSITIVE_INFINITY,
                      change.startTime + 60 / Math.max(1, bpm),
                    )}
                    maxTime={duration || Number.POSITIVE_INFINITY}
                    onChange={(nextTime) =>
                      onTimeChange(
                        change.id,
                        "end",
                        Math.min(
                          duration || Number.POSITIVE_INFINITY,
                          nextTime,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-white/5 p-3">
        <button
          type="button"
          onClick={onAdd}
          data-tooltip="添加走位变化"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          添加走位变化
        </button>
      </div>
    </aside>
  );
}
