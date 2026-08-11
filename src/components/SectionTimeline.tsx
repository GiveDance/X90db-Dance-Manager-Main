"use client";

import { useRef, useState } from "react";
import { X, Repeat } from "lucide-react";
import type { DanceSection, Segment } from "@/lib/types";
import { nearestSegEnd, nearestSegStart, sectionTimeRange } from "@/lib/segments";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

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
  const resizeRef = useRef<{ index: number; side: "left" | "right" } | null>(null);
  const createRef = useRef<{ startT: number; moved: boolean } | null>(null);
  const [creating, setCreating] = useState<{ startT: number; curT: number } | null>(null);

  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);

  const timeFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !duration) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration;
  };

  // —— 拖拽段落边界（吸附八拍）——
  const onHandleDown = (e: React.PointerEvent, index: number, side: "left" | "right") => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { index, side };
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const d = resizeRef.current;
    if (!d) return;
    const t = timeFromX(e.clientX);
    const sec = sections[d.index];
    if (!sec) return;
    if (d.side === "left") {
      const s = Math.min(nearestSegStart(segments, t), sec.endSeg);
      onResizeSection(d.index, s, sec.endSeg);
    } else {
      const en = Math.max(nearestSegEnd(segments, t), sec.startSeg);
      onResizeSection(d.index, sec.startSeg, en);
    }
  };
  const onHandleUp = (e: React.PointerEvent) => {
    if (resizeRef.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      resizeRef.current = null;
    }
  };

  // —— 空白区域：拖动=框选新建，点击=跳转 ——
  const onTrackDown = (e: React.PointerEvent) => {
    trackRef.current?.setPointerCapture(e.pointerId);
    const t = timeFromX(e.clientX);
    createRef.current = { startT: t, moved: false };
    setCreating({ startT: t, curT: t });
  };
  const onTrackMove = (e: React.PointerEvent) => {
    const c = createRef.current;
    if (!c) return;
    const t = timeFromX(e.clientX);
    if (Math.abs(t - c.startT) > 0.4) c.moved = true;
    setCreating((p) => (p ? { ...p, curT: t } : p));
  };
  const onTrackUp = (e: React.PointerEvent) => {
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

  // 刻度：每 30 秒
  const ticks: number[] = [0];
  const minimumEndGap = Math.max(5, duration * 0.08);
  for (
    let seconds = 30;
    seconds < duration - minimumEndGap;
    seconds += 30
  ) {
    ticks.push(seconds);
  }
  if (duration > 0) ticks.push(duration);

  const loopName = sectionLoopKey != null ? sections[sectionLoopKey]?.name : null;

  return (
    <div className="select-none px-5 pt-3">
      {loopName && (
        <div className="mb-1.5 flex items-center">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-md bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
              <Repeat className="h-3 w-3" />
              循环: {loopName}
              <button onClick={onStopLoop} title="取消循环" className="ml-0.5 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        </div>
      )}

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
        className="relative h-12 w-full cursor-pointer overflow-hidden rounded-lg bg-neutral-900"
      >
        {/* 段落块 */}
        {sections.map((sec, i) => {
          const r = sectionTimeRange(sec, segments);
          if (!r) return null;
          const left = pct(r.start);
          const width = Math.max(0.5, pct(r.end) - left);
          const looping = sectionLoopKey === i;
          const active = activeSectionIndex === i;
          return (
            <div
              key={sec.id}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSectionLoop(i);
              }}
              title={`${sec.name}（点击循环）`}
              className={cn(
                "group absolute top-1 bottom-1 flex items-center justify-center overflow-hidden rounded-md border text-xs font-medium transition-colors",
                looping
                  ? "border-blue-400 bg-blue-500 text-white"
                  : active
                    ? "border-blue-400/60 bg-blue-500/30 text-blue-100"
                    : "border-blue-500/30 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25",
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="truncate px-2">{sec.name}</span>
              {/* 左右边界拖拽手柄 */}
              <span
                onPointerDown={(e) => onHandleDown(e, i, "left")}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-blue-300/0 hover:bg-blue-300/40"
              />
              <span
                onPointerDown={(e) => onHandleDown(e, i, "right")}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-blue-300/0 hover:bg-blue-300/40"
              />
            </div>
          );
        })}

        {/* 框选预览 */}
        {creating && Math.abs(creating.curT - creating.startT) > 0.4 && (
          <div
            className="pointer-events-none absolute top-1 bottom-1 rounded-md border border-blue-300/70 bg-blue-300/20"
            style={{
              left: `${pct(Math.min(creating.startT, creating.curT))}%`,
              width: `${Math.abs(pct(creating.curT) - pct(creating.startT))}%`,
            }}
          />
        )}

        {/* 播放头 */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-orange-400"
          style={{ left: `${pct(currentTime)}%` }}
        >
          <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-orange-400" />
        </div>
      </div>
    </div>
  );
}
