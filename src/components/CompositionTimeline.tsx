"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  GENERATED_TEMPLATE_DRAG_TYPE,
  VIDEO_CLIP_DRAG_TYPE,
  isGeneratedTemplate,
  snapToNearbyBeatTime,
  type PlacedPerformingClip,
} from "@/lib/composition";
import type { GeneratedStageTemplate } from "@/lib/types";
import {
  TimelineNavigationControls,
  useTimelineNavigation,
} from "./TimelineNavigation";

export type TimelineTrack = "source" | "overlay" | "composition";

const GENERATED_NAMES: Record<GeneratedStageTemplate, string> = {
  street: "棱彩波谱",
  pulse: "极光脉冲",
  constellation: "聚合提示",
  minimal: "极简舞台",
};

function hasSupportedDragType(dataTransfer: DataTransfer) {
  return (
    dataTransfer.types.includes(GENERATED_TEMPLATE_DRAG_TYPE) ||
    dataTransfer.types.includes(VIDEO_CLIP_DRAG_TYPE)
  );
}

function TrackHeader({
  label,
  hidden,
  onToggle,
  onClearSelection,
}: {
  label: string;
  hidden: boolean;
  onToggle: () => void;
  onClearSelection: () => void;
}) {
  return (
    <div
      className="flex h-full items-center gap-2 border-r border-white/[0.07] px-2.5"
      onClick={onClearSelection}
    >
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-400">
        {label}
      </span>
      <button
        type="button"
        aria-label={`${hidden ? "显示" : "隐藏"} ${label} 轨道`}
        aria-pressed={hidden}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/5 ${
          hidden ? "text-neutral-600" : "text-neutral-400 hover:text-white"
        }`}
      >
        {hidden ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

interface CompositionTimelineProps {
  layout: PlacedPerformingClip[];
  beats: number[];
  duration: number;
  snapStartTime: number;
  sourceName: string;
  sourceThumbnail?: string | null;
  trackVisibility: Record<TimelineTrack, boolean>;
  onTrackVisibilityChange: (track: TimelineTrack, visible: boolean) => void;
  currentTime: number;
  selectedId: string | null;
  overlaySelected: boolean;
  onSelect: (id: string | null) => void;
  onSelectOverlay: () => void;
  onSeek: (time: number) => void;
  onChangeRange: (id: string, start: number, duration: number) => void;
  onMove: (id: string, start: number) => void;
  onDropGenerated: (template: GeneratedStageTemplate, time: number) => void;
  onDropVideo: (id: string, time: number) => void;
}

export function CompositionTimeline({
  layout,
  beats,
  duration,
  snapStartTime,
  sourceName,
  sourceThumbnail,
  trackVisibility,
  onTrackVisibilityChange,
  currentTime,
  selectedId,
  overlaySelected,
  onSelect,
  onSelectOverlay,
  onSeek,
  onChangeRange,
  onMove,
  onDropGenerated,
  onDropVideo,
}: CompositionTimelineProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const dragReadyIndicatorRef = useRef<HTMLSpanElement>(null);
  const dropIndicatorRef = useRef<HTMLSpanElement>(null);
  const materialDragActiveRef = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const timelineDuration = Math.max(
    duration,
    layout.at(-1)?.timelineEnd ?? 0,
    1,
  );
  const navigation = useTimelineNavigation(timelineDuration);
  const { zoom, viewportRef, syncScrollMetrics } = navigation;
  const percentage = (time: number) => (time / timelineDuration) * 100;
  const timeAtX = (clientX: number) => {
    const bounds = laneRef.current?.getBoundingClientRect();
    if (!bounds) return 0;
    const x = Math.max(0, Math.min(bounds.width, clientX - bounds.left));
    return (x / bounds.width) * timelineDuration;
  };
  const snapTime = (time: number) =>
    time < snapStartTime ? time : snapToNearbyBeatTime(beats, time);

  useEffect(() => {
    const clearIndicators = () => {
      materialDragActiveRef.current = false;
      if (dragReadyIndicatorRef.current) {
        dragReadyIndicatorRef.current.style.opacity = "0";
      }
      if (dropIndicatorRef.current) {
        dropIndicatorRef.current.style.opacity = "0";
      }
    };
    const onDragStart = (event: DragEvent) => {
      if (!event.dataTransfer || !hasSupportedDragType(event.dataTransfer)) {
        return;
      }
      materialDragActiveRef.current = true;
      if (dragReadyIndicatorRef.current) {
        dragReadyIndicatorRef.current.style.opacity = "1";
      }
    };

    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", clearIndicators);
    document.addEventListener("drop", clearIndicators);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", clearIndicators);
      document.removeEventListener("drop", clearIndicators);
    };
  }, []);

  const startEndResize = (
    event: React.PointerEvent,
    clip: PlacedPerformingClip,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const move = (pointerEvent: PointerEvent) => {
      const rawEnd = timeAtX(pointerEvent.clientX);
      const snappedEnd = snapTime(rawEnd);
      const nextStart =
        layout.find(
          (item) =>
            item.id !== clip.id && item.timelineStart >= clip.timelineEnd,
        )?.timelineStart ?? duration;
      const sourceLimitedEnd =
        clip.kind === "generated" || clip.repeat
          ? nextStart
          : Math.min(
              nextStart,
              clip.timelineStart +
                (clip.sourceDuration - clip.sourceIn) / clip.playbackRate,
            );
      const end = Math.max(
        clip.timelineStart + 0.2,
        Math.min(sourceLimitedEnd, snappedEnd),
      );
      onChangeRange(clip.id, clip.timelineStart, end - clip.timelineStart);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const startStartResize = (
    event: React.PointerEvent,
    clip: PlacedPerformingClip,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const previousEnd =
      layout.findLast(
        (item) => item.id !== clip.id && item.timelineEnd <= clip.timelineStart,
      )?.timelineEnd ?? 0;
    const earliestSourceStart =
      clip.kind === "generated"
        ? previousEnd
        : Math.max(
            previousEnd,
            clip.timelineStart - clip.sourceIn / clip.playbackRate,
          );
    const move = (pointerEvent: PointerEvent) => {
      const rawStart = timeAtX(pointerEvent.clientX);
      const snappedStart = snapTime(rawStart);
      const start = Math.max(
        earliestSourceStart,
        Math.min(clip.timelineEnd - 0.2, snappedStart),
      );
      onChangeRange(clip.id, start, clip.timelineEnd - start);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const startMove = (
    event: React.PointerEvent,
    clip: PlacedPerformingClip,
  ) => {
    const startX = event.clientX;
    const grabOffset = timeAtX(event.clientX) - clip.timelineStart;
    let moved = false;
    onSelect(clip.id);
    const move = (pointerEvent: PointerEvent) => {
      const offset = pointerEvent.clientX - startX;
      if (Math.abs(offset) > 4) moved = true;
      setDraggingId(clip.id);
      setDragOffset(offset);
    };
    const end = (pointerEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      if (moved) {
        onMove(
          clip.id,
          snapTime(Math.max(0, timeAtX(pointerEvent.clientX) - grabOffset)),
        );
      }
      setDraggingId(null);
      setDragOffset(0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const beatGuideLines = (prefix: string) =>
    beats.map((beat, index) => (
      <span
        key={`${prefix}-beat-${beat}-${index}`}
        className={`pointer-events-none absolute inset-y-0 w-px ${
          index % 8 === 0 ? "bg-violet-300/30" : "bg-white/[0.04]"
        }`}
        style={{ left: `${percentage(beat)}%` }}
      />
    ));
  const beatDots = beats.map((beat, index) => (
    <span
      key={`timeline-beat-dot-${beat}-${index}`}
      className={`pointer-events-none absolute bottom-0 h-[3px] w-[6px] -translate-x-1/2 rounded-t-full ${
        index % 8 === 0 ? "bg-violet-200" : "bg-neutral-600/60"
      }`}
      style={{ left: `${percentage(beat)}%` }}
    />
  ));

  const playhead = (
    <span
      className="pointer-events-none absolute inset-y-0 z-30 w-px bg-white shadow-[0_0_8px_rgba(255,255,255,.7)]"
      style={{ left: `${percentage(currentTime)}%` }}
    />
  );
  const toggleTrack = (track: TimelineTrack) => {
    onTrackVisibilityChange(track, !trackVisibility[track]);
  };
  const trackContentClass = (track: TimelineTrack) =>
    !trackVisibility[track]
      ? "opacity-40 grayscale transition-opacity"
      : "transition-opacity";

  return (
    <div data-composition-timeline>
      <div
        ref={viewportRef}
        onScroll={syncScrollMetrics}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="grid min-w-full grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/[0.07] bg-black"
          style={{ width: `${zoom * 100}%` }}
        >
          <div className="h-10 border-b border-white/[0.07]">
            <TrackHeader
              label="节拍信号"
              hidden={!trackVisibility.overlay}
              onToggle={() => toggleTrack("overlay")}
              onClearSelection={() => onSelect(null)}
            />
          </div>
          <div
            className="relative h-10 overflow-hidden bg-neutral-950"
            onClick={(event) => {
              onSeek(timeAtX(event.clientX));
              onSelect(null);
            }}
          >
            <div className="pointer-events-none absolute inset-0">
              {beatGuideLines("overlay")}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectOverlay();
              }}
              className={`absolute inset-y-1.5 left-0 flex min-w-16 items-center rounded-md border px-2 text-left text-[11px] font-medium transition-colors ${
                !trackVisibility.overlay
                  ? "border-white/10 bg-white/[0.04] text-neutral-600"
                  : overlaySelected
                   ? "border-violet-300/55 bg-violet-400/48 text-white shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                    : "border-violet-300/35 bg-violet-400/22 text-violet-100/85 hover:bg-violet-400/30"
              }`}
              style={{ width: `${percentage(duration)}%` }}
            >
              <span className="truncate">节拍信号</span>
            </button>
            {playhead}
          </div>

          <div className="h-14 border-b border-white/[0.07]">
            <TrackHeader
              label="合成素材"
              hidden={!trackVisibility.composition}
              onToggle={() => toggleTrack("composition")}
              onClearSelection={() => onSelect(null)}
            />
          </div>
          <div
            ref={laneRef}
            className="relative h-14 overflow-hidden bg-neutral-950"
            onClick={(event) => {
              onSeek(timeAtX(event.clientX));
              onSelect(null);
            }}
            onDragEnter={(event) => {
              if (hasSupportedDragType(event.dataTransfer)) {
                event.preventDefault();
                if (dragReadyIndicatorRef.current) {
                  dragReadyIndicatorRef.current.style.opacity = "0";
                }
                if (dropIndicatorRef.current) {
                  dropIndicatorRef.current.style.opacity = "1";
                }
              }
            }}
            onDragOver={(event) => {
              if (hasSupportedDragType(event.dataTransfer)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                if (dragReadyIndicatorRef.current) {
                  dragReadyIndicatorRef.current.style.opacity = "0";
                }
                if (dropIndicatorRef.current) {
                  dropIndicatorRef.current.style.opacity = "1";
                }
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                if (dropIndicatorRef.current) {
                  dropIndicatorRef.current.style.opacity = "0";
                }
                if (
                  materialDragActiveRef.current &&
                  dragReadyIndicatorRef.current
                ) {
                  dragReadyIndicatorRef.current.style.opacity = "1";
                }
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              materialDragActiveRef.current = false;
              if (dragReadyIndicatorRef.current) {
                dragReadyIndicatorRef.current.style.opacity = "0";
              }
              if (dropIndicatorRef.current) {
                dropIndicatorRef.current.style.opacity = "0";
              }
              const template = event.dataTransfer.getData(
                GENERATED_TEMPLATE_DRAG_TYPE,
              );
              if (isGeneratedTemplate(template)) {
                onDropGenerated(template, timeAtX(event.clientX));
                return;
              }
              const videoClipId = event.dataTransfer.getData(
                VIDEO_CLIP_DRAG_TYPE,
              );
              if (videoClipId) {
                onDropVideo(videoClipId, timeAtX(event.clientX));
              }
            }}
          >
            <span
              ref={dragReadyIndicatorRef}
              className="pointer-events-none absolute inset-0 bg-white/[0.10] opacity-0 transition-opacity duration-75"
            />
            <span
              ref={dropIndicatorRef}
              className="pointer-events-none absolute inset-0 bg-violet-500/25 opacity-0 transition-opacity duration-75"
            />
            <div
              className={`pointer-events-none absolute inset-0 ${trackContentClass("composition")}`}
            >
              {beatGuideLines("composition")}
            </div>
            {layout.map((clip) => {
              const selected = selectedId === clip.id;
              const dragging = draggingId === clip.id;
              const generated = clip.kind === "generated";
              const displayName =
                generated && clip.generatedTemplate
                  ? GENERATED_NAMES[clip.generatedTemplate]
                  : clip.name;
              return (
                <div
                  key={clip.id}
                  onPointerDown={(event) => startMove(event, clip)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(clip.id);
                  }}
                  className={`absolute inset-y-2 flex min-w-8 cursor-grab items-center overflow-hidden rounded-md border px-3 transition-colors active:cursor-grabbing ${trackContentClass("composition")} ${
                    generated
                      ? selected
                        ? "z-10 border-violet-300/55 bg-violet-400/48 shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                        : "border-violet-300/35 bg-violet-400/22 hover:bg-violet-400/30"
                      : selected
                        ? "z-10 border-[#30E6FF]/55 bg-[#30E6FF]/42 shadow-[0_0_12px_rgba(48,230,255,0.18)]"
                        : "border-[#30E6FF]/35 bg-[#30E6FF]/18 hover:bg-[#30E6FF]/26"
                  } ${dragging ? "z-20 opacity-80 shadow-xl" : ""}`}
                  style={{
                    left: `${percentage(clip.timelineStart)}%`,
                    width: `${percentage(clip.timelineDuration)}%`,
                    transform: dragging
                      ? `translateX(${dragOffset}px)`
                      : undefined,
                  }}
                  title={displayName}
                >
                  <button
                    type="button"
                    aria-label={`调整 ${displayName} 的开始位置`}
                    onPointerDown={(event) => startStartResize(event, clip)}
                    className={`absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize border-r ${
                      generated
                        ? "border-violet-200/20 bg-violet-200/10 hover:bg-violet-200/25"
                        : "border-[#30E6FF]/20 bg-[#30E6FF]/10 hover:bg-[#30E6FF]/25"
                    }`}
                  />
                  <p
                    className={`w-full truncate text-[11px] font-medium ${
                      generated ? "text-violet-100" : "text-[#30E6FF]"
                    }`}
                  >
                    {displayName}
                  </p>
                  <button
                    type="button"
                    aria-label={`调整 ${displayName} 的结束位置`}
                    onPointerDown={(event) => startEndResize(event, clip)}
                    className={`absolute inset-y-0 right-0 w-2 cursor-ew-resize border-l ${
                      generated
                        ? "border-violet-200/20 bg-violet-200/10 hover:bg-violet-200/25"
                        : "border-[#30E6FF]/20 bg-[#30E6FF]/10 hover:bg-[#30E6FF]/25"
                    }`}
                  />
                </div>
              );
            })}
            {playhead}
          </div>

          <div className="h-10">
            <TrackHeader
              label="原始视频"
              hidden={!trackVisibility.source}
              onToggle={() => toggleTrack("source")}
              onClearSelection={() => onSelect(null)}
            />
          </div>
          <div
            className="relative h-10 overflow-hidden bg-neutral-950"
            onClick={(event) => {
              onSeek(timeAtX(event.clientX));
              onSelect(null);
            }}
          >
            <div className="pointer-events-none absolute inset-0">
              {beatGuideLines("source")}
              {beatDots}
            </div>
            <div
              className={`absolute inset-y-1.5 left-0 flex min-w-20 items-center overflow-hidden rounded-md border px-1.5 ${
                trackVisibility.source
                  ? "border-white/15 bg-white/[0.08]"
                  : "border-white/10 bg-white/[0.04]"
              }`}
              style={{ width: `${percentage(duration)}%` }}
            >
                {sourceThumbnail && (
                  <span
                    className={`mr-2 h-6 w-10 shrink-0 rounded bg-cover bg-center ${
                      trackVisibility.source ? "" : "opacity-40 grayscale"
                    }`}
                    style={{ backgroundImage: `url("${sourceThumbnail}")` }}
                  />
                )}
                <span
                  className={`truncate text-[10px] ${
                    trackVisibility.source
                      ? "text-neutral-400"
                      : "text-neutral-600"
                  }`}
                >
                  {sourceName}
                </span>
            </div>
            {playhead}
          </div>
        </div>
      </div>
      <TimelineNavigationControls navigation={navigation} />
    </div>
  );
}
