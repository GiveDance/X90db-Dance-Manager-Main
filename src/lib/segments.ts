import type { DanceSection, RhythmBeat, Segment } from "./types";

export const BEATS_PER_SEGMENT = 8;

/**
 * 参数驱动地推导整首歌的八拍分段。
 * @param beatOffset 以「拍」为单位的相位平移，为未来手动校准预留。MVP 固定为 0。
 */
export function deriveSegments(
  bpm: number,
  offset: number,
  duration: number,
  beatOffset = 0,
): Segment[] {
  if (!bpm || bpm <= 0 || !duration || duration <= 0) return [];
  const spb = 60 / bpm;
  const segLen = spb * BEATS_PER_SEGMENT;
  // 第 1 拍（count "1"）的参考时间，可被 beatOffset 平移。
  // 八拍从这里开始往后排，不向前回填到 0:00 —— 第1拍之前的前奏/静音不计入八拍。
  const phase = offset + beatOffset * spb;
  const start0 =
    phase >= 0 ? phase : phase + Math.ceil(-phase / segLen) * segLen;

  const segments: Segment[] = [];
  let num = 1;
  for (let origin = start0; origin < duration - spb * 0.25; origin += segLen) {
    const start = origin;
    const end = Math.min(duration, origin + segLen);
    if (end - start < spb * 0.5) continue; // 丢弃过短的碎片段
    const beats: number[] = [];
    for (let b = 0; b < BEATS_PER_SEGMENT; b++) {
      beats.push(origin + b * spb);
    }
    segments.push({ num, start, end, origin, spb, beats });
    num++;
  }
  return segments;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calibrateBeatGrid(
  beats: RhythmBeat[] | undefined,
  baseBpm: number,
  baseOffset: number,
  bpm: number,
  offset: number,
): RhythmBeat[] {
  if (!beats?.length) return [];
  const scale =
    baseBpm > 0 && bpm > 0 && Number.isFinite(baseBpm / bpm)
      ? baseBpm / bpm
      : 1;
  return beats
    .map((beat) => ({
      ...beat,
      time: offset + (beat.time - baseOffset) * scale,
    }))
    .filter(
      (beat, index, all) =>
        Number.isFinite(beat.time) &&
        beat.time >= 0 &&
        (index === 0 || beat.time > all[index - 1].time),
    );
}

export function alignBeatGridToMusicStart(
  beats: RhythmBeat[] | undefined,
  musicStart: number | null,
): RhythmBeat[] {
  return beats?.slice(beatGridAnchorIndex(beats, musicStart)) ?? [];
}

export function beatGridAnchorIndex(
  beats: RhythmBeat[] | undefined,
  musicStart: number | null,
): number {
  if (!beats?.length || musicStart == null || musicStart <= 0) return 0;
  const downbeats = beats
    .map((beat, index) => ({ beat, index }))
    .filter(({ beat }) => beat.beatInBar === 1);
  const candidates =
    downbeats.length > 0
      ? downbeats
      : beats.map((beat, index) => ({ beat, index }));
  let anchor = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (
      Math.abs(candidate.beat.time - musicStart) <
      Math.abs(anchor.beat.time - musicStart)
    ) {
      anchor = candidate;
    }
  }
  return anchor.index;
}

export function resolvePerformanceStart(
  beats: RhythmBeat[] | undefined,
  bpm: number,
  offset: number,
  musicStart: number | null,
): number | null {
  const aligned = alignBeatGridToMusicStart(beats, musicStart);
  if (aligned.length) return aligned[0].time;
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(offset)) {
    return null;
  }

  const cycle = (60 / bpm) * BEATS_PER_SEGMENT;
  const reference = musicStart ?? 0;
  let start = offset + Math.round((reference - offset) / cycle) * cycle;
  while (start < 0) start += cycle;
  return start;
}

