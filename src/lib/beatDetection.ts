import {
  analyzeAudio as analyzeLegacyAudio,
  type AnalyzeStage,
} from "./beatDetection.legacy";
import type {
  BeatAnalysis,
  RhythmAnalysisEngine,
  RhythmBeat,
} from "./types";
import { detectMusicStart } from "./audioOnset";

export { type AnalyzeStage } from "./beatDetection.legacy";

interface DesktopRhythmResult {
  bpm: number;
  beats: number[];
  positions?: number[];
  confidence?: number;
  musicStart?: number | null;
}

interface DesktopRhythmApi {
  analyzeRhythm(
    bytes: Uint8Array,
    metadata: { name: string; type: string },
  ): Promise<DesktopRhythmResult>;
}

declare global {
  interface Window {
    desktopApi?: DesktopRhythmApi;
  }
}

const MIN_TRACKED_BEATS = 8;
const ESSENTIA_MAX_CONFIDENCE = 5.32;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeConfidence(value: number | undefined, max = 1): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, (value ?? 0) / max));
}

function trackedBeatQuality(
  bpm: number,
  times: number[],
  duration: number,
  confidence: number,
): number {
  if (
    !Number.isFinite(bpm) ||
    bpm < 40 ||
    bpm > 240 ||
    times.length < MIN_TRACKED_BEATS ||
    times.some((time, index) => !Number.isFinite(time) || time < 0 || (index > 0 && time <= times[index - 1]))
  ) {
    return 0;
  }

  const intervals = times.slice(1).map((time, index) => time - times[index]);
  const typical = median(intervals);
  if (typical <= 0) return 0;

  const intervalBpm = 60 / typical;
  const harmonicError = Math.min(
    Math.abs(intervalBpm - bpm) / bpm,
    Math.abs(intervalBpm * 2 - bpm) / bpm,
    Math.abs(intervalBpm / 2 - bpm) / bpm,
  );
  const deviations = intervals.map((interval) => Math.abs(interval - typical));
  const relativeDeviation = median(deviations) / typical;
  const coverage =
    duration > 0
      ? Math.min(1, Math.max(0, (times[times.length - 1] - times[0]) / duration))
      : 1;

  return Math.max(
    0,
    Math.min(
      1,
      0.35 +
        confidence * 0.25 +
        Math.max(0, 0.2 - harmonicError) +
        Math.max(0, 0.15 - relativeDeviation) +
        coverage * 0.05,
    ),
  );
}

function beatPoints(
  times: number[],
  positions: number[] | undefined,
  confidence: number,
): RhythmBeat[] {
  return times.map((time, index) => ({
    time,
    beatInBar: positions?.[index] ?? null,
    confidence,
  }));
}

function whenEssentiaReady(module: {
  calledRun?: boolean;
  onRuntimeInitialized?: () => void;
}): Promise<void> {
  if (module.calledRun) return Promise.resolve();
  return new Promise((resolve) => {
    const previous = module.onRuntimeInitialized;
    module.onRuntimeInitialized = () => {
      previous?.();
      resolve();
    };
    const timer = window.setInterval(() => {
      if (!module.calledRun) return;
      window.clearInterval(timer);
      resolve();
    }, 30);
  });
}

async function decodeAt44100(file: Blob): Promise<{
  buffer: AudioBuffer;
  close: () => Promise<void>;
}> {
  const AudioCtx: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  let context: AudioContext;
  try {
    context = new AudioCtx({ sampleRate: 44_100 });
  } catch {
    context = new AudioCtx();
  }

  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.sampleRate === 44_100) {
      return { buffer: decoded, close: () => context.close() };
    }

    const frameCount = Math.ceil(decoded.duration * 44_100);
    const offline = new OfflineAudioContext(1, frameCount, 44_100);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const resampled = await offline.startRendering();
    return { buffer: resampled, close: () => context.close() };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}

