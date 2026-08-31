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
import { useLanguage } from "@/i18n/LanguageProvider";

type Endpoint = "start" | "end";

function BeatTimeInput({
  time,
  bpm,
  offset,
  beatTimes,
  label,
  minTime,
  maxTime,
  onChange,
}: {
  time: number;
  bpm: number;
  offset: number;
  beatTimes: number[];
  label: string;
  minTime: number;
  maxTime: number;
  onChange: (time: number) => void;
}) {
  const { language, t } = useLanguage();
  const localizedLabel =
    language === "en"
      ? label
          .replace(/^走位变化 (\d+) 开始拍子$/, "Start beat for transition $1")
          .replace(/^走位变化 (\d+) 结束拍子$/, "End beat for transition $1")
      : label;
  const initialValue = beatTimeLabel(time, bpm, offset, beatTimes);
  const [value, setValue] = useState(initialValue);
  const applyTime = (nextTime: number) => {
    const boundedTime = Math.min(maxTime, Math.max(minTime, nextTime));
    setValue(beatTimeLabel(boundedTime, bpm, offset, beatTimes));
    onChange(boundedTime);
  };
  const commit = () => {
    const parsed = beatLabelTime(value, bpm, offset, beatTimes);
    if (parsed == null) {
      setValue(initialValue);
      return;
    }
    applyTime(parsed);
  };
  const step = (direction: -1 | 1) => {
    const match = value.trim().match(/^(\d+)-([1-8])$/);
    if (beatTimes.length && match) {
      const currentIndex = (Number(match[1]) - 1) * 8 + Number(match[2]) - 1;
      const nextIndex = Math.max(
        0,
        Math.min(beatTimes.length - 1, currentIndex + direction),
      );
      applyTime(beatTimes[nextIndex]);
      return;
    }
    const parsed = beatLabelTime(value, bpm, offset);
    applyTime((parsed ?? time) + direction * (60 / Math.max(1, bpm)));
  };

  return (
    <div className="flex h-9 overflow-hidden rounded-lg border border-white/10 bg-black/30 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/40">
      <button
        type="button"
        aria-label={`${localizedLabel} — ${t("提前一拍")}`}
        data-tooltip={t("提前一拍")}
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
        aria-label={localizedLabel}
        placeholder="1-1"
        className="min-w-0 flex-1 cursor-text appearance-none border-x border-white/10 bg-transparent px-1 text-center text-sm tabular-nums text-white outline-none hover:bg-transparent"
      />
      <button
        type="button"
        aria-label={`${localizedLabel} — ${t("延后一拍")}`}
        data-tooltip={t("延后一拍")}
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
  const { language, translateText } = useLanguage();
  const localizedLabel = translateText(label);
  const editLabel =
    language === "en"
      ? `Edit ${localizedLabel.toLocaleLowerCase("en")}${
          localizedLabel === "Initial" ? " formation" : ""
        }`
      : `编辑${label}走位`;
  return (
    <button
      type="button"
      onClick={onClick}
      data-tooltip={editLabel}
      aria-label={editLabel}
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
        {localizedLabel}
      </span>
    </button>
  );
}

export function FormationSidebar({
  changes,
  duration,
  bpm,
  offset,
  beatTimes,
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
  beatTimes: number[];
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
  const { language, t } = useLanguage();
  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-l border-white/5 bg-neutral-950",
        language === "en"
          ? "w-[clamp(350px,30vw,420px)]"
          : "w-[clamp(310px,28vw,380px)]",
      )}
    >
      <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
        <h2 className="text-base font-semibold text-white">{t("走位变化")}</h2>
        <span className="text-xs tabular-nums text-neutral-600">
          {changes.length}
        </span>
      </div>

      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-3 pb-3 pt-1">
        {changes.length === 0 && (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium text-neutral-400">{t("暂无走位变化")}</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              {t("添加后设置目标走位与变化的开始、结束拍子。")}
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
              className={cn(
                "relative rounded-xl border bg-neutral-900/60 p-3 transition-colors",
                sourceSelected || targetSelected
                  ? "border-[#60a5fa8c]"
                  : "border-white/[0.05] hover:border-white/[0.12] active:border-white/20",
              )}
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

              <div className="mb-3 flex h-7 items-center justify-between gap-2 pl-[108px]">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-200">
                  {language === "en"
                    ? `Transition ${index + 1}`
                    : `走位变化 ${index + 1}`}
                </span>
                <button
                  type="button"
                  data-tooltip={t("删除走位变化")}
                  aria-label={
                    language === "en"
                      ? `Delete transition ${index + 1}`
                      : `删除走位变化 ${index + 1}`
                  }
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
                    {t("开始")}
                  </span>
                  <BeatTimeInput
                    key={`${change.id}-start-${change.startTime}-${bpm}-${offset}`}
                    time={change.startTime}
                    bpm={bpm}
                    offset={offset}
                    beatTimes={beatTimes}
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
                    {t("结束")}
                  </span>
                  <BeatTimeInput
                    key={`${change.id}-end-${change.endTime}-${bpm}-${offset}`}
                    time={change.endTime}
                    bpm={bpm}
                    offset={offset}
                    beatTimes={beatTimes}
                    label={`走位变化 ${index + 1} 结束拍子`}
                    minTime={
                      beatTimes.find(
                        (time) => time > change.startTime + 0.001,
                      ) ??
                      Math.min(
                        duration || Number.POSITIVE_INFINITY,
                        change.startTime + 60 / Math.max(1, bpm),
                      )
                    }
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

      <div className="shrink-0 p-3">
        <button
          type="button"
          onClick={onAdd}
          data-tooltip={t("添加走位变化")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          {t("添加走位变化")}
        </button>
      </div>
    </aside>
  );
}
