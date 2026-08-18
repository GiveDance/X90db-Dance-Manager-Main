"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  Repeat,
  Plus,
  Crosshair,
  BarChart3,
  Pencil,
  Loader2,
  Check,
  List,
  LayoutGrid,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { CalibrationPanel } from "./CalibrationPanel";
import { SegmentThumbnail } from "./SegmentThumbnail";
import type { ThumbnailGenerator } from "@/lib/thumbnailGenerator";
import { MARKER_COLORS, type DanceSection, type Marker, type Segment } from "@/lib/types";
import { sectionTimeRange } from "@/lib/segments";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export type SidebarTab = "beat" | "section";
type BeatView = "list" | "tile";

interface SegmentSidebarProps {
  tab: SidebarTab;
  onTabChange: (t: SidebarTab) => void;
  calibrating: boolean;
  onToggleCalibration: () => void;
  bpm: number;
  offset: number;
  currentCount: number;
  onSetBpm: (bpm: number) => void;
  onSetOffset: (offset: number) => void;
  onShiftOffset: (deltaSeconds: number) => void;
  onSetDownbeat: () => void;
  onResetCalibration: () => void;

  segments: Segment[];
  markers: Marker[];
  generator: ThumbnailGenerator | null;

  // 八拍
  activeIndex: number;
  beatLoopKey: number | null;
  onJump: (seg: Segment) => void;
  onToggleBeatLoop: (index: number, seg: Segment) => void;
  selectedBeatIndices: number[];
  onToggleBeatSelection: (index: number) => void;
  onCreateSectionFromSelection: () => void;

  // 段落
  sections: DanceSection[];
  activeSectionIndex: number;
  sectionLoopKey: number | null;
  detectingSections: boolean;
  onJumpSection: (index: number) => void;
  onToggleSectionLoop: (index: number) => void;
  onEditSection: (index: number) => void;
  onAddSection: () => void;
}

