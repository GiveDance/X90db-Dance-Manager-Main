import { trackedBeatPreRoll } from "./countIn";
import { drawPerformerSignal } from "./performerSignal";
import type { SharedStageRenderer } from "./sharedStageRenderer";
import type {
  GeneratedStageTemplate,
  PerformingStageSettings,
} from "./types";

interface FrameBeatState {
  index: number;
  count: number;
  phase: number;
  hit: number;
  downbeatHit: number;
  secondaryHit: number;
}

export interface PerformanceFrameRenderOptions {
  time: number;
  width: number;
  height: number;
  beats: number[];
  countdownBeats: number[];
  settings: PerformingStageSettings;
  template: GeneratedStageTemplate | null;
  sourceVideo: HTMLVideoElement;
  clipVideo?: HTMLVideoElement | null;
  mirrored: boolean;
  visibility: {
    source: boolean;
    composition: boolean;
    overlay: boolean;
  };
  templateRenderer?: SharedStageRenderer | null;
}

function beatStateAtTime(
  beats: number[],
  time: number,
  secondaryAccentCount: number,
): FrameBeatState {
  if (!beats.length || time < beats[0]) {
    return {
      index: -1,
      count: 0,
      phase: 0,
      hit: 0,
      downbeatHit: 0,
      secondaryHit: 0,
    };
  }
  let low = 0;
  let high = beats.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (beats[middle] <= time) low = middle + 1;
    else high = middle;
  }
  const index = Math.max(0, low - 1);
  const start = beats[index];
  const end = beats[index + 1];
  const phase =
    end != null && end > start
      ? Math.max(0, Math.min(1, (time - start) / (end - start)))
      : 0;
  const hit = Math.max(0, 1 - phase * 4);
  const count = index % 8;
  return {
    index,
    count,
    phase,
    hit,
    downbeatHit: count === 0 ? hit : 0,
    secondaryHit:
      secondaryAccentCount > 1 && count === secondaryAccentCount - 1
        ? hit
        : 0,
  };
}

function containRect(
  mediaWidth: number,
  mediaHeight: number,
  width: number,
  height: number,
) {
  const ratio = Math.min(width / mediaWidth, height / mediaHeight);
  const drawWidth = mediaWidth * ratio;
  const drawHeight = mediaHeight * ratio;
  return {
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

function drawVideo(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  mirrored: boolean,
) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  const mediaWidth = video.videoWidth || width;
  const mediaHeight = video.videoHeight || height;
  const rect = containRect(mediaWidth, mediaHeight, width, height);
  context.save();
  if (mirrored) {
    context.translate(width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, rect.x, rect.y, rect.width, rect.height);
  context.restore();
}

function drawTemplate(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  sync: Parameters<SharedStageRenderer["draw"]>[3],
  renderer: SharedStageRenderer,
) {
  renderer.draw(context, width, height, sync, time);
}

function drawSignals(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  beats: number[],
  countdownBeats: number[],
  settings: PerformingStageSettings,
) {
  const preRoll = settings.visualLeadEnabled
    ? trackedBeatPreRoll(time, countdownBeats)
    : null;
  drawPerformerSignal(context, width, height, time, beats, {
    clear: false,
    corner: {
      enabled: settings.cornerSignalEnabled,
      shape: settings.cornerSignalShape,
      beatColor: settings.cornerSignalBeatColor,
      accentColor: settings.cornerSignalAccentColor,
      size: settings.cornerSignalSize,
      opacity: settings.cornerSignalOpacity,
    },
    beatPoints: {
      enabled: settings.showBeatCode,
      shape: settings.beatPointShape,
      theme: settings.beatPointTheme,
      beatColor: settings.beatPointBeatColor,
      accentColor: settings.beatPointAccentColor,
      size: settings.beatPointSize,
      opacity: settings.beatPointOpacity,
      spacing: settings.beatPointSpacing,
      rows: settings.beatPointRows,
      positions: settings.beatCodePositions,
    },
    secondaryAccentCount: settings.secondaryAccentCount,
    beatOverride: preRoll
      ? {
          count: preRoll.count,
          duration: preRoll.duration,
          index: preRoll.count - 1,
          elapsed: preRoll.phase * preRoll.duration,
          visualLead: true,
        }
      : undefined,
  });
}

export function renderPerformanceFrame(
  context: CanvasRenderingContext2D,
  options: PerformanceFrameRenderOptions,
) {
  const {
    time,
    width,
    height,
    beats,
    countdownBeats,
    settings,
    template,
    sourceVideo,
    clipVideo,
    mirrored,
    visibility,
    templateRenderer,
  } = options;
  const beat = beatStateAtTime(beats, time, settings.secondaryAccentCount);
  context.save();
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
  if (visibility.source) {
    drawVideo(context, sourceVideo, width, height, mirrored);
  }
  if (visibility.composition && clipVideo) {
    drawVideo(context, clipVideo, width, height, mirrored);
  }
  if (visibility.composition && template) {
    if (!templateRenderer) {
      throw new Error("STAGE_RENDERER_UNAVAILABLE");
    }
    const beatIndex = Math.max(0, beat.index);
    const sectionEnd = (Math.floor(beatIndex / 32) + 1) * 32;
    const preRoll = trackedBeatPreRoll(time, countdownBeats);
    drawTemplate(
      context,
      width,
      height,
      time,
      {
        beatHit: beat.hit,
        beatStarted: beat.index >= 0,
        beatIndex,
        beforeAudio: beat.index < 0,
        cuePressure: Math.max(
          0,
          Math.min(1, 1 - (sectionEnd - beatIndex) / 16),
        ),
        eightHit: beat.downbeatHit,
        playing: true,
        preRollHit: preRoll ? Math.max(0, 1 - preRoll.phase * 4) : 0,
        secondaryHit: beat.secondaryHit,
        sectionIndex: Math.floor(beatIndex / 32),
        progress: beat.phase,
      },
      templateRenderer,
    );
  }
  if (visibility.overlay) {
    drawSignals(
      context,
      width,
      height,
      time,
      beats,
      countdownBeats,
      settings,
    );
  }
  context.restore();
}
