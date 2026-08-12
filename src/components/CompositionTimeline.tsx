"use client";

import { useRef, useState } from "react";
import {
  nearestBeatTime,
  type PlacedPerformingClip,
} from "@/lib/composition";

interface CompositionTimelineProps {
  layout: PlacedPerformingClip[];
  beats: number[];
  duration: number;
  currentTime: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSeek: (time: number) => void;
  onResize: (id: string, duration: number) => void;
  onReorder: (ids: string[]) => void;
}

export function CompositionTimeline({
  layout,
  beats,
  duration,
  currentTime,
  selectedId,
  onSelect,
  onSeek,
  onResize,
  onReorder,
}: CompositionTimelineProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const timelineDuration = Math.max(
    duration,
    layout.at(-1)?.timelineEnd ?? 0,
    1,
  );
  const percentage = (time: number) => (time / timelineDuration) * 100;
  const timeAtX = (clientX: number) => {
    const bounds = laneRef.current?.getBoundingClientRect();
    if (!bounds) return 0;
    const x = Math.max(0, Math.min(bounds.width, clientX - bounds.left));
    return (x / bounds.width) * timelineDuration;
  };

  const startResize = (
    event: React.PointerEvent,
    clip: PlacedPerformingClip,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const move = (pointerEvent: PointerEvent) => {
      const rawEnd = timeAtX(pointerEvent.clientX);
      const snappedEnd = nearestBeatTime(beats, rawEnd);
      onResize(clip.id, Math.max(0.2, snappedEnd - clip.timelineStart));
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const startReorder = (
    event: React.PointerEvent,
    clip: PlacedPerformingClip,
  ) => {
    const startX = event.clientX;
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
        const dropTime = timeAtX(pointerEvent.clientX);
        const remaining = layout.filter((item) => item.id !== clip.id);
        const insertAt = remaining.filter(
          (item) => dropTime > (item.timelineStart + item.timelineEnd) / 2,
        ).length;
        const ids = remaining.map((item) => item.id);
        ids.splice(insertAt, 0, clip.id);
        onReorder(ids);
      }
      setDraggingId(null);
      setDragOffset(0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  return (
    <div
      ref={laneRef}
      className="relative h-16 overflow-hidden rounded-lg border border-white/[0.07] bg-black/70"
      onClick={(event) => {
        onSeek(timeAtX(event.clientX));
        onSelect(null);
      }}
    >
      {beats.map((beat, index) => (
        <span
          key={`${beat}-${index}`}
          className={`pointer-events-none absolute inset-y-0 w-px ${
            index % 8 === 0 ? "bg-violet-300/25" : "bg-white/[0.055]"
          }`}
          style={{ left: `${percentage(beat)}%` }}
        />
      ))}

      {layout.map((clip, index) => {
        const selected = selectedId === clip.id;
        const dragging = draggingId === clip.id;
        return (
          <div
            key={clip.id}
            onPointerDown={(event) => startReorder(event, clip)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(clip.id);
            }}
            className={`absolute inset-y-2 min-w-8 cursor-grab overflow-hidden rounded-md border px-2 py-1 transition-colors active:cursor-grabbing ${
              selected
                ? "border-violet-300/60 bg-violet-400/25"
                : "border-violet-300/15 bg-violet-400/10 hover:bg-violet-400/15"
            } ${dragging ? "z-20 opacity-80 shadow-xl" : ""}`}
            style={{
              left: `${percentage(clip.timelineStart)}%`,
              width: `${percentage(clip.timelineDuration)}%`,
              transform: dragging ? `translateX(${dragOffset}px)` : undefined,
            }}
            title={clip.name}
          >
            <p className="truncate text-[10px] font-medium text-violet-100">
              {index + 1}. {clip.name}
            </p>
            <p className="mt-0.5 truncate text-[9px] text-violet-200/45">
              {clip.timelineDuration.toFixed(1)}s · ×{clip.playbackRate.toFixed(2)}
            </p>
            <button
              type="button"
              aria-label={`Resize ${clip.name}`}
              onPointerDown={(event) => startResize(event, clip)}
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize border-l border-violet-200/20 bg-violet-200/10 hover:bg-violet-200/25"
            />
          </div>
        );
      })}

      <span
        className="pointer-events-none absolute inset-y-0 z-30 w-px bg-white shadow-[0_0_8px_rgba(255,255,255,.7)]"
        style={{ left: `${percentage(currentTime)}%` }}
      />
    </div>
  );
}