function SegmentSidebarImpl(props: SegmentSidebarProps) {
  const {
    tab,
    onTabChange,
    calibrating,
    onToggleCalibration,
    bpm,
    offset,
    currentCount,
    onSetBpm,
    onSetOffset,
    onShiftOffset,
    onSetDownbeat,
    onResetCalibration,
    segments,
    markers,
    generator,
    activeIndex,
    beatLoopKey,
    onJump,
    onToggleBeatLoop,
    selectedBeatIndices,
    onToggleBeatSelection,
    onCreateSectionFromSelection,
    sections,
    activeSectionIndex,
    sectionLoopKey,
    detectingSections,
    onJumpSection,
    onToggleSectionLoop,
    onEditSection,
    onAddSection,
  } = props;

  const activeRef = useRef<HTMLButtonElement>(null);
  const lastActive = useRef(-1);
  const lastView = useRef<BeatView>("list");
  const [beatView, setBeatView] = useState<BeatView>("list");
  const sortedSelection = [...selectedBeatIndices].sort((a, b) => a - b);
  const selectionIsContinuous = sortedSelection.every(
    (index, position) => index === sortedSelection[0] + position,
  );

  // 八拍 tab：自动定位到当前段
  useEffect(() => {
    if (tab !== "beat") return;
    if (
      activeRef.current &&
      (activeIndex !== lastActive.current || beatView !== lastView.current)
    ) {
      lastActive.current = activeIndex;
      lastView.current = beatView;
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex, tab, beatView]);

  return (
    <aside className="flex h-full w-[clamp(300px,28vw,380px)] shrink-0 flex-col border-l border-white/5 bg-neutral-950">
      <div className="relative flex items-center justify-between pb-2 pl-5 pr-3 pt-4">
        <h2 className="text-base font-semibold text-white">舞蹈分段</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-tooltip="节奏校准"
            aria-label="节奏校准"
            aria-expanded={calibrating}
            onClick={onToggleCalibration}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
              calibrating
                ? "bg-blue-500/20 text-blue-300"
                : "text-neutral-500 hover:bg-white/10 hover:text-white",
            )}
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <div className="flex rounded-lg bg-neutral-900 p-0.5 text-sm">
            {(
              [
                ["beat", "八拍"],
                ["section", "段落"],
              ] as [SidebarTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  tab === key ? "bg-blue-500 text-white" : "text-neutral-400 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence>
          {calibrating && (
            <div className="absolute left-2 right-2 top-full z-30 mt-2">
              <CalibrationPanel
                bpm={bpm}
                offset={offset}
                currentCount={currentCount}
                onSetBpm={onSetBpm}
                onSetOffset={onSetOffset}
                onShiftOffset={onShiftOffset}
                onSetDownbeat={onSetDownbeat}
                onReset={onResetCalibration}
                onClose={onToggleCalibration}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {tab === "beat" ? (
        <>
          <div className="flex items-center justify-between py-1.5 pl-5 pr-3">
            <span className="text-xs font-medium text-neutral-500">八拍视图</span>
            <div
              role="group"
              aria-label="八拍视图"
              className="flex rounded-lg bg-neutral-900 p-0.5"
            >
              <button
                type="button"
                data-tooltip="列表视图"
                aria-label="列表视图"
                aria-pressed={beatView === "list"}
                onClick={() => setBeatView("list")}
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  beatView === "list"
                    ? "bg-blue-500 text-white"
                    : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200",
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                data-tooltip="方格视图"
                aria-label="方格视图"
                aria-pressed={beatView === "tile"}
                onClick={() => setBeatView("tile")}
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                  beatView === "tile"
                    ? "bg-blue-500 text-white"
                    : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div data-seg-scroll className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-3 pt-2">
            {beatView === "list" ? (
              <div className="space-y-2">
                {segments.map((seg, i) => {
              const isActive = i === activeIndex;
              const isLooping = beatLoopKey === i;
              const isSelected = selectedBeatIndices.includes(i);
              const segMarkers = markers.filter((m) => m.time >= seg.start && m.time < seg.end);
              return (
                <button
                  key={seg.num}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => onJump(seg)}
                  className={cn(
                    "group/beat flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                    isActive
                      ? "border-blue-500 bg-blue-500/10"
                      : isSelected
                        ? "border-blue-500/40 bg-blue-500/5"
                      : "border-transparent bg-neutral-900/60 hover:bg-neutral-900",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold",
                      isActive ? "bg-blue-500 text-white" : "bg-neutral-800 text-neutral-400",
                    )}
                  >
                    {seg.num}
                  </span>
                  <SegmentThumbnail generator={generator} time={seg.start} num={seg.num} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">8拍 {seg.num}</span>
                      {isActive && <BarChart3 className="h-3.5 w-3.5 text-blue-400" />}
                    </div>
                    <div className="text-xs tabular-nums text-neutral-500">
                      {formatTime(seg.start)} - {formatTime(seg.end)}
                    </div>
                    {segMarkers.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                        {segMarkers.map((m) => (
                          <span key={m.id} className="flex items-center gap-1 text-[11px] text-neutral-400">
                            <span className={cn("h-1.5 w-1.5 rounded-full", MARKER_COLORS[m.color].dot)} />
                            {m.label || m.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <span
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={isSelected ? `取消选择第 ${seg.num} 个八拍` : `选择第 ${seg.num} 个八拍`}
                      tabIndex={0}
                      data-tooltip={isSelected ? "取消选择" : "选择该八拍"}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleBeatSelection(i);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onToggleBeatSelection(i);
                        }
                      }}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                        isSelected
                          ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/25 hover:text-blue-200"
                          : "text-neutral-500 opacity-0 hover:bg-white/10 hover:text-white group-hover/beat:opacity-100 focus-visible:opacity-100",
                      )}
                    >
                      {isSelected ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-[3px] border border-current" />
                      )}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      data-tooltip={isLooping ? "关闭单段循环" : "循环当前 8 拍"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBeatLoop(i, seg);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleBeatLoop(i, seg);
                        }
                      }}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                        isLooping
                          ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/25 hover:text-blue-200"
                          : "text-neutral-400 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Repeat className="h-4 w-4" />
                    </span>
                  </span>
                </button>
              );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(
                  { length: Math.ceil(segments.length / 4) },
                  (_, groupIndex) => {
                    const group = segments.slice(
                      groupIndex * 4,
                      groupIndex * 4 + 4,
                    );
                    return (
                      <div
                        key={groupIndex}
                        className="grid grid-cols-4 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60"
                      >
                        {group.map((seg, groupOffset) => {
                          const index = groupIndex * 4 + groupOffset;
                          const isActive = index === activeIndex;
                          const isLooping = beatLoopKey === index;
                          const isSelected = selectedBeatIndices.includes(index);
                          return (
                            <div
                              key={seg.num}
                              className={cn(
                                "group/tile relative h-[72px] border-l border-white/10 first:border-l-0",
                                groupOffset === 0 && "rounded-l-[11px]",
                                groupOffset === group.length - 1 && "rounded-r-[11px]",
                                isActive
                                  ? "bg-blue-500/10 ring-1 ring-inset ring-blue-500"
                                  : isSelected
                                    ? "bg-blue-500/15"
                                    : "bg-neutral-900/40 hover:bg-neutral-800",
                              )}
                            >
                              <button
                                type="button"
                                ref={isActive ? activeRef : undefined}
                                onClick={() => onJump(seg)}
                                aria-label={`播放第 ${seg.num} 个八拍`}
                                className={cn(
                                  "flex h-full w-full flex-col items-center justify-center gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300",
                                  isActive
                                    ? "text-white"
                                    : isSelected
                                      ? "text-blue-200"
                                      : "text-neutral-400 group-hover/tile:text-white",
                                )}
                              >
                                <span className="text-lg font-semibold leading-none tabular-nums">
                                  {seg.num}
                                </span>
                                <span
                                  className={cn(
                                    "text-[9px] tabular-nums",
                                    isActive ? "text-blue-300" : "text-neutral-600",
                                  )}
                                >
                                  {formatTime(seg.start)}
                                </span>
                              </button>

                              <button
                                type="button"
                                aria-label={
                                  isSelected
                                    ? `取消选择第 ${seg.num} 个八拍`
                                    : `选择第 ${seg.num} 个八拍`
                                }
                                aria-pressed={isSelected}
                                data-tooltip={isSelected ? "取消选择" : "选择该八拍"}
                                onClick={() => onToggleBeatSelection(index)}
                                className={cn(
                                  "absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
                                  isSelected
                                    ? "bg-blue-500/20 text-blue-300"
                                    : "text-neutral-500 opacity-0 hover:bg-white/10 hover:text-white group-hover/tile:opacity-100 focus-visible:opacity-100",
                                )}
                              >
                                {isSelected ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <span className="h-3 w-3 rounded-[3px] border border-current" />
                                )}
                              </button>

                              <button
                                type="button"
                                aria-label={
                                  isLooping
                                    ? `关闭第 ${seg.num} 个八拍循环`
                                    : `循环第 ${seg.num} 个八拍`
                                }
                                data-tooltip={isLooping ? "关闭单段循环" : "循环当前 8 拍"}
                                onClick={() => onToggleBeatLoop(index, seg)}
                                className={cn(
                                  "absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
                                  isLooping
                                    ? "bg-white text-blue-600"
                                    : "bg-black/40 text-neutral-400 opacity-0 hover:text-white group-hover/tile:opacity-100 focus:opacity-100",
                                )}
                              >
                                <Repeat className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
          {selectedBeatIndices.length > 0 ? (
            <div className="p-3">
              <button
                type="button"
                disabled={!selectionIsContinuous}
                aria-disabled={!selectionIsContinuous}
                aria-live="polite"
                title={
                  selectionIsContinuous
                    ? "将选中的连续八拍添加为段落"
                    : "请选择连续的八拍"
                }
                onClick={onCreateSectionFromSelection}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
                  selectionIsContinuous
                    ? "border-blue-500 bg-blue-500 text-white hover:border-blue-600 hover:bg-blue-600"
                    : "cursor-not-allowed border-neutral-500 bg-neutral-600 text-white",
                )}
              >
                <Plus className="h-4 w-4" />
                {selectionIsContinuous
                  ? "添加选中八拍为段落"
                  : "添加连续八拍为段落"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-5 py-3 text-xs text-neutral-500">
              <Repeat className="h-3.5 w-3.5" />
              点击循环图标可开启当前 8 拍的单段循环
            </div>
          )}
        </>
      ) : (
        <>
          <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-3 py-1">
            {detectingSections ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在识别段落…
              </div>
            ) : sections.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-neutral-600">
                还没有段落。点下方「手动添加段落」自己划分。
              </p>
            ) : (
              sections.map((sec, i) => {
                const r = sectionTimeRange(sec, segments);
                const isActive = i === activeSectionIndex;
                const isLooping = sectionLoopKey === i;
                const beats = sec.endSeg - sec.startSeg + 1;
                return (
                  <button
                    key={sec.id}
                    onClick={() => onJumpSection(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      isActive
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-transparent bg-neutral-900/60 hover:bg-neutral-900",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-white">{sec.name}</div>
                      <div className="text-xs tabular-nums text-neutral-500">
                        {r ? `${formatTime(r.start)} - ${formatTime(r.end)}` : "—"}
                        <span className="ml-2 text-neutral-600">· {beats} 个八拍</span>
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <span
                        role="button"
                        tabIndex={0}
                        title="编辑段落"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSection(i);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onEditSection(i);
                          }
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <Pencil className="h-4 w-4" />
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        title={isLooping ? "关闭段落循环" : "循环该段落"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSectionLoop(i);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleSectionLoop(i);
                          }
                        }}
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                          isLooping
                            ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/25 hover:text-blue-200"
                            : "text-neutral-400 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <Repeat className="h-4 w-4" />
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="p-3">
            <button
              onClick={onAddSection}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              手动添加段落
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

// memo：避免播放时（currentTime 每帧变化导致 Player 重渲染）八拍长列表跟着每帧重渲染。
export const SegmentSidebar = memo(SegmentSidebarImpl);
