"use client";

import { useCallback, useRef, useState } from "react";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
}

export function ProgressBar({ currentTime, duration, onSeek }: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const timeFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || !duration) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const displayT = dragging && hoverT != null ? hoverT : currentTime;
  const pct = duration ? (displayT / duration) * 100 : 0;

  return (
    <div
      ref={trackRef}
      className="group relative flex h-4 w-full cursor-pointer items-center select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
        const t = timeFromEvent(e.clientX);
        setHoverT(t);
        onSeek(t);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const t = timeFromEvent(e.clientX);
        setHoverT(t);
        onSeek(t);
      }}
      onPointerUp={(e) => {
        if (dragging) {
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
          setDragging(false);
          setHoverT(null);
        }
      }}
    >
      {/* 轨道 */}
      <div
        className={`relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] ${
          dragging ? "h-1.5" : "h-1 group-hover:h-1.5"
        }`}
      >
        {/* 已播放：渐变 */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* 圆形拖拽点 */}
      <div
        className={`pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform ${
          dragging ? "scale-110" : "scale-0 group-hover:scale-100"
        }`}
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