async function analyzeWithDesktop(file: Blob): Promise<BeatAnalysis | null> {
  const api = window.desktopApi;
  if (!api?.analyzeRhythm) return null;

  const result = await api.analyzeRhythm(
    new Uint8Array(await file.arrayBuffer()),
    {
      name: file instanceof File ? file.name : "media",
      type: file.type,
    },
  );
  const confidence = normalizeConfidence(result.confidence);
  const downbeatIndex =
    result.positions?.findIndex((position) => position === 1) ?? -1;
  const anchorIndex = downbeatIndex >= 0 ? downbeatIndex : 0;
  const trackedTimes = result.beats.slice(anchorIndex);
  const trackedPositions = result.positions?.slice(anchorIndex);
  const duration = trackedTimes.at(-1) ?? 0;
  const quality = trackedBeatQuality(
    result.bpm,
    trackedTimes,
    duration,
    confidence,
  );
  if (quality < 0.45) return null;

  return {
    bpm: result.bpm,
    offset: trackedTimes[0],
    musicStart: result.musicStart ?? null,
    beats: beatPoints(trackedTimes, trackedPositions, confidence),
    engine: "madmom",
    confidence: quality,
  };
}

async function analyzeWithEssentia(file: Blob): Promise<BeatAnalysis | null> {
  const [{ EssentiaWASM }, { default: Essentia }] = await Promise.all([
    import("essentia.js/dist/essentia-wasm.es.js"),
    import("essentia.js/dist/essentia.js-core.es.js"),
  ]);
  await whenEssentiaReady(EssentiaWASM);

  const { buffer, close } = await decodeAt44100(file);
  const musicStart = detectMusicStart(buffer);
  if (musicStart == null) {
    await close().catch(() => {});
    return null;
  }
  const essentia = new Essentia(EssentiaWASM);
  const signal = essentia.arrayToVector(buffer.getChannelData(0));
  try {
    const result = essentia.RhythmExtractor2013(
      signal,
      208,
      "multifeature",
      40,
    );
    try {
      const times = Array.from(essentia.vectorToArray(result.ticks));
      const confidence = normalizeConfidence(
        result.confidence,
        ESSENTIA_MAX_CONFIDENCE,
      );
      const quality = trackedBeatQuality(
        result.bpm,
        times,
        buffer.duration,
        confidence,
      );
      if (quality < 0.45) return null;
      return {
        bpm: Math.round(result.bpm * 10) / 10,
        offset: times[0],
        musicStart,
        beats: beatPoints(times, undefined, confidence),
        engine: "essentia",
        confidence: quality,
      };
    } finally {
      result.ticks?.delete?.();
    }
  } finally {
    signal.delete?.();
    await close().catch(() => {});
  }
}

function withLegacyMetadata(result: BeatAnalysis): BeatAnalysis {
  return {
    ...result,
    engine: "web-audio",
    confidence: 0.25,
  };
}

/**
 * Local analyzer chain: packaged desktop madmom, browser Essentia WASM, then
 * the preserved Dance Manager BPM + offset implementation.
 */
export async function analyzeAudio(
  file: Blob,
  onStage?: (stage: AnalyzeStage) => void,
): Promise<BeatAnalysis> {
  onStage?.("decode");

  try {
    const desktop = await analyzeWithDesktop(file);
    if (desktop) {
      onStage?.("segment");
      return desktop;
    }
  } catch (error) {
    console.warn("Desktop rhythm analysis failed; trying Essentia.", error);
  }

  onStage?.("detect");
  try {
    const essentia = await analyzeWithEssentia(file);
    if (essentia) {
      onStage?.("segment");
      return essentia;
    }
  } catch (error) {
    console.warn("Essentia rhythm analysis failed; using legacy analysis.", error);
  }

  return withLegacyMetadata(await analyzeLegacyAudio(file, onStage));
}

export function analysisEngineLabel(
  engine: RhythmAnalysisEngine | undefined,
): string {
  switch (engine) {
    case "madmom":
      return "madmom";
    case "essentia":
      return "Essentia";
    case "web-audio":
      return "兼容模式";
    case "manual":
      return "手动";
    default:
      return "未知";
  }
}