export function deriveSegmentsFromBeats(
  trackedBeats: RhythmBeat[] | undefined,
  bpm: number,
  offset: number,
  duration: number,
): Segment[] {
  if (!trackedBeats || trackedBeats.length < 2) {
    return deriveSegments(bpm, offset, duration);
  }

  const times = trackedBeats
    .map((beat) => beat.time)
    .filter(
      (time, index, all) =>
        Number.isFinite(time) &&
        time >= 0 &&
        time < duration &&
        (index === 0 || time > all[index - 1]),
    );
  if (times.length < 2) return deriveSegments(bpm, offset, duration);

  const intervals = times.slice(1).map((time, index) => time - times[index]);
  const globalSpb = median(intervals) || 60 / bpm;
  const segments: Segment[] = [];

  for (
    let startIndex = 0;
    startIndex < times.length;
    startIndex += BEATS_PER_SEGMENT
  ) {
    const origin = times[startIndex];
    const known = times.slice(startIndex, startIndex + BEATS_PER_SEGMENT);
    if (!known.length) break;
    const localIntervals = known
      .slice(1)
      .map((time, index) => time - known[index]);
    const spb = median(localIntervals) || globalSpb;
    const beats = Array.from(
      { length: BEATS_PER_SEGMENT },
      (_, index) =>
        known[index] ??
        known[known.length - 1] + spb * (index - known.length + 1),
    );
    const nextTracked = times[startIndex + BEATS_PER_SEGMENT];
    const end = Math.min(
      duration,
      nextTracked ?? beats[BEATS_PER_SEGMENT - 1] + spb,
    );
    if (end - origin < spb * 0.5) continue;
    segments.push({
      num: segments.length + 1,
      start: origin,
      end,
      origin,
      spb,
      beats,
    });
  }

  return segments;
}

export function findSegmentIndex(segments: Segment[], t: number): number {
  for (let i = 0; i < segments.length; i++) {
    if (t >= segments[i].start && t < segments[i].end) return i;
  }
  if (!segments.length) return -1;
  // 超过最后一段 → 归到最后一段；在第一个八拍之前（前奏/静音）→ -1（不高亮、不计拍）
  if (t >= segments[segments.length - 1].end) return segments.length - 1;
  return -1;
}

/** 当前时间落在某段内时，返回正在响的拍（0-7）。 */
export function activeBeatInSegment(seg: Segment, t: number): number {
  let active = 0;
  for (let index = 1; index < seg.beats.length; index++) {
    if (seg.beats[index] > t) break;
    active = index;
  }
  return Math.max(0, Math.min(BEATS_PER_SEGMENT - 1, active));
}

export function beatPhaseInSegment(
  seg: Segment,
  t: number,
): { index: number; phase: number } {
  const index = activeBeatInSegment(seg, t);
  const start = seg.beats[index] ?? seg.origin + index * seg.spb;
  const end =
    seg.beats[index + 1] ??
    (index === BEATS_PER_SEGMENT - 1 ? seg.end : start + seg.spb);
  const phase = end > start ? (t - start) / (end - start) : 0;
  return { index, phase: Math.max(0, Math.min(1, phase)) };
}

/** 段落对应的时间区间（按八拍序号取首尾八拍的 start/end），越界自动钳制。 */
export function sectionTimeRange(
  section: DanceSection,
  segments: Segment[],
): { start: number; end: number } | null {
  if (!segments.length) return null;
  const last = segments.length - 1;
  const s = Math.max(0, Math.min(section.startSeg, last));
  const e = Math.max(s, Math.min(section.endSeg, last));
  return { start: segments[s].start, end: segments[e].end };
}

/** 与时间 t 最接近的八拍「起点」序号（用于时间轴左边界吸附）。 */
export function nearestSegStart(segments: Segment[], t: number): number {
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const d = Math.abs(segments[i].start - t);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return bi;
}

/** 与时间 t 最接近的八拍「终点」序号（用于时间轴右边界吸附）。 */
export function nearestSegEnd(segments: Segment[], t: number): number {
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const d = Math.abs(segments[i].end - t);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return bi;
}

/** 当前时间落在哪个段落（返回 sections 下标，无则 -1）。 */
export function findSectionIndex(
  sections: DanceSection[],
  segments: Segment[],
  t: number,
): number {
  for (let i = 0; i < sections.length; i++) {
    const r = sectionTimeRange(sections[i], segments);
    if (r && t >= r.start && t < r.end) return i;
  }
  return -1;
}
