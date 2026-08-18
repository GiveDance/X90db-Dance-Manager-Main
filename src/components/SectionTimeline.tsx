"use client";

import { useRef, useState } from "react";
import { X, Repeat } from "lucide-react";
import type { DanceSection, Segment } from "@/lib/types";
import { nearestSegEnd, nearestSegStart, sectionTimeRange } from "@/lib/segments";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  shouldCondenseTimelineBeats,
  shouldShowTimelineBeat,
  TimelineNavigationControls,
  useTimelineNavigation,
} from "./TimelineNavigation";

interface SectionTimelineProps {
  segments: Segment[];
  sections: DanceSection[];
  duration: number;
  currentTime: number;
  activeSectionIndex: number;
  sectionLoopKey: number | null;
  onSeek: (t: number) => void;
  onToggleSectionLoop: (i: number) => void;
  onResizeSection: (i: number, startSeg: number, endSeg: number) => void;
  onCreateSection: (startSeg: number, endSeg: number) => void;
  onStopLoop: () => void;
}

export function SectionTimeline({
  segments,
  sections,
  duration,
  currentTime,
  activeSectionIndex,
  sectionLoopKey,
  onSeek,
  onToggleSectionLoop,
  onResizeSection,
  onCreateSection,
  onStopLoop,
}: SectionTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef<number | null>(null);
  const createRef = useRef<{ startT: number; moved: boolean } | null>(null);
  const suppressLoopClickRef = useRef(false);
  const [creating, setCreating] = useState<{ startT: number; curT: number } | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const navigation = useTimelineNavigation(duration);
  const { zoom, viewportRef, syncScrollMetrics } = navigation;

  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);

  const timeFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !duration) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration;
  };

  const startResize = (
    event: React.PointerEvent,
    index: number,
    side: "left" | "right",
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const section = sections[index];
    if (!section) return;
    if (sectionLoopKey === index) onStopLoop();

    const move = (pointerEvent: PointerEvent) => {
      const time = timeFromX(pointerEvent.clientX);
      if (side === "left") {
        const start = Math.min(
          nearestSegStart(segments, time),
          section.endSeg,
        );
        onResizeSection(index, start, section.endSeg);
      } else {
        const end = Math.max(
          nearestSegEnd(segments, time),
          section.startSeg,
        );
        onResizeSection(index, section.startSeg, end);
      }
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
    index: number,
    section: DanceSection,
    range: { start: number; end: number },
  ) => {
    event.stopPropagation();
    const startX = event.clientX;
    const grabOffset = timeFromX(event.clientX) - range.start;
    const segmentSpan = section.endSeg - section.startSeg;
    let moved = false;

    const move = (pointerEvent: PointerEvent) => {
      const offset = pointerEvent.clientX - startX;
      if (Math.abs(offset) <= 4) return;
      moved = true;
      setDraggingIndex(index);
      setDragOffset(offset);
    };
    const end = (pointerEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (moved) {
        if (sectionLoopKey === index) onStopLoop();
        const desiredStart = nearestSegStart(
          segments,
          timeFromX(pointerEvent.clientX) - grabOffset,
        );
        const maxStart = Math.max(0, segments.length - 1 - segmentSpan);
        const start = Math.max(0, Math.min(maxStart, desiredStart));
        onResizeSection(index, start, start + segmentSpan);
        suppressLoopClickRef.current = true;
        window.setTimeout(() => {
          suppressLoopClickRef.current = false;
        }, 0);
      }
      setDraggingIndex(null);
      setDragOffset(0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  // —— 空白区域：拖动=框选新建，点击=跳转 ——
  const onTrackDown = (e: React.PointerEvent) => {
    trackRef.current?.setPointerCapture(e.pointerId);
    const t = timeFromX(e.clientX);
    createRef.current = { startT: t, moved: false };
    setCreating({ startT: t, curT: t });
  };
  const onTrackMove = (e: React.PointerEvent) => {
    if (seekingRef.current === e.pointerId) {
      onSeek(timeFromX(e.clientX));
      return;
    }
    const c = createRef.current;
    if (!c) return;
    const t = timeFromX(e.clientX);
    if (Math.abs(t - c.startT) > 0.4) c.moved = true;
    setCreating((p) => (p ? { ...p, curT: t } : p));
  };
  const onTrackUp = (e: React.PointerEvent) => {
    if (seekingRef.current === e.pointerId) {
      onSeek(timeFromX(e.clientX));
      seekingRef.current = null;
      trackRef.current?.releasePointerCapture?.(e.pointerId);
      return;
    }
    const c = createRef.current;
    createRef.current = null;
    trackRef.current?.releasePointerCapture?.(e.pointerId);
    if (c) {
      const t = timeFromX(e.clientX);
      if (c.moved) {
        const a = Math.min(c.startT, t);
        const b = Math.max(c.startT, t);
        const s = nearestSegStart(segments, a);
        const en = nearestSegEnd(segments, b);
        onCreateSection(Math.min(s, en), Math.max(s, en));
      } else {
        onSeek(c.startT);
      }
    }
    setCreating(null);
  };

  // Scale tick density with the shared timeline zoom level.
  const ticks: number[] = [0];
  const minimumEndGap = Math.max(5, duration * 0.08);
  const tickStep =
    zoom >= 6 ? 7.5 : zoom >= 3 ? 15 : 30;
  for (
    let seconds = tickStep;
    seconds < duration - minimumEndGap;
    seconds += tickStep
  ) {
    ticks.push(seconds);
  }
  if (duration > 0) ticks.push(duration);

  const loopName = sectionLoopKey != null ? sections[sectionLoopKey]?.name : null;
  const beatGuides = segments
    .flatMap((segment) => segment.beats)
    .filter(
      (time, index, all) =>
        time >= 0 &&
        time <= duration &&
        (index === 0 || Math.abs(time - all[index - 1]) > 0.001),
    )
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
    <div className="select-none bg-neutral-950 px-5 pb-0 pt-3">
      {loopName && (
        <div className="mb-1.5 flex items-center">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-md bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
              <Repeat className="h-3 w-3" />
              循环: {loopName}
              <button
                type="button"
                onClick={onStopLoop}
                data-tooltip="取消循环"
                aria-label="取消循环"
                className="ml-0.5 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        onScroll={syncScrollMetrics}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="min-w-full"
          style={{ width: `${zoom * 100}%` }}
        >
          {/* 刻度 */}
          <div className="relative h-4 text-[10px] text-neutral-500">
        {ticks.map((t, index) => (
          <span
            key={t}
            className={cn(
              "absolute tabular-nums",
              index > 0 && index < ticks.length - 1 && "-translate-x-1/2",
            )}
            style={
              index === 0
                ? { left: 0 }
                : index === ticks.length - 1
                  ? { right: 0 }
                  : { left: `${pct(t)}%` }
            }
          >
            {formatTime(t)}
          </span>
        ))}
          </div>

          {/* 轨道 */}
          <div
            ref={trackRef}
            onPointerDown={onTrackDown}
            onPointerMove={onTrackMove}
            onPointerUp={onTrackUp}
            onPointerCancel={() => {
              seekingRef.current = null;
              createRef.current = null;
              setCreating(null);
            }}
            className="relative h-12 w-full cursor-pointer overflow-hidden rounded-lg border border-white/[0.07] bg-neutral-950"
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
        {/* 段落块 */}
        {sections.map((sec, i) => {
          const r = sectionTimeRange(sec, segments);
          if (!r) return null;
          const left = pct(r.start);
          const width = Math.max(0.5, pct(r.end) - left);
          const looping = sectionLoopKey === i;
          const active =
            sectionLoopKey == null && activeSectionIndex === i;
          return (
            <div
              key={sec.id}
              onPointerDown={(event) => startMove(event, i, sec, r)}
              onClick={(e) => {
                e.stopPropagation();
                if (suppressLoopClickRef.current) return;
                onToggleSectionLoop(i);
              }}
              title={`${sec.name}（拖动移动，点击循环）`}
              className={cn(
                "group absolute bottom-1 top-1 flex min-w-8 cursor-grab items-center overflow-hidden rounded-md border py-0 pl-4 pr-3 transition-colors active:cursor-grabbing",
                looping
                  ? "border-[#6ba1d2] bg-[#2f6198db] text-white shadow-[0_0_12px_rgba(59,130,246,0.18)]"
                  : active
                    ? "border-[#4d83ba] bg-[#234b7adb] text-blue-100"
                    : "border-[#25568a] bg-[#142b4adb] text-blue-200 hover:border-[#3c78b5] hover:bg-[#1c3d67db] active:border-[#4d83ba] active:bg-[#234b7adb]",
                draggingIndex === i && "z-20 opacity-80 shadow-xl",
              )}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                transform:
                  draggingIndex === i
                    ? `translateX(${dragOffset}px)`
                    : undefined,
              }}
            >
              <button
                type="button"
                aria-label={`调整 ${sec.name} 的开始位置`}
                onPointerDown={(event) => startResize(event, i, "left")}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-[#1d4268db] hover:bg-[#2b5f91db]"
              />
              <p className="w-full truncate text-left text-[11px] font-medium">
                {sec.name}
              </p>
              <button
                type="button"
                aria-label={`调整 ${sec.name} 的结束位置`}
                onPointerDown={(event) => startResize(event, i, "right")}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-[#1d4268db] hover:bg-[#2b5f91db]"
              />
            </div>
          );
        })}

        {/* 框选预览 */}
        {creating && Math.abs(creating.curT - creating.startT) > 0.4 && (
          <div
            className="pointer-events-none absolute bottom-1 top-1 rounded-md border border-[#6ba1d2] bg-[#234b7adb]"
            style={{
              left: `${pct(Math.min(creating.startT, creating.curT))}%`,
              width: `${Math.abs(pct(creating.curT) - pct(creating.startT))}%`,
            }}
          />
        )}

            {/* 播放头 */}
            <div
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
                seekingRef.current = event.pointerId;
                onSeek(timeFromX(event.clientX));
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
              <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,.7)]" />
            </div>
          </div>
        </div>
      </div>
      <TimelineNavigationControls navigation={navigation} />
    </div>
  );
}
