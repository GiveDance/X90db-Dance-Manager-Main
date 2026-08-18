import {
  clipAtTimelineTime,
  layoutPerformingClips,
  sourceTimeAtTimelineTime,
  type PlacedPerformingClip,
} from "./composition";
import { renderPerformanceFrame } from "./performanceFrameRenderer";
import { getPerformingClipMedia } from "./performingStore";
import {
  createSharedStageRenderer,
  type SharedStageRenderer,
} from "./sharedStageRenderer";
import {
  DEFAULT_PERFORMING_STAGE,
  type GeneratedStageTemplate,
  type PerformingProject,
} from "./types";

export type PerformingExportResolution = "720p" | "1080p";

export interface PerformingExportParams {
  project: PerformingProject;
  src: string;
  beats: number[];
  countdownBeats: number[];
  mirrored: boolean;
  visibility: PerformingExportVisibility;
  resolution: PerformingExportResolution;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

export interface PerformingExportVisibility {
  source: boolean;
  composition: boolean;
  overlay: boolean;
}

export interface PerformingExportResult {
  blob: Blob;
  ext: "mp4" | "webm";
  width: number;
  height: number;
}

export class PerformingExportUnsupportedError extends Error {
  constructor() {
    super("PERFORMING_EXPORT_UNSUPPORTED");
    this.name = "PerformingExportUnsupportedError";
  }
}

export class PerformingExportAbortedError extends Error {
  constructor() {
    super("PERFORMING_EXPORT_ABORTED");
    this.name = "PerformingExportAbortedError";
  }
}

interface LoadedClipVideo {
  video: HTMLVideoElement;
  url: string;
}

const FRAME_RATE = 30;

function pickMime(): { mime: string; ext: "mp4" | "webm" } | null {
  const candidates: { mime: string; ext: "mp4" | "webm" }[] = [
    { mime: 'video/mp4;codecs="avc1.640028,mp4a.40.2"', ext: "mp4" },
    { mime: "video/mp4;codecs=avc1.640028", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  if (typeof MediaRecorder === "undefined") return null;
  return (
    candidates.find((candidate) =>
      MediaRecorder.isTypeSupported(candidate.mime),
    ) ?? null
  );
}

export function canExportPerforming(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    pickMime() !== null
  );
}

function loadVideo(
  src: string,
  muted: boolean,
  signal?: AbortSignal,
): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;
    const timeout = window.setTimeout(
      () => finish(new Error("MEDIA_LOAD_TIMEOUT")),
      20_000,
    );
    const onAbort = () => finish(new PerformingExportAbortedError());
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      video.onloadeddata = null;
      video.onerror = null;
      if (error) reject(error);
      else resolve(video);
    };
    video.preload = "auto";
    video.playsInline = true;
    video.muted = muted;
    video.onloadeddata = () => finish();
    video.onerror = () => finish(new Error("MEDIA_LOAD_FAILED"));
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    video.src = src;
    video.load();
  });
}

