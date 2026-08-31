import type { DanceSection, RhythmBeat } from "./types";
import { deriveSegmentsFromBeats } from "./segments";

// 离线「音乐章节」近似识别：
// 在浏览器本地，对每个八拍取 RMS 能量 + 过零率（均为时域特征，无需 FFT，轻量快速），
// 计算相邻八拍的差异(novelty)，在显著突变处切段，并强制按整数个八拍对齐。
// 这是「粗略初稿」，准确度有限——靠用户在侧栏手动修正。

const MIN_SECTION_LEN = 2; // 每段至少 2 个八拍
const MAX_SECTIONS = 12;

function buildSections(boundaries: number[], total: number, lowEnergyFirst: boolean): DanceSection[] {
  // boundaries：段落起点的八拍序号（升序，含 0）
  const out: DanceSection[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const startSeg = boundaries[i];
    const endSeg = (i + 1 < boundaries.length ? boundaries[i + 1] : total) - 1;
    if (endSeg < startSeg) continue;
    out.push({
      id: crypto.randomUUID(),
      name: "",
      generatedName: true,
      startSeg,
      endSeg,
    });
  }
  // 命名：首段若能量明显偏低记作「前奏」，其余顺序编号
  let n = 1;
  out.forEach((s, i) => {
    if (i === 0 && lowEnergyFirst && out.length > 1) {
      s.name = "前奏";
    } else {
      s.name = `第${n}段`;
      n++;
    }
  });
  return out;
}

export function detectSectionsFromChannel(
  channel: Float32Array,
  sampleRate: number,
  bpm: number,
  offset: number,
  duration: number,
  beats?: RhythmBeat[],
): DanceSection[] {
  const segments = deriveSegmentsFromBeats(beats, bpm, offset, duration);
  const N = segments.length;
  if (N < MIN_SECTION_LEN * 2) {
    // 太短，整首作为一段
    return N > 0
      ? [{
          id: crypto.randomUUID(),
          name: "第1段",
          generatedName: true,
          startSeg: 0,
          endSeg: N - 1,
        }]
      : [];
  }

  // 每个八拍的特征：RMS、过零率
  const rms = new Float32Array(N);
  const zcr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const s = Math.max(0, Math.floor(segments[i].start * sampleRate));
    const e = Math.min(channel.length, Math.floor(segments[i].end * sampleRate));
    let sumSq = 0;
    let zc = 0;
    let prev = channel[s] || 0;
    for (let k = s; k < e; k++) {
      const x = channel[k];
      sumSq += x * x;
      if ((x >= 0 && prev < 0) || (x < 0 && prev >= 0)) zc++;
      prev = x;
    }
    const len = Math.max(1, e - s);
    rms[i] = Math.sqrt(sumSq / len);
    zcr[i] = zc / len;
  }

  // 归一化
  const norm = (arr: Float32Array) => {
    let min = Infinity;
    let max = -Infinity;
    for (const v of arr) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) out[i] = (arr[i] - min) / range;
    return out;
  };
  const nr = norm(rms);
  const nz = norm(zcr);

  // novelty：相邻八拍特征向量的欧氏距离
  const novelty = new Float32Array(N);
  for (let i = 1; i < N; i++) {
    const dr = nr[i] - nr[i - 1];
    const dz = nz[i] - nz[i - 1];
    novelty[i] = Math.sqrt(dr * dr + dz * dz);
  }

  // 自适应阈值
  let mean = 0;
  for (let i = 1; i < N; i++) mean += novelty[i];
  mean /= N - 1;
  let variance = 0;
  for (let i = 1; i < N; i++) variance += (novelty[i] - mean) ** 2;
  const std = Math.sqrt(variance / (N - 1));
  const threshold = mean + std * 0.8;

  // 峰值挑选 + 最小间隔约束
  const boundaries = [0];
  for (let i = MIN_SECTION_LEN; i < N - MIN_SECTION_LEN + 1; i++) {
    const isPeak = novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1];
    if (novelty[i] >= threshold && isPeak) {
      if (i - boundaries[boundaries.length - 1] >= MIN_SECTION_LEN) {
        boundaries.push(i);
      }
    }
  }

  // 段落过多时，保留 novelty 最强的若干个边界
  if (boundaries.length - 1 > MAX_SECTIONS) {
    const cuts = boundaries.slice(1).sort((a, b) => novelty[b] - novelty[a]).slice(0, MAX_SECTIONS - 1);
    cuts.sort((a, b) => a - b);
    boundaries.length = 0;
    boundaries.push(0, ...cuts);
  }

  const lowEnergyFirst = nr[0] < 0.45;
  return buildSections(boundaries, N, lowEnergyFirst);
}

/** 从视频 objectURL 解码音频并识别段落（本地、音频不外传）。 */
export async function detectSectionsFromUrl(
  src: string,
  bpm: number,
  offset: number,
  duration: number,
  beats?: RhythmBeat[],
): Promise<DanceSection[]> {
  const resp = await fetch(src);
  const arrayBuffer = await resp.arrayBuffer();
  const AudioCtx: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  let ctx: AudioContext;
  try {
    ctx = new AudioCtx({ sampleRate: 22050 });
  } catch {
    ctx = new AudioCtx();
  }
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channel = audioBuffer.getChannelData(0);
    return detectSectionsFromChannel(
      channel,
      audioBuffer.sampleRate,
      bpm,
      offset,
      duration,
      beats,
    );
  } finally {
    await ctx.close().catch(() => {});
  }
}
