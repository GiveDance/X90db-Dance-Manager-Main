import { guess } from "web-audio-beat-detector";
import type { BeatAnalysis } from "./types";

export type AnalyzeStage = "decode" | "detect" | "segment";

export class AudioDecodeError extends Error {
  constructor() {
    super("AUDIO_DECODE_FAILED");
    this.name = "AudioDecodeError";
  }
}

const MEBIBYTE = 1024 * 1024;

function analysisTimeouts(fileSize: number): {
  decode: number;
  detect: number;
} {
  const sizeSteps = Math.floor(fileSize / (20 * MEBIBYTE));
  return {
    decode: Math.min(60_000, 8_000 + sizeSteps * 4_000),
    detect: Math.min(60_000, 20_000 + sizeSteps * 3_000),
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${operation} timed out.`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function decodeAudio(blob: Blob): Promise<{ buffer: AudioBuffer; context: AudioContext }> {
  const timeouts = analysisTimeouts(blob.size);
  const arrayBuffer = await withTimeout(
    blob.arrayBuffer(),
    timeouts.decode,
    "Reading the video",
  );

  const AudioCtx: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  let context: AudioContext;
  try {
    context = new AudioCtx({ sampleRate: 22050 });
  } catch {
    context = new AudioCtx();
  }

  try {
    const buffer = await withTimeout(
      context.decodeAudioData(arrayBuffer),
      timeouts.decode,
      "Decoding the audio track",
    );
    return { buffer, context };
  } catch {
    await context.close().catch(() => {});
    throw new AudioDecodeError();
  }
}

function findMusicStart(buffer: AudioBuffer): number | null {
  const windowSize = Math.max(256, Math.round(buffer.sampleRate * 0.04));
  const windowCount = Math.ceil(buffer.length / windowSize);
  const levels = new Float32Array(windowCount);
  let peak = 0;

  for (let windowIndex = 0; windowIndex < windowCount; windowIndex++) {
    const start = windowIndex * windowSize;
    const end = Math.min(buffer.length, start + windowSize);
    let sumSquares = 0;
    let sampleCount = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let sample = start; sample < end; sample++) {
        sumSquares += samples[sample] * samples[sample];
      }
      sampleCount += end - start;
    }
    const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
    levels[windowIndex] = rms;
    peak = Math.max(peak, rms);
  }

  if (peak < 0.002) return null;
  const threshold = Math.max(0.006, peak * 0.08);
  const sustainedWindows = Math.max(3, Math.ceil(0.2 / (windowSize / buffer.sampleRate)));

  for (let index = 0; index <= levels.length - sustainedWindows; index++) {
    let audibleWindows = 0;
    let total = 0;
    for (let next = index; next < index + sustainedWindows; next++) {
      total += levels[next];
      if (levels[next] >= threshold) audibleWindows++;
    }
    if (
      audibleWindows >= sustainedWindows - 1 &&
      total / sustainedWindows >= threshold
    ) {
      return (index * windowSize) / buffer.sampleRate;
    }
  }

  return null;
}

function waitForMedia(
  media: HTMLMediaElement,
  event: "loadedmetadata" | "canplay" | "seeked",
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`Media ${event} timed out.`)),
      timeoutMs,
    );
    const cleanup = () => {
      window.clearTimeout(timer);
      media.removeEventListener(event, complete);
      media.removeEventListener("error", fail);
    };
    const complete = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(media.error ?? new Error("Media decoding failed."));
    };
    media.addEventListener(event, complete, { once: true });
    media.addEventListener("error", fail, { once: true });
  });
}

async function detectMusicStartFromMedia(
  blob: Blob,
): Promise<number | null> {
  const url = URL.createObjectURL(blob);
  const media = document.createElement("audio");
  media.src = url;
  media.preload = "auto";
  media.muted = true;
  media.defaultMuted = true;

  let context: AudioContext | null = null;
  try {
    await waitForMedia(media, "loadedmetadata", analysisTimeouts(blob.size).decode);
    if (media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      await waitForMedia(media, "canplay", analysisTimeouts(blob.size).decode);
    }
    if (!Number.isFinite(media.duration) || media.duration <= 0) return null;

    context = new AudioContext();
    const source = context.createMediaElementSource(media);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    analyser.connect(context.destination);
    try {
      await context.resume();
    } catch (error) {
      throw new Error("Starting the media analysis context failed.", {
        cause: error,
      });
    }

    const samples = new Uint8Array(analyser.fftSize);
    const scanRange = async (
      start: number,
      end: number,
      rate: number,
    ): Promise<number | null> => {
      media.pause();
      if (Math.abs(media.currentTime - start) > 0.01) {
        const seeked = waitForMedia(media, "seeked", 5_000);
        media.currentTime = start;
        try {
          await seeked;
        } catch (error) {
          throw new Error("Seeking the media analysis source failed.", {
            cause: error,
          });
        }
      }
      media.playbackRate = rate;
      if (media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        await waitForMedia(media, "canplay", 5_000);
      }
      try {
        await media.play();
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== "AbortError") {
          throw new Error("Playing the media analysis source failed.", {
            cause: error,
          });
        }
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        try {
          await media.play();
        } catch (retryError) {
          throw new Error("Playing the media analysis source failed.", {
            cause: retryError,
          });
        }
      }

      let candidate: number | null = null;
      let quietFrames = 0;
      while (!media.ended && media.currentTime < end) {
        await new Promise((resolve) => window.setTimeout(resolve, 25));
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        if (rms >= 0.008) {
          candidate ??= media.currentTime;
          quietFrames = 0;
        } else if (candidate != null && ++quietFrames > 1) {
          candidate = null;
          quietFrames = 0;
        }
        if (candidate != null && media.currentTime - candidate >= 0.2) {
          media.pause();
          return candidate;
        }
      }
      media.pause();
      return null;
    };

    const scanEnd = media.duration;
    for (let probe = 0; probe < scanEnd; probe += 1) {
      const detected = await scanRange(
        probe,
        Math.min(scanEnd, probe + 0.5),
        1,
      );
      if (detected == null) continue;
      const refined = await scanRange(
        Math.max(0, probe - 1),
        Math.min(scanEnd, probe + 0.75),
        1,
      );
      return refined ?? detected;
    }
    return null;
  } finally {
    media.pause();
    media.removeAttribute("src");
    media.load();
    await context?.close().catch(() => {});
    URL.revokeObjectURL(url);
  }
}

async function captureAudioFromMedia(
  blob: Blob,
  start: number,
  maxDuration = 16,
): Promise<AudioBuffer> {
  const url = URL.createObjectURL(blob);
  const media = document.createElement("audio");
  media.src = url;
  media.preload = "auto";
  media.muted = true;
  media.defaultMuted = true;

  let context: AudioContext | null = null;
  try {
    await waitForMedia(media, "loadedmetadata", analysisTimeouts(blob.size).decode);
    if (media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      await waitForMedia(media, "canplay", analysisTimeouts(blob.size).decode);
    }

    context = new AudioContext();
    const source = context.createMediaElementSource(media);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    analyser.connect(context.destination);
    const samples = new Float32Array(analyser.fftSize);
    const chunks: Float32Array[] = [];

    if (start > 0.01) {
      const seeked = waitForMedia(media, "seeked", 5_000);
      media.currentTime = start;
      await seeked;
    }
    if (media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      await waitForMedia(media, "canplay", 5_000);
    }

    await context.resume();
    const captureStart = media.currentTime;
    await media.play();
    const end = Math.min(media.duration, start + maxDuration);
    await withTimeout(
      new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          chunks.push(new Float32Array(samples));
          if (media.ended || media.currentTime >= end) {
            window.clearInterval(timer);
            resolve();
          }
        }, 46);
      }),
      (end - start + 5) * 1000,
      "Capturing audio for tempo detection",
    );
    media.pause();
    const capturedDuration = Math.max(0.001, media.currentTime - captureStart);

    if (!chunks.length) throw new AudioDecodeError();
    const totalLength = chunks.reduce(
      (length, chunk) => length + chunk.length,
      0,
    );
    const buffer = context.createBuffer(
      1,
      totalLength,
      Math.max(
        8_000,
        Math.min(96_000, Math.round(totalLength / capturedDuration)),
      ),
    );
    const output = buffer.getChannelData(0);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return buffer;
  } finally {
    media.pause();
    media.removeAttribute("src");
    media.load();
    await context?.close().catch(() => {});
    URL.revokeObjectURL(url);
  }
}

export async function analyzeMusicStart(
  blob: Blob,
): Promise<number | null> {
  try {
    const { buffer, context } = await decodeAudio(blob);
    try {
      return findMusicStart(buffer);
    } finally {
      await context.close().catch(() => {});
    }
  } catch (error) {
    if (!(error instanceof AudioDecodeError)) throw error;
    return detectMusicStartFromMedia(blob);
  }
}

async function detectTempoFromMedia(
  blob: Blob,
  musicStart: number,
  timeoutMs: number,
): Promise<{ bpm: number; offset: number }> {
  const capturedAudio = await captureAudioFromMedia(blob, musicStart);
  try {
    const result = await withTimeout(
      guess(capturedAudio),
      timeoutMs,
      "Detecting the beat",
    );
    return {
      bpm: result.bpm,
      offset: musicStart + result.offset,
    };
  } catch {
    return estimateTempoFromEnvelope(capturedAudio, musicStart);
  }
}

function estimateTempoFromEnvelope(
  buffer: AudioBuffer,
  start: number,
): { bpm: number; offset: number } {
  const frameSize = 2048;
  const samples = buffer.getChannelData(0);
  const frameCount = Math.floor(samples.length / frameSize);
  if (frameCount < 24) throw new AudioDecodeError();

  const levels = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    let sumSquares = 0;
    const frameStart = frame * frameSize;
    for (let index = frameStart; index < frameStart + frameSize; index++) {
      sumSquares += samples[index] * samples[index];
    }
    levels[frame] = Math.sqrt(sumSquares / frameSize);
  }

  const onsets = new Float32Array(frameCount);
  let onsetEnergy = 0;
  for (let frame = 4; frame < frameCount; frame++) {
    const baseline =
      (levels[frame - 1] +
        levels[frame - 2] +
        levels[frame - 3] +
        levels[frame - 4]) /
      4;
    const onset = Math.max(0, levels[frame] - baseline);
    onsets[frame] = onset;
    onsetEnergy += onset * onset;
  }
  if (onsetEnergy < 1e-7) throw new AudioDecodeError();

  const envelopeRate = buffer.sampleRate / frameSize;
  const minLag = Math.max(2, Math.floor((envelopeRate * 60) / 200));
  const maxLag = Math.min(
    frameCount - 2,
    Math.ceil((envelopeRate * 60) / 60),
  );
  const scores = new Float32Array(maxLag + 1);
  let bestLag = minLag;
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let frame = lag; frame < frameCount; frame++) {
      const left = onsets[frame];
      const right = onsets[frame - lag];
      correlation += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }
    const score =
      correlation / Math.sqrt(Math.max(1e-12, leftEnergy * rightEnergy));
    scores[lag] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const left = scores[bestLag - 1];
    const center = scores[bestLag];
    const right = scores[bestLag + 1];
    const denominator = left - 2 * center + right;
    if (Math.abs(denominator) > 1e-6) {
      refinedLag += 0.5 * (left - right) / denominator;
    }
  }

  let bpm = (60 * envelopeRate) / refinedLag;
  while (bpm > 170) bpm /= 2;
  while (bpm < 70) bpm *= 2;
  bpm = Math.round(bpm * 10) / 10;

  const periodFrames = Math.max(1, Math.round((envelopeRate * 60) / bpm));
  const phaseScores = new Float32Array(periodFrames);
  for (let frame = 0; frame < frameCount; frame++) {
    phaseScores[frame % periodFrames] += onsets[frame];
  }
  let bestPhase = 0;
  for (let phase = 1; phase < periodFrames; phase++) {
    if (phaseScores[phase] > phaseScores[bestPhase]) bestPhase = phase;
  }

  return {
    bpm,
    offset: start + bestPhase / envelopeRate,
  };
}

/**
 * Detects beats locally without uploading the source media.
 * Decoding at 22050 Hz limits memory use for longer videos.
 */
export async function analyzeAudio(
  file: Blob,
  onStage?: (stage: AnalyzeStage) => void,
): Promise<BeatAnalysis> {
  const timeouts = analysisTimeouts(file.size);
  onStage?.("decode");
  let decoded: { buffer: AudioBuffer; context: AudioContext } | null = null;
  try {
    decoded = await decodeAudio(file);
  } catch (error) {
    if (!(error instanceof AudioDecodeError)) throw error;
  }

  onStage?.("detect");
  let bpm = 120;
  let offset = 0;
  let musicStart: number | null;
  if (decoded) {
    musicStart = findMusicStart(decoded.buffer);
    try {
      const res = await withTimeout(
        guess(decoded.buffer),
        timeouts.detect,
        "Detecting the beat",
      );
      bpm = res.bpm;
      offset = res.offset;
    } catch {
      if (musicStart != null) {
        try {
          const tempo = await detectTempoFromMedia(
            file,
            musicStart,
            timeouts.detect,
          );
          bpm = tempo.bpm;
          offset = tempo.offset;
        } catch {
          bpm = 120;
          offset = musicStart;
        }
      }
    } finally {
      await decoded.context.close().catch(() => {});
    }
  } else {
    musicStart = await detectMusicStartFromMedia(file);
    if (musicStart != null) {
      try {
        const tempo = await detectTempoFromMedia(
          file,
          musicStart,
          timeouts.detect,
        );
        bpm = tempo.bpm;
        offset = tempo.offset;
      } catch {
        bpm = 120;
        offset = musicStart;
      }
    }
  }

  onStage?.("segment");

  return { bpm, offset, musicStart: musicStart ?? 0 };
}
