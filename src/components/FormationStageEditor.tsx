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
const STAGE_HEIGHT = 562.5;
const MARKER_RADIUS = 27;
const GRID_COLUMNS = 64;
const GRID_ROWS = 36;
const GRID_STEP_X = 1 / GRID_COLUMNS;
const GRID_STEP_Y = 1 / GRID_ROWS;
const POSITION_PRECISION = 1_000_000_000;

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

  const groupDeltaBounds = (origins: FormationPosition[]) => {
    const insetX = MARKER_RADIUS / STAGE_WIDTH;
    const insetY = MARKER_RADIUS / STAGE_HEIGHT;
    return {
      minimumX: Math.max(
        ...origins.map((position) => insetX - position.x),
      ),
      maximumX: Math.min(
        ...origins.map((position) => 1 - insetX - position.x),
      ),
      minimumY: Math.max(
        ...origins.map((position) => insetY - position.y),
      ),
      maximumY: Math.min(
        ...origins.map((position) => 1 - insetY - position.y),
      ),
    };
  };

  const clampGroupDelta = (
    origins: FormationPosition[],
    delta: Point,
  ): Point => {
    const { minimumX, maximumX, minimumY, maximumY } =
      groupDeltaBounds(origins);
    return {
      x: Math.max(minimumX, Math.min(maximumX, delta.x)),
      y: Math.max(minimumY, Math.min(maximumY, delta.y)),
    };
  };

  const snapGroupDelta = (
    origins: FormationPosition[],
    delta: Point,
    constrainedAxis: "x" | "y" | null,
  ): Point => {
    const anchor = origins[0];
    const { minimumX, maximumX, minimumY, maximumY } =
      groupDeltaBounds(origins);
    const snapAxis = (
      anchorPosition: number,
      rawDelta: number,
      step: number,
      minimumDelta: number,
      maximumDelta: number,
    ) => {
      const minimumGridPosition =
        Math.ceil((anchorPosition + minimumDelta) / step) * step;
      const maximumGridPosition =
        Math.floor((anchorPosition + maximumDelta) / step) * step;
      if (minimumGridPosition > maximumGridPosition) {
        return Math.max(minimumDelta, Math.min(maximumDelta, rawDelta));
      }
      const target = Math.round((anchorPosition + rawDelta) / step) * step;
      return (
        Math.max(minimumGridPosition, Math.min(maximumGridPosition, target)) -
        anchorPosition
      );
    };

    return {
      x:
        constrainedAxis === "y"
          ? 0
          : snapAxis(
              anchor.x,
              delta.x,
              GRID_STEP_X,
              minimumX,
              maximumX,
            ),
      y:
        constrainedAxis === "x"
          ? 0
          : snapAxis(
              anchor.y,
              delta.y,
              GRID_STEP_Y,
              minimumY,
              maximumY,
            ),
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
            x:
              Math.round((origin.x + delta.x) * POSITION_PRECISION) /
              POSITION_PRECISION,
            y:
              Math.round((origin.y + delta.y) * POSITION_PRECISION) /
              POSITION_PRECISION,
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
          const snappedDelta = snapGroupDelta(
            drag.origins,
            drag.latestDelta,
            drag.constrainedAxis,
          );
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
        transparentBackground ? "bg-transparent" : "bg-black",
        framed && "rounded-xl",
      )}
      aria-label="走位舞台"
    >
      <rect
        x="0"
        y="0"
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        fill={transparentBackground ? "transparent" : "#000000"}
      />
      {editable &&
        Array.from(
          { length: GRID_COLUMNS - 1 },
          (_, index) => index + 1,
        ).map((index) => (
          <line
            key={`grid-x-${index}`}
            x1={index * GRID_STEP_X * STAGE_WIDTH}
            y1="0"
            x2={index * GRID_STEP_X * STAGE_WIDTH}
            y2={STAGE_HEIGHT}
            stroke={
              index % 4 === 0
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.055)"
            }
            strokeWidth="1"
          />
        ))}
      {editable &&
        Array.from({ length: GRID_ROWS - 1 }, (_, index) => index + 1).map(
          (index) => (
            <line
              key={`grid-y-${index}`}
              x1="0"
              y1={index * GRID_STEP_Y * STAGE_HEIGHT}
              x2={STAGE_WIDTH}
              y2={index * GRID_STEP_Y * STAGE_HEIGHT}
              stroke={
                index % 4 === 0
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.055)"
              }
              strokeWidth="1"
            />
          ),
        )}
      <line
        x1={STAGE_WIDTH / 2}
        y1="0"
        x2={STAGE_WIDTH / 2}
        y2={STAGE_HEIGHT}
        stroke="rgba(255,255,255,0.16)"
        strokeDasharray="10 10"
      />
      <line
        x1="0"
        y1={STAGE_HEIGHT / 2}
        x2={STAGE_WIDTH}
        y2={STAGE_HEIGHT / 2}
        stroke="rgba(255,255,255,0.16)"
        strokeDasharray="10 10"
      />
      <g
        transform={
          audiencePosition === "top"
            ? `translate(${STAGE_WIDTH / 2} 36)`
            : audiencePosition === "bottom"
              ? `translate(${STAGE_WIDTH / 2} ${STAGE_HEIGHT - 36})`
              : audiencePosition === "left"
                ? `translate(36 ${STAGE_HEIGHT / 2}) rotate(-90)`
                : `translate(${STAGE_WIDTH - 36} ${STAGE_HEIGHT / 2}) rotate(90)`
        }
        className="pointer-events-none"
      >
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.52)"
          fontSize="22"
          fontWeight="500"
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
