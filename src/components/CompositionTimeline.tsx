"use client";

import { useRef, useState } from "react";
import {
  GENERATED_TEMPLATE_DRAG_TYPE,
  VIDEO_CLIP_DRAG_TYPE,
  isGeneratedTemplate,
  nearestBeatTime,
  type PlacedPerformingClip,
} from "@/lib/composition";
import type { GeneratedStageTemplate } from "@/lib/types";
import {
  TimelineNavigationControls,
  useTimelineNavigation,
} from "./TimelineNavigation";

interface CompositionTimelineProps {
  layout: PlacedPerformingClip[];
  beats: number[];
  duration: number;
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [generatedDragOver, setGeneratedDragOver] = useState(false);
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

  const startEndResize = (
    event: React.PointerEvent,
    clip: PlacedPerformingClip,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const move = (pointerEvent: PointerEvent) => {
      const rawEnd = timeAtX(pointerEvent.clientX);
      const snappedEnd = nearestBeatTime(beats, rawEnd);
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
      const snappedStart = nearestBeatTime(beats, rawStart);
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
          nearestBeatTime(
            beats,
            Math.max(0, timeAtX(pointerEvent.clientX) - grabOffset),
          ),
        );
      }
      setDraggingId(null);
      setDragOffset(0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const beatGrid = (prefix: string) =>
    beats.map((beat, index) => (
      <span
        key={`${prefix}-${beat}-${index}`}
        className={`pointer-events-none absolute inset-y-0 w-px ${
          index % 8 === 0 ? "bg-violet-300/25" : "bg-white/[0.055]"
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
  const hasSupportedDragType = (dataTransfer: DataTransfer) =>
    dataTransfer.types.includes(GENERATED_TEMPLATE_DRAG_TYPE) ||
    dataTransfer.types.includes(VIDEO_CLIP_DRAG_TYPE);

  return (
    <div>
      <div
        ref={viewportRef}
        onScroll={syncScrollMetrics}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="grid min-w-full grid-cols-[76px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/[0.07] bg-black"
          style={{ width: `${zoom * 100}%` }}
        >
          <div className="flex h-10 items-center border-b border-r border-white/[0.07] px-3">
            <span className="text-[10px] font-medium text-neutral-500">
              Overlay
            </span>
          </div>
          <div
            className="relative h-10 overflow-hidden border-b border-white/[0.07] bg-neutral-950"
            onClick={(event) => {
              onSeek(timeAtX(event.clientX));
              onSelectOverlay();
            }}
          >
            {beatGrid("overlay")}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectOverlay();
              }}
              className={`absolute inset-y-1.5 left-0 flex min-w-16 items-center rounded-md border px-2 text-left text-[10px] transition-colors ${
                overlaySelected
                  ? "border-violet-300/60 bg-violet-400/25 text-violet-100"
                  : "border-violet-300/15 bg-violet-400/10 text-violet-200/65 hover:bg-violet-400/15"
              }`}
              style={{ width: `${percentage(duration)}%` }}
            >
              <span className="truncate">Performer signals · Full video</span>
            </button>
            {playhead}
          </div>

          <div className="flex h-14 items-center border-r border-white/[0.07] px-3">
            <span className="text-[10px] font-medium text-neutral-500">
              Composition
            </span>
          </div>
          <div
            ref={laneRef}
            className={`relative h-14 overflow-hidden bg-neutral-950 transition-colors ${
              generatedDragOver ? "bg-violet-500/10" : ""
            }`}
            onClick={(event) => {
              onSeek(timeAtX(event.clientX));
              onSelect(null);
            }}
            onDragEnter={(event) => {
              if (hasSupportedDragType(event.dataTransfer)) {
                event.preventDefault();
                setGeneratedDragOver(true);
              }
            }}
            onDragOver={(event) => {
              if (hasSupportedDragType(event.dataTransfer)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setGeneratedDragOver(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setGeneratedDragOver(false);
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
            {beatGrid("composition")}
            {layout.map((clip, index) => {
              const selected = selectedId === clip.id;
              const dragging = draggingId === clip.id;
              const generated = clip.kind === "generated";
              return (
                <div
                  key={clip.id}
                  onPointerDown={(event) => startMove(event, clip)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(clip.id);
                  }}
                  className={`absolute inset-y-2 min-w-8 cursor-grab overflow-hidden rounded-md border px-2 py-1 transition-colors active:cursor-grabbing ${
                    generated
                      ? selected
                        ? "border-violet-300/60 bg-violet-400/25"
                        : "border-violet-300/15 bg-violet-400/10 hover:bg-violet-400/15"
                      : selected
                        ? "border-[#30E6FF]/60 bg-[#30E6FF]/25"
                        : "border-[#30E6FF]/15 bg-[#30E6FF]/10 hover:bg-[#30E6FF]/15"
                  } ${dragging ? "z-20 opacity-80 shadow-xl" : ""}`}
                  style={{
                    left: `${percentage(clip.timelineStart)}%`,
                    width: `${percentage(clip.timelineDuration)}%`,
                    transform: dragging
                      ? `translateX(${dragOffset}px)`
                      : undefined,
                  }}
                  title={clip.name}
                >
                  <button
                    type="button"
                    aria-label={`Adjust start of ${clip.name}`}
                    onPointerDown={(event) => startStartResize(event, clip)}
                    className={`absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize border-r ${
                      generated
                        ? "border-violet-200/20 bg-violet-200/10 hover:bg-violet-200/25"
                        : "border-[#30E6FF]/20 bg-[#30E6FF]/10 hover:bg-[#30E6FF]/25"
                    }`}
                  />
                  <p
                    className={`truncate text-[10px] font-medium ${
                      generated ? "text-violet-100" : "text-[#30E6FF]"
                    }`}
                  >
                    {index + 1}. {clip.name}
                  </p>
                  <p
                    className={`mt-0.5 truncate text-[9px] ${
                      generated ? "text-violet-200/45" : "text-[#30E6FF]/45"
                    }`}
                  >
                    {clip.kind === "generated"
                      ? `Generated · ${clip.timelineDuration.toFixed(1)}s`
                      : `${clip.timelineDuration.toFixed(1)}s · ×${clip.playbackRate.toFixed(2)}`}
                  </p>
                  <button
                    type="button"
                    aria-label={`Adjust end of ${clip.name}`}
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
        </div>
      </div>
      <TimelineNavigationControls navigation={navigation} />
    </div>
  );
}
