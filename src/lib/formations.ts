import type { FormationChange, FormationPosition } from "./types";

export const FORMATION_COLORS = [
  "#2f6f73",
  "#d65a31",
  "#6a5acd",
  "#c28f2c",
  "#4f7cac",
  "#9f4f82",
  "#5b8c3a",
  "#ba4a4a",
  "#2f4f4f",
  "#845ec2",
  "#008f7a",
  "#b65f28",
] as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function beatTimeLabel(time: number, bpm: number, offset: number) {
  const secondsPerBeat = 60 / bpm;
  const beatIndex = Math.max(0, Math.round((time - offset) / secondsPerBeat));
  return `${Math.floor(beatIndex / 8) + 1}-${(beatIndex % 8) + 1}`;
}

export function beatLabelTime(
  value: string,
  bpm: number,
  offset: number,
): number | null {
  const match = value.trim().match(/^(\d+)-([1-8])$/);
  if (!match) return null;
  const eightCount = Number(match[1]);
  const beat = Number(match[2]);
  if (eightCount < 1) return null;
  return Math.max(0, offset + ((eightCount - 1) * 8 + beat - 1) * (60 / bpm));
}

export function snapTimeToBeat(
  time: number,
  bpm: number,
  offset: number,
  duration: number,
) {
  const secondsPerBeat = 60 / bpm;
  const beatIndex = Math.round((time - offset) / secondsPerBeat);
  return Math.max(
    0,
    Math.min(duration || Number.POSITIVE_INFINITY, offset + beatIndex * secondsPerBeat),
  );
}

export function defaultFormationPositions(count = 7): FormationPosition[] {
  return Array.from({ length: count }, (_, index) => ({
    dancer: index + 1,
    x: count === 1 ? 0.5 : 0.18 + (index / (count - 1)) * 0.64,
    y: 0.5,
  }));
}

export function resizeFormationPositions(
  positions: FormationPosition[],
  count: number,
): FormationPosition[] {
  const defaults = defaultFormationPositions(count);
  return defaults.map(
    (fallback) =>
      positions.find((position) => position.dancer === fallback.dancer) ?? fallback,
  );
}

export function moveFormationDancer(
  positions: FormationPosition[],
  dancer: number,
  x: number,
  y: number,
): FormationPosition[] {
  return positions.map((position) =>
    position.dancer === dancer
      ? {
          ...position,
          x: Math.round(clamp(x) * 1000) / 1000,
          y: Math.round(clamp(y) * 1000) / 1000,
        }
      : position,
  );
}

export function formationAtTime(
  changes: FormationChange[],
  time: number,
): FormationPosition[] {
  const sorted = [...changes].sort((a, b) => a.startTime - b.startTime);
  const active = sorted.find(
    (change) => time >= change.startTime && time <= change.endTime,
  );
  if (active) {
    const span = Math.max(0.001, active.endTime - active.startTime);
    const progress = Math.max(
      0,
      Math.min(1, (time - active.startTime) / span),
    );
    return active.startPositions.map((start) => {
      const end =
        active.endPositions.find(
          (position) => position.dancer === start.dancer,
        ) ?? start;
      return {
        dancer: start.dancer,
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      };
    });
  }

  const previous = [...sorted]
    .reverse()
    .find((change) => change.endTime < time);
  if (previous) return previous.endPositions.map((position) => ({ ...position }));
  const next = sorted.find((change) => change.startTime > time);
  if (next) return next.startPositions.map((position) => ({ ...position }));
  return defaultFormationPositions();
}
