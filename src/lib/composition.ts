import type { GeneratedStageTemplate, PerformingClip } from "./types";

export const GENERATED_TEMPLATE_DRAG_TYPE =
  "application/x-dance-generated-template";
export const VIDEO_CLIP_DRAG_TYPE = "application/x-dance-video-clip";

export interface PlacedPerformingClip extends PerformingClip {
  timelineStart: number;
  timelineEnd: number;
  sourceOut: number;
}

export function layoutPerformingClips(
  clips: PerformingClip[],
): PlacedPerformingClip[] {
  let cursor = 0;
  const resolved = clips.filter((clip) => clip.placed !== false).map((clip) => {
    const requestedStart =
      clip.timelineStart != null && Number.isFinite(clip.timelineStart)
        ? Math.max(0, clip.timelineStart)
        : cursor;
    const timelineDuration = Math.max(0.2, clip.timelineDuration);
    cursor = Math.max(cursor, requestedStart + timelineDuration);
    return { clip, requestedStart, timelineDuration };
  });

  cursor = 0;
  return resolved
    .sort((a, b) => a.requestedStart - b.requestedStart)
    .map(({ clip, requestedStart, timelineDuration }) => {
    const timelineStart = Math.max(cursor, requestedStart);
    const timelineEnd = timelineStart + timelineDuration;
    const sourceOut = Math.min(
      clip.sourceDuration,
      clip.kind === "generated"
        ? timelineEnd
        : clip.repeat
          ? clip.sourceDuration
        : clip.sourceIn + timelineDuration * clip.playbackRate,
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

export function snapToNearbyBeatTime(beats: number[], time: number): number {
  if (beats.length < 2) return time;
  const intervals = beats
    .slice(1)
    .map((beat, index) => beat - beats[index])
    .filter((interval) => interval > 0)
    .sort((a, b) => a - b);
  if (!intervals.length) return time;
  const typicalInterval = intervals[Math.floor(intervals.length / 2)];
  const nearest = nearestBeatTime(beats, time);
  return Math.abs(nearest - time) <= typicalInterval * 0.55 ? nearest : time;
}

export function clipAtTimelineTime(
  layout: PlacedPerformingClip[],
  time: number,
): PlacedPerformingClip | null {
  return (
    layout.find(
      (clip) => time >= clip.timelineStart && time < clip.timelineEnd,
    ) ?? null
  );
}

export function sourceTimeAtTimelineTime(
  clip: PlacedPerformingClip,
  timelineTime: number,
): number {
  const elapsed =
    (timelineTime - clip.timelineStart) * Math.max(0.25, clip.playbackRate);
  const availableSource = Math.max(
    0.05,
    clip.sourceDuration - clip.sourceIn,
  );
  if (clip.repeat) {
    return (
      clip.sourceIn +
      ((elapsed % availableSource) + availableSource) % availableSource
    );
  }
  return Math.min(
    clip.sourceOut,
    Math.max(clip.sourceIn, clip.sourceIn + elapsed),
  );
}

export interface TimelineGap {
  start: number;
  end: number;
}

export function timelineGaps(
  layout: PlacedPerformingClip[],
  duration: number,
  excludeId?: string,
): TimelineGap[] {
  const gaps: TimelineGap[] = [];
  let cursor = 0;
  for (const clip of layout) {
    if (clip.id === excludeId) continue;
    const start = Math.max(0, Math.min(duration, clip.timelineStart));
    const end = Math.max(start, Math.min(duration, clip.timelineEnd));
    if (start > cursor + 0.001) gaps.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  }
  if (cursor < duration - 0.001) gaps.push({ start: cursor, end: duration });
  return gaps;
}

export function nearestTimelineGap(
  layout: PlacedPerformingClip[],
  duration: number,
  time: number,
  minimumDuration = 0.2,
  excludeId?: string,
): TimelineGap | null {
  const gaps = timelineGaps(layout, duration, excludeId).filter(
    (gap) => gap.end - gap.start >= minimumDuration,
  );
  return (
    gaps.find((gap) => time >= gap.start && time <= gap.end) ??
    gaps.reduce<TimelineGap | null>((nearest, gap) => {
      if (!nearest) return gap;
      const distance = Math.min(
        Math.abs(time - gap.start),
        Math.abs(time - gap.end),
      );
      const nearestDistance = Math.min(
        Math.abs(time - nearest.start),
        Math.abs(time - nearest.end),
      );
      return distance < nearestDistance ? gap : nearest;
    }, null)
  );
}

export function fitClipStartToGap(
  layout: PlacedPerformingClip[],
  duration: number,
  clip: PlacedPerformingClip,
  requestedStart: number,
): number {
  const gap = nearestTimelineGap(
    layout,
    duration,
    requestedStart,
    clip.timelineDuration,
    clip.id,
  );
  if (!gap) return clip.timelineStart;
  return Math.max(
    gap.start,
    Math.min(requestedStart, gap.end - clip.timelineDuration),
  );
}

export function isGeneratedTemplate(
  value: string,
): value is GeneratedStageTemplate {
  return ["street", "pulse", "constellation", "minimal"].includes(value);
}
