import type { DanceSection, Segment } from "./types";

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
  const start0 = Math.max(0, phase);

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
  const idx = Math.floor((t - seg.origin) / seg.spb);
  return Math.max(0, Math.min(BEATS_PER_SEGMENT - 1, idx));
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
