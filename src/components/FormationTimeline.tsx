"use client";

import { useRef, useState } from "react";
import type { FormationChange } from "@/lib/types";
import { cn } from "@/lib/cn";
import { snapTimeToBeat } from "@/lib/formations";
import { formatTime } from "@/lib/format";
import {
  shouldCondenseTimelineBeats,
  shouldShowTimelineBeat,
  TimelineNavigationControls,
  useTimelineNavigation,
} from "./TimelineNavigation";
import { useLanguage } from "@/i18n/LanguageProvider";

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
  const { language, t } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef<number | null>(null);
  const createRef = useRef<{ startTime: number; moved: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [creating, setCreating] = useState<{
    startTime: number;
    currentTime: number;
  } | null>(null);
  const navigation = useTimelineNavigation(duration);
  const { zoom, viewportId, viewportRef, syncScrollMetrics } = navigation;
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
  const snapTime = (time: number) =>
    snapTimeToBeat(time, bpm, offset, duration, beatTimes);
  const startResize = (
    event: React.PointerEvent,
    change: FormationChange,
    endpoint: "start" | "end",
  ) => {
    event.stopPropagation();
    event.preventDefault();
    onResizeStart();
    const move = (pointerEvent: PointerEvent) => {
      const time = timeFromX(pointerEvent.clientX);
      onResize(
        change.id,
        endpoint === "start"
          ? Math.min(time, change.endTime)
          : change.startTime,
        endpoint === "end"
          ? Math.max(time, change.startTime)
          : change.endTime,
      );
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const startMove = (
    event: React.PointerEvent,
    change: FormationChange,
  ) => {
    event.stopPropagation();
    const startX = event.clientX;
    const grabOffset = rawTimeFromX(event.clientX) - change.startTime;
    const changeDuration = change.endTime - change.startTime;
    let moved = false;
    onSelect(change.id);

    const move = (pointerEvent: PointerEvent) => {
      const offsetPx = pointerEvent.clientX - startX;
      if (Math.abs(offsetPx) <= 4) return;
      if (!moved) onResizeStart();
      moved = true;
      setDraggingId(change.id);
      setDragOffset(offsetPx);
    };
    const end = (pointerEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (moved) {
        const maxStart = Math.max(0, duration - changeDuration);
        const start = Math.max(
          0,
          Math.min(
            maxStart,
            snapTime(rawTimeFromX(pointerEvent.clientX) - grabOffset),
          ),
        );
        onResize(change.id, start, start + changeDuration);
      }
      setDraggingId(null);
      setDragOffset(0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
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
    .map((time, index, all) => ({
      time,
      index,
      primary: index % 8 === 0,
      secondary: index % 8 === 4,
      beatCount: all.length,
    }))
    .filter((beat) =>
      shouldShowTimelineBeat(beat.index, beat.beatCount, zoom),
    );

  return (
    <div className="flex shrink-0 flex-col bg-neutral-950 px-5 pb-0 pt-2.5">
      <TimelineNavigationControls
        navigation={navigation}
        className="order-2"
      />
      <div
        ref={viewportRef}
        id={viewportId}
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
                beat.primary
                  ? "bg-[#25568aa6]"
                  : beat.secondary
                    ? shouldCondenseTimelineBeats(beat.beatCount, zoom)
                      ? "bg-white/[0.04]"
                      : "bg-white/[0.10]"
                    : "bg-white/[0.04]",
              )}
              style={{ left: `${pct(beat.time)}%` }}
            />
          ))}
          {beatGuides.filter((beat) => beat.primary).map((beat, index) => (
            <span
              key={`dot-${beat.time}-${index}`}
              className="absolute bottom-0 h-[3px] w-1.5 -translate-x-1/2 rounded-t-full bg-blue-300/55"
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
              onPointerDown={(event) => startMove(event, change)}
              className={cn(
                "absolute bottom-1 top-1 flex min-w-8 cursor-grab items-center overflow-hidden rounded-md border py-0 pl-4 pr-3 transition-colors active:cursor-grabbing",
                selectedId === change.id
                  ? "border-[#6ba1d2] bg-[#2f6198db] text-white shadow-[0_0_12px_rgba(59,130,246,0.18)]"
                  : active
                    ? "border-[#4d83ba] bg-[#234b7adb] text-blue-100"
                    : "border-[#25568a] bg-[#142b4adb] text-blue-200 hover:border-[#3c78b5] hover:bg-[#1c3d67db] active:border-[#4d83ba] active:bg-[#234b7adb]",
                draggingId === change.id && "z-20 opacity-80 shadow-xl",
              )}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                transform:
                  draggingId === change.id
                    ? `translateX(${dragOffset}px)`
                    : undefined,
              }}
            >
              <button
                type="button"
                aria-label={
                  language === "en"
                    ? `Adjust the start of transition ${index + 1}`
                    : `调整变化 ${index + 1} 的开始位置`
                }
                onPointerDown={(event) =>
                  startResize(event, change, "start")
                }
                className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-[#1d4268db] hover:bg-[#2b5f91db]"
              />
              <p className="w-full truncate text-left text-[11px] font-medium">
                {language === "en" ? `Transition ${index + 1}` : `变化 ${index + 1}`}
              </p>
              <button
                type="button"
                aria-label={
                  language === "en"
                    ? `Adjust the end of transition ${index + 1}`
                    : `调整变化 ${index + 1} 的结束位置`
                }
                onPointerDown={(event) => startResize(event, change, "end")}
                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-[#1d4268db] hover:bg-[#2b5f91db]"
              />
            </div>
          );
        })}
        {creating &&
          Math.abs(creating.currentTime - creating.startTime) > 0.4 && (
            <div
              className="pointer-events-none absolute bottom-1 top-1 rounded-md border border-[#6ba1d2] bg-[#234b7adb]"
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
          aria-label={t("拖动当前时间")}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          className="absolute bottom-0 top-0 z-10 w-4 -translate-x-1/2 cursor-ew-resize touch-none"
          style={{ left: `${pct(currentTime)}%` }}
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,.7)]" />
        </div>
      </div>
      </div>
    </div>
    </div>
  );
}
