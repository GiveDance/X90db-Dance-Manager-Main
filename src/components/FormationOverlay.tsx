"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import type {
  FormationAudiencePosition,
  FormationChange,
} from "@/lib/types";
import { formationAtTime } from "@/lib/formations";
import { FormationStageEditor } from "./FormationStageEditor";

interface Position {
  x: number;
  y: number;
}

const MARGIN = 16;

export function FormationOverlay({
  onEdit,
  onDismiss,
  changes,
  audiencePosition,
  currentTime,
}: {
  onEdit: () => void;
  onDismiss: () => void;
  changes: FormationChange[];
  audiencePosition: FormationAudiencePosition;
  currentTime: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: Position;
  } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const host = panel?.parentElement;
    if (!panel || !host) return;

    const updatePosition = () => {
      const maxX = Math.max(MARGIN, host.clientWidth - panel.offsetWidth - MARGIN);
      const maxY = Math.max(MARGIN, host.clientHeight - panel.offsetHeight - MARGIN);
      setPosition((current) =>
        current
          ? {
              x: Math.min(Math.max(MARGIN, current.x), maxX),
              y: Math.min(Math.max(MARGIN, current.y), maxY),
            }
          : { x: maxX, y: maxY },
      );
    };

    const observer = new ResizeObserver(updatePosition);
    observer.observe(host);
    observer.observe(panel);
    updatePosition();
    return () => observer.disconnect();
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!position || (event.target as Element).closest("button")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    const host = panel?.parentElement;
    if (!drag || drag.pointerId !== event.pointerId || !panel || !host) return;
    const maxX = Math.max(MARGIN, host.clientWidth - panel.offsetWidth - MARGIN);
    const maxY = Math.max(MARGIN, host.clientHeight - panel.offsetHeight - MARGIN);
    setPosition({
      x: Math.min(
        Math.max(MARGIN, drag.origin.x + event.clientX - drag.startX),
        maxX,
      ),
      y: Math.min(
        Math.max(MARGIN, drag.origin.y + event.clientY - drag.startY),
        maxY,
      ),
    });
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={panelRef}
      style={{
        transform: `translate3d(${position?.x ?? 0}px, ${position?.y ?? 0}px, 0)`,
        opacity: position ? 1 : 0,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      className="group absolute left-0 top-0 z-20 w-72 max-w-[calc(100%-2rem)] touch-none select-none overflow-hidden rounded-xl border border-white/15 bg-black/20 shadow-2xl backdrop-blur-xl transition-opacity cursor-move"
    >
      <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-black/25 p-1 opacity-0 backdrop-blur-md transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <button
          type="button"
          data-tooltip="编辑走位"
          aria-label="编辑走位"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          data-tooltip="关闭走位"
          aria-label="关闭走位"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDismiss}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {changes.length > 0 ? (
        <div className="aspect-[1000/562] w-full">
          <FormationStageEditor
            positions={formationAtTime(changes, currentTime)}
            audiencePosition={audiencePosition}
            editable={false}
            framed={false}
            transparentBackground
            onChange={() => undefined}
          />
        </div>
      ) : (
        <div className="flex min-h-36 flex-col items-center justify-center px-5 py-6 text-center">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onEdit}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
          >
            <Pencil className="h-4 w-4" />
            编辑走位
          </button>
        </div>
      )}
    </div>
  );
}
