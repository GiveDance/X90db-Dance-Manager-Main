import type { PerformingClip } from "./types";

export interface PlacedPerformingClip extends PerformingClip {
  timelineStart: number;
  timelineEnd: number;
  sourceOut: number;
}

export function layoutPerformingClips(
  clips: PerformingClip[],
): PlacedPerformingClip[] {
  let cursor = 0;
  return clips.map((clip) => {
    const timelineStart = cursor;
    const timelineDuration = Math.max(0.2, clip.timelineDuration);
    const timelineEnd = timelineStart + timelineDuration;
    const sourceOut = Math.min(
      clip.sourceDuration,
      clip.sourceIn + timelineDuration * clip.playbackRate,
    );
    cursor = timelineEnd;
    return {
      ...clip,
      timelineDuration,
      timelineStart,
      timelineEnd,
      sourceOut,
    };
  });
}

export function nearestBeatTime(beats: number[], time: number): number {
  if (!beats.length) return time;
  let nearest = beats[0];
  let distance = Math.abs(nearest - time);
  for (const beat of beats.slice(1)) {
    const candidateDistance = Math.abs(beat - time);
    if (candidateDistance < distance) {
      nearest = beat;
      distance = candidateDistance;
    }
  }
  return nearest;
}

export function clipAtTimelineTime(
  layout: PlacedPerformingClip[],
  time: number,
): PlacedPerformingClip | null {
  if (!layout.length) return null;
  return (
    layout.find(
      (clip) => time >= clip.timelineStart && time < clip.timelineEnd,
    ) ?? (time < layout[0].timelineStart ? layout[0] : layout.at(-1) ?? null)
  );
}
