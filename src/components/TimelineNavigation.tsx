"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/cn";

const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6, 8] as const;

export function useTimelineNavigation(contentKey: number) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const scrollbarDragRef = useRef<{
    pointerId: number;
    grabOffset: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollMetrics, setScrollMetrics] = useState({
    position: 0,
    visibleRatio: 1,
  });

  const syncScrollMetrics = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    setScrollMetrics({
      position: maxScroll > 0 ? viewport.scrollLeft / maxScroll : 0,
      visibleRatio: Math.min(
        1,
        viewport.clientWidth / Math.max(1, viewport.scrollWidth),
      ),
    });
  };

  const changeZoom = (direction: -1 | 1) => {
    const currentIndex = ZOOM_LEVELS.indexOf(
      zoom as (typeof ZOOM_LEVELS)[number],
    );
    const nextIndex = Math.max(
      0,
      Math.min(ZOOM_LEVELS.length - 1, currentIndex + direction),
    );
    const nextZoom = ZOOM_LEVELS[nextIndex];
    if (nextZoom === zoom) return;
    const viewport = viewportRef.current;
    const anchor = viewport
      ? (viewport.scrollLeft + viewport.clientWidth / 2) /
        Math.max(1, viewport.scrollWidth)
      : 0;
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      if (!viewport) return;
      viewport.scrollLeft = Math.max(
        0,
        anchor * viewport.scrollWidth - viewport.clientWidth / 2,
      );
      syncScrollMetrics();
    });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(syncScrollMetrics);
    window.addEventListener("resize", syncScrollMetrics);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncScrollMetrics);
    };
  }, [zoom, contentKey]);

  const updateScrollFromPointer = (clientX: number, grabOffset: number) => {
    const viewport = viewportRef.current;
    const scrollbar = scrollbarRef.current;
    if (!viewport || !scrollbar) return;
    const rect = scrollbar.getBoundingClientRect();
    const thumbWidth = rect.width * scrollMetrics.visibleRatio;
    const travel = Math.max(0, rect.width - thumbWidth);
    if (travel === 0) return;
    const thumbLeft = Math.max(
      0,
      Math.min(travel, clientX - rect.left - grabOffset),
    );
    viewport.scrollLeft =
      (thumbLeft / travel) *
      Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  };

  const onScrollbarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (scrollMetrics.visibleRatio >= 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const thumbWidth = rect.width * scrollMetrics.visibleRatio;
    const thumbLeft = (rect.width - thumbWidth) * scrollMetrics.position;
    const pointerX = event.clientX - rect.left;
    const grabOffset =
      pointerX >= thumbLeft && pointerX <= thumbLeft + thumbWidth
        ? pointerX - thumbLeft
        : thumbWidth / 2;
    scrollbarDragRef.current = {
      pointerId: event.pointerId,
      grabOffset,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    updateScrollFromPointer(event.clientX, grabOffset);
  };

  const onScrollbarPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = scrollbarDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateScrollFromPointer(event.clientX, drag.grabOffset);
  };

  const onScrollbarPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (scrollbarDragRef.current?.pointerId !== event.pointerId) return;
    scrollbarDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return {
    zoom,
    viewportRef,
    scrollbarRef,
    scrollMetrics,
    syncScrollMetrics,
    changeZoom,
    onScrollbarPointerDown,
    onScrollbarPointerMove,
    onScrollbarPointerUp,
    onScrollbarPointerCancel: () => {
      scrollbarDragRef.current = null;
    },
  };
}

export type TimelineNavigationState = ReturnType<typeof useTimelineNavigation>;

export function TimelineNavigationControls({
  navigation,
  className,
}: {
  navigation: TimelineNavigationState;
  className?: string;
}) {
  const {
    zoom,
    scrollbarRef,
    scrollMetrics,
    changeZoom,
    onScrollbarPointerDown,
    onScrollbarPointerMove,
    onScrollbarPointerUp,
    onScrollbarPointerCancel,
  } = navigation;

  return (
    <div
      data-timeline-navigation
      className={cn("mt-2 flex h-7 items-center gap-2", className)}
    >
      <div className="flex h-7 shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
        <button
          type="button"
          disabled={zoom === ZOOM_LEVELS[0]}
          aria-label="缩小时间线"
          data-tooltip="缩小时间线"
          onClick={() => changeZoom(-1)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="w-10 text-center text-[10px] tabular-nums text-neutral-400">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          disabled={zoom === ZOOM_LEVELS.at(-1)}
          aria-label="放大时间线"
          data-tooltip="放大时间线"
          onClick={() => changeZoom(1)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex h-7 min-w-0 flex-1 items-center rounded-lg border border-white/10 bg-white/5 px-2">
        <div
          ref={scrollbarRef}
          role="scrollbar"
          aria-label="移动时间线"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scrollMetrics.position * 100)}
          onPointerDown={onScrollbarPointerDown}
          onPointerMove={onScrollbarPointerMove}
          onPointerUp={onScrollbarPointerUp}
          onPointerCancel={onScrollbarPointerCancel}
          className={cn(
            "relative h-4 flex-1 touch-none rounded-full",
            scrollMetrics.visibleRatio < 1
              ? "cursor-ew-resize"
              : "cursor-default",
          )}
        >
          <span className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
          <span
            className={cn(
              "absolute bottom-0.5 top-0.5 rounded-full border transition-colors",
              scrollMetrics.visibleRatio < 1
                ? "border-white/15 bg-neutral-500 hover:bg-neutral-400"
                : "border-white/10 bg-neutral-700",
            )}
            style={{
              left: `${scrollMetrics.position * (1 - scrollMetrics.visibleRatio) * 100}%`,
              width: `${scrollMetrics.visibleRatio * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
