"use client";

import { useRef, useState } from "react";
import type {
  FormationAudiencePosition,
  FormationPosition,
} from "@/lib/types";
import { FORMATION_COLORS } from "@/lib/formations";
import { cn } from "@/lib/cn";

interface FormationStageEditorProps {
  positions: FormationPosition[];
  audiencePosition?: FormationAudiencePosition;
  editable: boolean;
  onChange: (positions: FormationPosition[]) => void;
  onEditStart?: () => void;
  framed?: boolean;
  transparentBackground?: boolean;
}

const STAGE_WIDTH = 1000;
const STAGE_HEIGHT = 562;
const MARKER_RADIUS = 27;
const GRID_STEP = 0.05;

interface Point {
  x: number;
  y: number;
}

export function FormationStageEditor({
  positions,
  audiencePosition = "bottom",
  editable,
  onChange,
  onEditStart,
  framed = true,
  transparentBackground = false,
}: FormationStageEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<{
    pointerId: number;
    originPointer: Point;
    originClient: Point;
    origins: FormationPosition[];
    latestDelta: Point;
    constrainedAxis: "x" | "y" | null;
  } | null>(null);
  const marqueeRef = useRef<{
    pointerId: number;
    start: Point;
    additive: boolean;
  } | null>(null);
  const [selectedDancers, setSelectedDancers] = useState<Set<number>>(
    () => new Set(),
  );
  const [selectionBox, setSelectionBox] = useState<{
    start: Point;
    end: Point;
  } | null>(null);

  const pointFromEvent = (
    event: React.PointerEvent<SVGSVGElement | SVGGElement>,
  ): Point | null => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return {
      x: Math.max(0, Math.min(1, local.x / STAGE_WIDTH)),
      y: Math.max(0, Math.min(1, local.y / STAGE_HEIGHT)),
    };
  };

  const clampGroupDelta = (
    origins: FormationPosition[],
    delta: Point,
  ): Point => {
    const insetX = MARKER_RADIUS / STAGE_WIDTH;
    const insetY = MARKER_RADIUS / STAGE_HEIGHT;
    const minimumX = Math.max(...origins.map((position) => insetX - position.x));
    const maximumX = Math.min(
      ...origins.map((position) => 1 - insetX - position.x),
    );
    const minimumY = Math.max(...origins.map((position) => insetY - position.y));
    const maximumY = Math.min(
      ...origins.map((position) => 1 - insetY - position.y),
    );
    return {
      x: Math.max(minimumX, Math.min(maximumX, delta.x)),
      y: Math.max(minimumY, Math.min(maximumY, delta.y)),
    };
  };

  const positionsWithDelta = (
    origins: FormationPosition[],
    delta: Point,
  ): FormationPosition[] => {
    const originByDancer = new Map(
      origins.map((position) => [position.dancer, position]),
    );
    return positions.map((position) => {
      const origin = originByDancer.get(position.dancer);
      return origin
        ? {
            ...position,
            x: Math.round((origin.x + delta.x) * 1000) / 1000,
            y: Math.round((origin.y + delta.y) * 1000) / 1000,
          }
        : position;
    });
  };

  const moveSelection = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = draggingRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      const point = pointFromEvent(event);
      if (!point) return;
      let delta = {
        x: point.x - drag.originPointer.x,
        y: point.y - drag.originPointer.y,
      };
      drag.constrainedAxis = null;
      if (event.shiftKey) {
        drag.constrainedAxis =
          Math.abs(event.clientX - drag.originClient.x) >=
          Math.abs(event.clientY - drag.originClient.y)
            ? "x"
            : "y";
        delta =
          drag.constrainedAxis === "x"
            ? { x: delta.x, y: 0 }
            : { x: 0, y: delta.y };
      }
      drag.latestDelta = clampGroupDelta(drag.origins, delta);
      onChange(positionsWithDelta(drag.origins, drag.latestDelta));
      return;
    }

    const marquee = marqueeRef.current;
    if (marquee && marquee.pointerId === event.pointerId) {
      const point = pointFromEvent(event);
      if (point) setSelectionBox({ start: marquee.start, end: point });
    }
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
      onPointerDown={(event) => {
        if (!editable) return;
        const point = pointFromEvent(event);
        if (!point) return;
        event.preventDefault();
        if (!event.shiftKey) setSelectedDancers(new Set());
        marqueeRef.current = {
          pointerId: event.pointerId,
          start: point,
          additive: event.shiftKey,
        };
        setSelectionBox({ start: point, end: point });
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={moveSelection}
      onPointerUp={(event) => {
        const drag = draggingRef.current;
        if (drag && drag.pointerId === event.pointerId) {
          const anchor = drag.origins[0];
          let snappedDelta = {
            x:
              drag.constrainedAxis === "y"
                ? 0
                : Math.round(
                    (anchor.x + drag.latestDelta.x) / GRID_STEP,
                  ) *
                    GRID_STEP -
                  anchor.x,
            y:
              drag.constrainedAxis === "x"
                ? 0
                : Math.round(
                    (anchor.y + drag.latestDelta.y) / GRID_STEP,
                  ) *
                    GRID_STEP -
                  anchor.y,
          };
          snappedDelta = clampGroupDelta(drag.origins, snappedDelta);
          onChange(positionsWithDelta(drag.origins, snappedDelta));
          draggingRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          return;
        }

        const marquee = marqueeRef.current;
        if (marquee && marquee.pointerId === event.pointerId) {
          const end = pointFromEvent(event) ?? marquee.start;
          const minimumX = Math.min(marquee.start.x, end.x);
          const maximumX = Math.max(marquee.start.x, end.x);
          const minimumY = Math.min(marquee.start.y, end.y);
          const maximumY = Math.max(marquee.start.y, end.y);
          const next = marquee.additive
            ? new Set(selectedDancers)
            : new Set<number>();
          for (const position of positions) {
            if (
              position.x >= minimumX &&
              position.x <= maximumX &&
              position.y >= minimumY &&
              position.y <= maximumY
            ) {
              next.add(position.dancer);
            }
          }
          setSelectedDancers(next);
          marqueeRef.current = null;
          setSelectionBox(null);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        draggingRef.current = null;
        marqueeRef.current = null;
        setSelectionBox(null);
      }}
      className={cn(
        "aspect-video h-full max-h-full w-full touch-none",
        transparentBackground ? "bg-transparent" : "bg-[#080808]",
        framed && "rounded-xl border border-white/10",
      )}
      aria-label="走位舞台"
    >
      <rect
        x="0"
        y="0"
        width="1000"
        height="562"
        fill={transparentBackground ? "transparent" : "#080808"}
      />
      {editable &&
        Array.from({ length: 19 }, (_, index) => index + 1).map((index) => (
          <line
            key={`grid-x-${index}`}
            x1={index * GRID_STEP * STAGE_WIDTH}
            y1="0"
            x2={index * GRID_STEP * STAGE_WIDTH}
            y2={STAGE_HEIGHT}
            stroke="rgba(255,255,255,0.045)"
            strokeWidth="1"
          />
        ))}
      {editable &&
        Array.from({ length: 19 }, (_, index) => index + 1).map((index) => (
          <line
            key={`grid-y-${index}`}
            x1="0"
            y1={index * GRID_STEP * STAGE_HEIGHT}
            x2={STAGE_WIDTH}
            y2={index * GRID_STEP * STAGE_HEIGHT}
            stroke="rgba(255,255,255,0.045)"
            strokeWidth="1"
          />
        ))}
      <line
        x1="500"
        y1="0"
        x2="500"
        y2="562"
        stroke="rgba(255,255,255,0.1)"
        strokeDasharray="10 10"
      />
      <line
        x1="0"
        y1="281"
        x2="1000"
        y2="281"
        stroke="rgba(255,255,255,0.1)"
        strokeDasharray="10 10"
      />
      <g
        transform={
          audiencePosition === "top"
            ? "translate(500 36)"
            : audiencePosition === "bottom"
              ? "translate(500 526)"
              : audiencePosition === "left"
                ? "translate(36 281) rotate(-90)"
                : "translate(964 281) rotate(90)"
        }
        className="pointer-events-none"
      >
        <rect
          x="-77"
          y="-23"
          width="154"
          height="46"
          rx="23"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.14)"
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.82)"
          fontSize="26"
          fontWeight="600"
        >
          观众
        </text>
      </g>
      {positions.map((position) => (
        <g
          key={position.dancer}
          transform={`translate(${position.x * STAGE_WIDTH} ${position.y * STAGE_HEIGHT})`}
          onPointerDown={(event) => {
            if (!editable) return;
            event.preventDefault();
            event.stopPropagation();
            const point = pointFromEvent(event);
            if (!point) return;
            let nextSelection = new Set(selectedDancers);
            if (event.shiftKey && nextSelection.has(position.dancer)) {
              nextSelection.delete(position.dancer);
              setSelectedDancers(nextSelection);
              return;
            }
            if (event.shiftKey) {
              nextSelection.add(position.dancer);
            } else if (!nextSelection.has(position.dancer)) {
              nextSelection = new Set([position.dancer]);
            }
            setSelectedDancers(nextSelection);
            onEditStart?.();
            const origins = positions
              .filter((item) => nextSelection.has(item.dancer))
              .map((item) => ({ ...item }));
            draggingRef.current = {
              pointerId: event.pointerId,
              originPointer: point,
              originClient: { x: event.clientX, y: event.clientY },
              origins,
              latestDelta: { x: 0, y: 0 },
              constrainedAxis: null,
            };
            event.currentTarget.ownerSVGElement?.setPointerCapture(
              event.pointerId,
            );
          }}
          className={editable ? "cursor-grab active:cursor-grabbing" : ""}
        >
          {editable && selectedDancers.has(position.dancer) && (
            <circle
              r={MARKER_RADIUS + 8}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="4"
              strokeDasharray="7 5"
              className="pointer-events-none"
            />
          )}
          <circle
            r={MARKER_RADIUS}
            fill={
              FORMATION_COLORS[
                (position.dancer - 1) % FORMATION_COLORS.length
              ]
            }
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="4"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize="25"
            fontWeight="600"
            className="pointer-events-none select-none"
          >
            {position.dancer}
          </text>
        </g>
      ))}
      {editable && selectionBox && (
        <rect
          x={Math.min(selectionBox.start.x, selectionBox.end.x) * STAGE_WIDTH}
          y={Math.min(selectionBox.start.y, selectionBox.end.y) * STAGE_HEIGHT}
          width={
            Math.abs(selectionBox.end.x - selectionBox.start.x) * STAGE_WIDTH
          }
          height={
            Math.abs(selectionBox.end.y - selectionBox.start.y) * STAGE_HEIGHT
          }
          fill="rgba(96,165,250,0.12)"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeDasharray="8 6"
          className="pointer-events-none"
        />
      )}
    </svg>
  );
}
