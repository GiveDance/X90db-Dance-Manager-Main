"use client";

import { useRef, useState } from "react";
import type { FormationChange } from "@/lib/types";
import { cn } from "@/lib/cn";
import { snapTimeToBeat } from "@/lib/formations";
import { formatTime } from "@/lib/format";
import {
  TimelineNavigationControls,
  useTimelineNavigation,
} from "./TimelineNavigation";

interface FormationTimelineProps {
  changes: FormationChange[];
  duration: number;
  bpm: number;
  offset: number;
  beatTimes: number[];
  currentTime: number;
  selectedId: string | null;
  onPreview: (time: number) => void;
  onSelect: (id: string) => void;
  onResizeStart: () => void;
  onResize: (id: string, startTime: number, endTime: number) => void;
  onCreate: (startTime: number, endTime: number) => void;
}

export function FormationTimeline({
  changes,
  duration,
  bpm,
  offset,
  beatTimes,
  currentTime,
  selectedId,
  onPreview,
  onSelect,
  onResizeStart,
  onResize,
  onCreate,
}: FormationTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{
    id: string;
    endpoint: "start" | "end";
  } | null>(null);
  const seekingRef = useRef<number | null>(null);
  const createRef = useRef<{ startTime: number; moved: boolean } | null>(null);
  const [creating, setCreating] = useState<{
    startTime: number;
    currentTime: number;
  } | null>(null);
  const navigation = useTimelineNavigation(duration);
  const { zoom, viewportRef, syncScrollMetrics } = navigation;
  const pct = (time: number) => (duration > 0 ? (time / duration) * 100 : 0);
  const rawTimeFromX = (clientX: number) => {
    const track = trackRef.current;
    if (!track || duration <= 0) return 0;
    const rect = track.getBoundingClientRect();
    return (
      Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration
    );
  };
  const timeFromX = (clientX: number) =>
    snapTimeToBeat(rawTimeFromX(clientX), bpm, offset, duration, beatTimes);
  const ticks = [0];
  const baseTickStep = duration <= 60 ? 10 : 30;
  const tickStep =
    zoom >= 6
      ? Math.max(5, baseTickStep / 4)
      : zoom >= 3
        ? Math.max(5, baseTickStep / 2)
        : baseTickStep;
  for (let time = tickStep; time < duration - tickStep * 0.4; time += tickStep) {
    ticks.push(time);
  }
  if (duration > 0 && Math.abs(ticks.at(-1)! - duration) > 0.01) {
    ticks.push(duration);
  }
  const beatGuides = beatTimes
    .filter((time) => Number.isFinite(time) && time >= 0 && time <= duration)
    .map((time, index) => ({ time, strong: index % 8 === 0 }));

  return (
    <div className="flex shrink-0 flex-col border-t border-white/5 bg-black px-5 pb-2.5 pt-2.5">
      <TimelineNavigationControls
        navigation={navigation}
        className="order-2"
      />
      <div
        ref={viewportRef}
        onScroll={syncScrollMetrics}
        className="order-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="min-w-full"
          style={{ width: `${zoom * 100}%` }}
        >
          <div className="relative h-4 text-[10px] tabular-nums text-neutral-500">
            {ticks.map((time, index) => (
              <span
                key={time}
                className={cn(
                  "absolute",
                  index > 0 &&
                    index < ticks.length - 1 &&
                    "-translate-x-1/2",
                )}
                style={
                  index === 0
                    ? { left: 0 }
                    : index === ticks.length - 1
                      ? { right: 0 }
                      : { left: `${pct(time)}%` }
                }
              >
                {formatTime(time)}
              </span>
            ))}
          </div>
          <div
            ref={trackRef}
        onPointerDown={(event) => {
          if (duration <= 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const time = timeFromX(event.clientX);
          createRef.current = { startTime: time, moved: false };
          setCreating({ startTime: time, currentTime: time });
        }}
        onPointerMove={(event) => {
          if (seekingRef.current === event.pointerId) {
            onPreview(rawTimeFromX(event.clientX));
            return;
          }

          const resize = resizeRef.current;
          if (resize) {
            const change = changes.find((item) => item.id === resize.id);
            if (!change) return;
            const time = timeFromX(event.clientX);
            onResize(
              resize.id,
              resize.endpoint === "start"
                ? Math.min(time, change.endTime)
                : change.startTime,
              resize.endpoint === "end"
                ? Math.max(time, change.startTime)
                : change.endTime,
            );
            return;
          }

          const creation = createRef.current;
          if (!creation) return;
          const time = timeFromX(event.clientX);
          if (Math.abs(time - creation.startTime) > (60 / bpm) * 0.4) {
            creation.moved = true;
          }
          setCreating({
            startTime: creation.startTime,
            currentTime: time,
          });
        }}
        onPointerUp={(event) => {
          if (seekingRef.current === event.pointerId) {
            onPreview(rawTimeFromX(event.clientX));
            seekingRef.current = null;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            return;
          }

          if (resizeRef.current) {
            resizeRef.current = null;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            return;
          }
          const creation = createRef.current;
          createRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          if (creation) {
            const endTime = timeFromX(event.clientX);
            if (creation.moved) {
              onCreate(
                Math.min(creation.startTime, endTime),
                Math.max(creation.startTime, endTime),
              );
            } else {
              onPreview(creation.startTime);
            }
          }
          setCreating(null);
        }}
        onPointerCancel={() => {
          seekingRef.current = null;
          resizeRef.current = null;
          createRef.current = null;
          setCreating(null);
        }}
        className="relative h-12 cursor-pointer overflow-hidden rounded-lg border border-white/[0.07] bg-neutral-950"
      >
        <div className="pointer-events-none absolute inset-0">
          {beatGuides.map((beat, index) => (
            <span
              key={`${beat.time}-${index}`}
              className={cn(
                "absolute bottom-0 top-0 w-px",
                beat.strong ? "bg-blue-400/30" : "bg-white/[0.04]",
              )}
              style={{ left: `${pct(beat.time)}%` }}
            />
          ))}
          {beatGuides.map((beat, index) => (
            <span
              key={`dot-${beat.time}-${index}`}
              className={cn(
                "absolute bottom-0 h-[3px] w-1.5 -translate-x-1/2 rounded-t-full",
                beat.strong ? "bg-blue-300/55" : "bg-neutral-500/25",
              )}
              style={{ left: `${pct(beat.time)}%` }}
            />
          ))}
        </div>
        {changes.map((change, index) => {
          const left = pct(change.startTime);
          const width = Math.max(0.6, pct(change.endTime) - left);
          const active =
            currentTime >= change.startTime && currentTime <= change.endTime;
          return (
            <div
              key={change.id}
              data-formation-range
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect(change.id);
              }}
              className={cn(
                "absolute bottom-1 top-1 flex items-center overflow-hidden rounded-md border px-2 text-left text-[11px] font-medium transition-colors",
                selectedId === change.id
                  ? "border-[#60a5fa8c] bg-blue-500/50 text-white shadow-[0_0_12px_rgba(59,130,246,0.18)]"
                  : active
                    ? "border-[#60a5fa73] bg-blue-500/32 text-blue-100"
                    : "border-[#3b82f64d] bg-blue-500/20 text-blue-200 hover:border-[#60a5fa80] hover:bg-blue-500/28 active:border-[#60a5fa]",
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="block w-full truncate text-left">
                变化 {index + 1}
              </span>
              <span
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onResizeStart();
                  resizeRef.current = {
                    id: change.id,
                    endpoint: "start",
                  };
                  trackRef.current?.setPointerCapture(event.pointerId);
                }}
                className="absolute bottom-0 left-0 top-0 w-1 cursor-ew-resize bg-blue-300/0 hover:bg-blue-300/40"
              />
              <span
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onResizeStart();
                  resizeRef.current = {
                    id: change.id,
                    endpoint: "end",
                  };
                  trackRef.current?.setPointerCapture(event.pointerId);
                }}
                className="absolute bottom-0 right-0 top-0 w-1 cursor-ew-resize bg-blue-300/0 hover:bg-blue-300/40"
              />
            </div>
          );
        })}
        {creating &&
          Math.abs(creating.currentTime - creating.startTime) > 0.4 && (
            <div
              className="pointer-events-none absolute bottom-1 top-1 rounded-md border border-blue-300/70 bg-blue-300/20"
              style={{
                left: `${pct(
                  Math.min(creating.startTime, creating.currentTime),
                )}%`,
                width: `${Math.abs(
                  pct(creating.currentTime) - pct(creating.startTime),
                )}%`,
              }}
            />
          )}
        <div
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            seekingRef.current = event.pointerId;
            onPreview(rawTimeFromX(event.clientX));
            trackRef.current?.setPointerCapture(event.pointerId);
          }}
          role="slider"
          aria-label="拖动当前时间"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          className="absolute bottom-0 top-0 z-10 w-4 -translate-x-1/2 cursor-ew-resize touch-none"
          style={{ left: `${pct(currentTime)}%` }}
        >
          <span className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_5px_rgba(255,255,255,0.45)]" />
          <span className="pointer-events-none absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white" />
        </div>
      </div>
      </div>
    </div>
    </div>
  );
}
