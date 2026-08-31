import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { FramePose, PoseData } from "@/features/motion-analyzer/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedVision: any = null;
const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

async function getVision() {
  if (!cachedVision) {
    cachedVision = await FilesetResolver.forVisionTasks(
      MEDIAPIPE_WASM_URL
    );
  }
  return cachedVision;
}

async function createLandmarker(): Promise<PoseLandmarker> {
  const vision = await getVision();
  const options = {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    },
    runningMode: "VIDEO" as const,
    numPoses: 1,
  };

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "GPU" },
    });
  } catch {
    console.warn("GPU delegate failed, falling back to CPU");
    return await PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "CPU" },
    });
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Analysis cancelled", "AbortError");
  }
}

function waitForVideoReady(
  video: HTMLVideoElement,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onCanPlay = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not load the video."));
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Analysis cancelled", "AbortError"));
    };

    if (video.readyState >= 2) {
      resolve();
      return;
    }
    video.addEventListener("canplay", onCanPlay, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function seekTo(
  video: HTMLVideoElement,
  time: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    let firstRaf = 0;
    let secondRaf = 0;
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      signal?.removeEventListener("abort", onAbort);
      cancelAnimationFrame(firstRaf);
      cancelAnimationFrame(secondRaf);
    };
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      firstRaf = requestAnimationFrame(() => {
        secondRaf = requestAnimationFrame(() => {
          cleanup();
          resolve();
        });
      });
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Analysis cancelled", "AbortError"));
    };
    video.addEventListener("seeked", onSeeked);
    signal?.addEventListener("abort", onAbort, { once: true });
    video.currentTime = time;
  });
}

export async function extractPoseFromVideo(
  videoUrl: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<PoseData> {
  throwIfAborted(signal);
  const poseLandmarker = await createLandmarker();
  const video = document.createElement("video");
  try {
    throwIfAborted(signal);
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    if (!videoUrl.startsWith("blob:")) {
      video.crossOrigin = "anonymous";
    }
    video.preload = "auto";
    video.load();

    await waitForVideoReady(video, signal);

    const duration = video.duration;
    const fps = 10;
    const totalFrames = Math.floor(duration * fps);
    const frames: FramePose[] = [];

    for (let i = 0; i < totalFrames; i++) {
      throwIfAborted(signal);
      const targetTime = i / fps;
      await seekTo(video, targetTime, signal);

      const timestampMs = i * 100 + 1;

      try {
        const result: PoseLandmarkerResult =
          poseLandmarker.detectForVideo(video, timestampMs);

        if (result.landmarks && result.landmarks.length > 0) {
          frames.push({
            frame: i,
            timestamp: targetTime,
            landmarks: result.landmarks[0].map((lm) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z,
              visibility: lm.visibility ?? 0,
            })),
          });
        }
      } catch (error) {
        if (signal?.aborted) throw error;
        console.warn(`Frame ${i} failed:`, error);
      }

      onProgress?.(((i + 1) / totalFrames) * 100);
    }

    if (frames.length === 0) {
      throw new Error(
        "No pose landmarks were detected. Make sure the person’s full body is clearly visible in the video."
      );
    }

    return { fps, totalFrames: frames.length, frames };
  } finally {
    poseLandmarker.close();
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}