function even(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function outputSize(
  sourceWidth: number,
  sourceHeight: number,
  resolution: PerformingExportResolution,
) {
  const bounds =
    resolution === "1080p"
      ? { width: 1920, height: 1080 }
      : { width: 1280, height: 720 };
  const scale = Math.min(
    1,
    bounds.width / sourceWidth,
    bounds.height / sourceHeight,
  );
  return {
    width: even(sourceWidth * scale),
    height: even(sourceHeight * scale),
  };
}

function clipAssetId(clip: PlacedPerformingClip) {
  return clip.assetId ?? clip.id;
}

async function loadClipVideos(
  project: PerformingProject,
  layout: PlacedPerformingClip[],
  signal?: AbortSignal,
) {
  const videos = new Map<string, LoadedClipVideo>();
  const assetIds = Array.from(
    new Set(
      layout
        .filter((clip) => clip.kind !== "generated")
        .map((clip) => clipAssetId(clip)),
    ),
  );
  try {
    for (const assetId of assetIds) {
      if (signal?.aborted) throw new PerformingExportAbortedError();
      const media = await getPerformingClipMedia(project.id, assetId);
      if (!media) throw new Error(`CLIP_MEDIA_MISSING:${assetId}`);
      const url = URL.createObjectURL(media);
      try {
        const video = await loadVideo(url, true, signal);
        videos.set(assetId, { video, url });
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      }
    }
    return videos;
  } catch (error) {
    for (const loaded of videos.values()) {
      stopVideo(loaded.video);
      URL.revokeObjectURL(loaded.url);
    }
    videos.clear();
    throw error;
  }
}

function stopVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

export async function exportPerformingVideo(
  params: PerformingExportParams,
): Promise<PerformingExportResult> {
  const picked = pickMime();
  if (
    !picked ||
    typeof HTMLCanvasElement.prototype.captureStream !== "function"
  ) {
    throw new PerformingExportUnsupportedError();
  }
  const {
    project,
    src,
    beats,
    countdownBeats,
    mirrored,
    visibility,
    resolution,
    onProgress,
    signal,
  } = params;
  if (signal?.aborted) throw new PerformingExportAbortedError();

  const sourceVideo = await loadVideo(src, false, signal);
  const duration = sourceVideo.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    stopVideo(sourceVideo);
    throw new Error("INVALID_EXPORT_DURATION");
  }
  const layout = visibility.composition
    ? layoutPerformingClips(project.clips ?? [])
    : [];
  let clipVideos = new Map<string, LoadedClipVideo>();
  try {
    clipVideos = await loadClipVideos(project, layout, signal);
  } catch (error) {
    stopVideo(sourceVideo);
    throw error;
  }
  const cleanupMedia = () => {
    stopVideo(sourceVideo);
    for (const loaded of clipVideos.values()) {
      loaded.video.onseeked = null;
      stopVideo(loaded.video);
      URL.revokeObjectURL(loaded.url);
    }
    clipVideos.clear();
  };

  const size = outputSize(
    sourceVideo.videoWidth || 1280,
    sourceVideo.videoHeight || 720,
    resolution,
  );
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    cleanupMedia();
    throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
  }

  let audioContext: AudioContext | null = null;
  let audioTrack: MediaStreamTrack | null = null;
  const sourceWithAudioMetadata = sourceVideo as HTMLVideoElement & {
    audioTracks?: { length: number };
    captureStream?: () => MediaStream;
    mozHasAudio?: boolean;
  };
  const audioProbeStream = sourceWithAudioMetadata.captureStream?.();
  const capturedAudioTracks = audioProbeStream?.getAudioTracks();
  for (const track of audioProbeStream?.getTracks() ?? []) track.stop();
  if (
    capturedAudioTracks?.length === 0 ||
    sourceWithAudioMetadata.audioTracks?.length === 0 ||
    sourceWithAudioMetadata.mozHasAudio === false
  ) {
    cleanupMedia();
    throw new Error("SOURCE_AUDIO_MISSING");
  }
  try {
    audioContext = new AudioContext();
    await audioContext.resume();
    const source = audioContext.createMediaElementSource(sourceVideo);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    audioTrack = destination.stream.getAudioTracks()[0] ?? null;
  } catch {
    audioTrack = null;
  }
  if (!audioTrack) {
    cleanupMedia();
    void audioContext?.close().catch(() => {});
    throw new Error("AUDIO_CAPTURE_UNAVAILABLE");
  }

  const manualFrames =
    typeof CanvasCaptureMediaStreamTrack !== "undefined" &&
    "requestFrame" in CanvasCaptureMediaStreamTrack.prototype;
  const canvasStream = canvas.captureStream(manualFrames ? 0 : FRAME_RATE);
  const canvasTrack = canvasStream.getVideoTracks()[0] as
    | CanvasCaptureMediaStreamTrack
    | undefined;
  const tracks: MediaStreamTrack[] = canvasTrack ? [canvasTrack] : [];
  tracks.push(audioTrack);
  const stream = new MediaStream(tracks);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: picked.mime,
      videoBitsPerSecond: resolution === "1080p" ? 12_000_000 : 7_000_000,
      audioBitsPerSecond: 192_000,
    });
  } catch (error) {
    for (const track of stream.getTracks()) track.stop();
    cleanupMedia();
    void audioContext?.close().catch(() => {});
    throw error;
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  let activeClipId: string | null = null;
  let activeClipVideo: HTMLVideoElement | null = null;
  let activeClipReady = false;
  let frameTimer = 0;
  let aborted = false;
  let renderError: Error | null = null;
  let activeStageTemplate: GeneratedStageTemplate | null = null;
  let stageRenderer: SharedStageRenderer | null = null;
  let clipSeekPausedTimeline = false;
  const settings = {
    ...DEFAULT_PERFORMING_STAGE,
    ...project.stage,
  };

  const resumeAfterClipSeek = () => {
    if (
      !clipSeekPausedTimeline ||
      !activeClipReady ||
      recorder.state !== "paused"
    ) {
      return;
    }
    clipSeekPausedTimeline = false;
    recorder.resume();
    void sourceVideo.play().catch(() => {
      renderError = new Error("SOURCE_PLAYBACK_FAILED");
      if (recorder.state !== "inactive") recorder.stop();
    });
  };
  const pauseForClipSeek = () => {
    if (recorder.state !== "recording") return;
    clipSeekPausedTimeline = true;
    sourceVideo.pause();
    recorder.pause();
  };
  recorder.onpause = resumeAfterClipSeek;

  const selectClipVideo = (
    clip: PlacedPerformingClip | null,
    time: number,
  ) => {
    if (!clip || clip.kind === "generated") {
      if (activeClipVideo) {
        activeClipVideo.onseeked = null;
        activeClipVideo.pause();
      }
      activeClipId = null;
      activeClipVideo = null;
      activeClipReady = false;
      return null;
    }
    const nextId = clip.id;
    const loaded = clipVideos.get(clipAssetId(clip));
    if (!loaded) throw new Error(`CLIP_VIDEO_UNAVAILABLE:${clipAssetId(clip)}`);
    const desiredTime = sourceTimeAtTimelineTime(clip, time);
    if (activeClipId !== nextId) {
      if (activeClipVideo && activeClipVideo !== loaded.video) {
        activeClipVideo.pause();
      }
      activeClipId = nextId;
      activeClipVideo = loaded.video;
      activeClipReady = false;
      activeClipVideo.playbackRate = Math.max(
        0.25,
        Math.min(4, clip.playbackRate),
      );
      activeClipVideo.onseeked = () => {
        if (activeClipVideo !== loaded.video) return;
        activeClipReady = true;
        resumeAfterClipSeek();
      };
      if (Math.abs(activeClipVideo.currentTime - desiredTime) <= 0.01) {
        activeClipReady =
          !activeClipVideo.seeking &&
          activeClipVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      } else {
        pauseForClipSeek();
        activeClipVideo.currentTime = desiredTime;
      }
      void activeClipVideo.play().catch(() => {});
    } else if (
      activeClipVideo &&
      Math.abs(activeClipVideo.currentTime - desiredTime) > 0.12
    ) {
      activeClipReady = false;
      pauseForClipSeek();
      activeClipVideo.currentTime = desiredTime;
    }
    return activeClipReady && !activeClipVideo?.seeking
      ? activeClipVideo
      : null;
  };

  const render = () => {
    try {
      const time = sourceVideo.currentTime;
      const activeClip = clipAtTimelineTime(layout, time);
      const clipVideo = selectClipVideo(activeClip, time);
      const stageTemplate =
        activeClip?.kind === "generated"
          ? activeClip.generatedTemplate ?? "street"
          : null;
      if (stageTemplate !== activeStageTemplate) {
        activeStageTemplate = stageTemplate;
        stageRenderer = stageTemplate
          ? createSharedStageRenderer(stageTemplate)
          : null;
      }
      renderPerformanceFrame(context, {
        time,
        width: size.width,
        height: size.height,
        beats,
        countdownBeats,
        settings,
        template: stageTemplate,
        templateRenderer: stageRenderer,
        sourceVideo,
        clipVideo,
        mirrored,
        visibility,
      });
      if (manualFrames) canvasTrack?.requestFrame();
      onProgress?.(Math.min(1, time / duration));
    } catch (error) {
      renderError =
        error instanceof Error ? error : new Error("EXPORT_RENDER_FAILED");
      if (recorder.state !== "inactive") recorder.stop();
    }
  };

  const cleanup = () => {
    if (frameTimer) window.clearInterval(frameTimer);
    sourceVideo.onended = null;
    sourceVideo.onerror = null;
    cleanupMedia();
    for (const track of stream.getTracks()) track.stop();
    void audioContext?.close().catch(() => {});
  };

  const onAbort = () => {
    aborted = true;
    if (recorder.state !== "inactive") recorder.stop();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  const result = new Promise<PerformingExportResult>((resolve, reject) => {
    recorder.onstop = () => {
      signal?.removeEventListener("abort", onAbort);
      cleanup();
      if (aborted) {
        reject(new PerformingExportAbortedError());
      } else if (renderError) {
        reject(renderError);
      } else if (!chunks.length) {
        reject(new Error("EMPTY_EXPORT"));
      } else {
        resolve({
          blob: new Blob(chunks, { type: picked.mime.split(";")[0] }),
          ext: picked.ext,
          ...size,
        });
      }
    };
    recorder.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      cleanup();
      reject(new Error("RECORD_FAILED"));
    };
  });

  sourceVideo.currentTime = 0;
  sourceVideo.onended = () => {
    onProgress?.(1);
    if (recorder.state !== "inactive") recorder.stop();
  };
  sourceVideo.onerror = () => {
    renderError = new Error("SOURCE_PLAYBACK_FAILED");
    if (recorder.state !== "inactive") recorder.stop();
  };

  try {
    render();
    const clipReadyDeadline = performance.now() + 10_000;
    while (activeClipVideo && !activeClipReady) {
      if (signal?.aborted) throw new PerformingExportAbortedError();
      if (performance.now() >= clipReadyDeadline) {
        throw new Error("CLIP_SEEK_TIMEOUT");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    }
    await sourceVideo.play();
  } catch (error) {
    signal?.removeEventListener("abort", onAbort);
    cleanup();
    throw error instanceof Error
      ? error
      : new Error("SOURCE_PLAYBACK_FAILED");
  }

  if (aborted || signal?.aborted) {
    signal?.removeEventListener("abort", onAbort);
    cleanup();
    throw new PerformingExportAbortedError();
  }
  try {
    recorder.start(1000);
  } catch (error) {
    signal?.removeEventListener("abort", onAbort);
    cleanup();
    throw error;
  }
  frameTimer = window.setInterval(render, 1000 / FRAME_RATE);
  return result;
}
