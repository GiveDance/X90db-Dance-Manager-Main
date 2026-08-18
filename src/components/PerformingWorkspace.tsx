"use client";

import {
  ArrowLeft,
  Clapperboard,
  Download,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePlayer } from "@/hooks/usePlayer";
import {
  adjacentBeatTime,
  beatGridAnchorIndex,
  deriveSegments,
} from "@/lib/segments";
import {
  clipAtTimelineTime,
  fitClipStartToGap,
  layoutPerformingClips,
  nearestTimelineGap,
  snapToNearbyBeatTime,
  sourceTimeAtTimelineTime,
  VIDEO_CLIP_DRAG_TYPE,
} from "@/lib/composition";
import { formatTime } from "@/lib/format";
import {
  getPerformingClipMedia,
  savePerformingClipMedia,
} from "@/lib/performingStore";
import type {
  GeneratedStageTemplate,
  PerformingClip,
  PerformingProject,
} from "@/lib/types";
import { DEFAULT_PERFORMING_STAGE } from "@/lib/types";
import { ClipInspector } from "./ClipInspector";
import {
  CompositionTimeline,
  type TimelineTrack,
} from "./CompositionTimeline";
import { FormationControls } from "./Controls";
import { DevToolsButton } from "./DevToolsButton";
import { OverlayInspector } from "./OverlayInspector";
import { PerformingExportDialog } from "./PerformingExportDialog";
import { PerformerSignalRenderer } from "./PerformerSignalRenderer";
import { PerformanceStageRenderer } from "./PerformanceStageRenderer";
import { StageInspector } from "./StageInspector";

type LibraryTab = "clips" | "generated";

const OVERLAY_MATERIAL_ID = "performing-overlay";
const GENERATED_TEMPLATE_NAMES: Record<GeneratedStageTemplate, string> = {
  street: "Prismatic Spectrum",
  pulse: "Neon Kaleidoscope",
  constellation: "Particle Burst",
  minimal: "Minimal Stage",
};

interface PerformingWorkspaceProps {
  project: PerformingProject;
  src: string;
  onBack: () => void;
  onProjectChange: (project: PerformingProject) => void;
}

function mediaMetadata(
  file: File,
): Promise<{ duration: number; thumbnail: string | null }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let settled = false;
    let duration = 0;
    const timer = window.setTimeout(() => finish(), 10_000);
    const captureThumbnail = (): string | null => {
      if (!video.videoWidth || !video.videoHeight) return null;
      const width = 320;
      const height = Math.max(
        1,
        Math.round((width * video.videoHeight) / video.videoWidth),
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      try {
        context.drawImage(video, 0, 0, width, height);
        return canvas.toDataURL("image/jpeg", 0.76);
      } catch {
        return null;
      }
    };
    const finish = (thumbnail: string | null = null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error(`Unable to read ${file.name}.`));
      } else {
        resolve({ duration, thumbnail });
      }
    };
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      duration = video.duration;
      const thumbnailTime = Math.min(Math.max(duration * 0.08, 0.05), 1);
      if (thumbnailTime >= duration) {
        finish(captureThumbnail());
        return;
      }
      video.currentTime = thumbnailTime;
    };
    video.onseeked = () => finish(captureThumbnail());
    video.onerror = () => finish();
    video.src = url;
  });
}

export function PerformingWorkspace({
  project,
  src,
  onBack,
  onProjectChange,
}: PerformingWorkspaceProps) {
  const { videoRef, videoProps, state, actions } = usePlayer();
  const clipVideoRef = useRef<HTMLVideoElement>(null);
  const clipInputRef = useRef<HTMLInputElement>(null);
  const clipUrlsRef = useRef(new Map<string, string>());
  const initialClipsRef = useRef(project.clips ?? []);
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("generated");
  const [clips, setClips] = useState<PerformingClip[]>(project.clips ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(
    project.clips?.[0]?.id ?? null,
  );
  const [clipUrls, setClipUrls] = useState<Map<string, string>>(new Map());
  const [addingClips, setAddingClips] = useState(false);
  const [clipDropActive, setClipDropActive] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [mediaAspectRatio, setMediaAspectRatio] = useState(16 / 9);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [trackVisibility, setTrackVisibility] = useState<
    Record<TimelineTrack, boolean>
  >({
    overlay: true,
    composition: true,
    source: true,
  });
  const stageSettings = useMemo(
    () => ({
      ...DEFAULT_PERFORMING_STAGE,
      ...project.stage,
    }),
    [project.stage],
  );
  const parsedBeats = useMemo(
    () =>
      (project.beats ?? [])
        .filter(
          (beat) =>
            Number.isFinite(beat.time) &&
            beat.time >= 0 &&
            beat.time <= state.duration,
        )
        .sort((first, second) => first.time - second.time)
        .filter(
          (beat, index, all) =>
            index === 0 || beat.time - all[index - 1].time > 0.001,
        ),
    [project.beats, state.duration],
  );
  const beatAnchorIndex = useMemo(
    () =>
      beatGridAnchorIndex(
        parsedBeats,
        project.performanceStart ?? project.musicStart ?? null,
      ),
    [parsedBeats, project.musicStart, project.performanceStart],
  );
  const fallbackBeats = useMemo(
    () =>
      deriveSegments(
        project.bpm ?? 120,
        project.offset ?? 0,
        state.duration,
      ).flatMap((segment) => segment.beats),
    [project.bpm, project.offset, state.duration],
  );
  const beats = useMemo(
    () =>
      parsedBeats.length
        ? parsedBeats.slice(beatAnchorIndex).map((beat) => beat.time)
        : fallbackBeats,
    [beatAnchorIndex, fallbackBeats, parsedBeats],
  );
  const countdownBeats = useMemo(
    () => {
      if (beatAnchorIndex >= 4) {
        return parsedBeats
          .slice(beatAnchorIndex - 4, beatAnchorIndex + 1)
          .map((beat) => beat.time);
      }
      if (!parsedBeats.length && fallbackBeats.length) {
        const secondsPerBeat = 60 / (project.bpm ?? 120);
        return Array.from(
          { length: 5 },
          (_, index) => fallbackBeats[0] - secondsPerBeat * (4 - index),
        ).filter((time) => time >= 0);
      }
      return [];
    },
    [beatAnchorIndex, fallbackBeats, parsedBeats, project.bpm],
  );
  const performanceStart = beats[0] ?? null;
  const currentBeatLabel = useMemo(() => {
    let beatIndex = -1;
    for (let index = 0; index < beats.length; index++) {
      if (beats[index] > state.currentTime + 0.001) break;
      beatIndex = index;
    }
    return beatIndex < 0
      ? "–"
      : `${Math.floor(beatIndex / 8) + 1}-${(beatIndex % 8) + 1}`;
  }, [beats, state.currentTime]);
  const layout = useMemo(() => layoutPerformingClips(clips), [clips]);
  const videoClips = useMemo(
    () =>
      clips.filter(
        (clip) => clip.kind !== "generated" && clip.assetId == null,
      ),
    [clips],
  );
  const selectedClip = layout.find((clip) => clip.id === selectedId) ?? null;
  const activeClip = clipAtTimelineTime(layout, state.currentTime);
  const activeGeneratedClip =
    activeClip?.kind === "generated" ? activeClip : null;
  const activeVideoClip =
    activeClip && activeClip.kind !== "generated" ? activeClip : null;
  const displayedGeneratedClip = trackVisibility.composition
    ? activeGeneratedClip
    : null;
  const displayedVideoClip = trackVisibility.composition
    ? activeVideoClip
    : null;
  const activeClipUrl = activeVideoClip
    ? clipUrls.get(activeVideoClip.assetId ?? activeVideoClip.id)
    : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const loaded = new Map<string, string>();
      for (const clip of initialClipsRef.current) {
        if (clip.kind === "generated" || clip.assetId) continue;
        const blob = await getPerformingClipMedia(project.id, clip.id).catch(
          () => null,
        );
        if (!blob || cancelled) continue;
        const url = URL.createObjectURL(blob);
        loaded.set(clip.id, url);
        clipUrlsRef.current.set(clip.id, url);
      }
      if (!cancelled) setClipUrls(new Map(clipUrlsRef.current));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(
    () => () => {
      for (const url of clipUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      clipUrlsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    const video = clipVideoRef.current;
    if (!video || !activeVideoClip) return;
    const desiredTime = sourceTimeAtTimelineTime(
      activeVideoClip,
      state.currentTime,
    );
    video.playbackRate = Math.max(
      0.25,
      Math.min(4, activeVideoClip.playbackRate),
    );
    if (!state.isPlaying || Math.abs(video.currentTime - desiredTime) > 0.18) {
      video.currentTime = desiredTime;
    }
    if (state.isPlaying && video.paused) {
      void video.play().catch(() => {});
    } else if (!state.isPlaying && !video.paused) {
      video.pause();
    }
  }, [activeVideoClip, state.currentTime, state.isPlaying]);

  const commitClips = useCallback(
    (nextClips: PerformingClip[]) => {
      const placedById = new Map(
        layoutPerformingClips(nextClips).map(
        ({ timelineEnd: _timelineEnd, sourceOut: _sourceOut, ...clip }) => clip,
        ).map((clip) => [clip.id, clip]),
      );
      const normalized = nextClips.map(
        (clip) => placedById.get(clip.id) ?? clip,
      );
      setClips(normalized);
      onProjectChange({
        ...project,
        clips: normalized,
        updatedAt: Date.now(),
      });
    },
    [onProjectChange, project],
  );

  const updateStage = useCallback(
    (patch: Partial<typeof stageSettings>) => {
      onProjectChange({
        ...project,
        stage: {
          ...stageSettings,
          ...patch,
        },
        updatedAt: Date.now(),
      });
    },
    [onProjectChange, project, stageSettings],
  );

  const addClipFiles = async (files: FileList | null) => {
    if (!files?.length || addingClips) return;
    setAddingClips(true);
    setClipError(null);
    try {
      const additions: PerformingClip[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("video/")) continue;
        const { duration: sourceDuration, thumbnail } =
          await mediaMetadata(file);
        const clip: PerformingClip = {
          id: crypto.randomUUID(),
          name: file.name,
          kind: "video",
          placed: false,
          thumbnail,
          sourceDuration,
          sourceIn: 0,
          timelineDuration: sourceDuration,
          playbackRate: 1,
        };
        await savePerformingClipMedia(project.id, clip.id, file);
        const url = URL.createObjectURL(file);
        clipUrlsRef.current.set(clip.id, url);
        additions.push(clip);
      }
      if (!additions.length) {
        setClipError("请选择浏览器可播放的视频文件。");
        return;
      }
      setClipUrls(new Map(clipUrlsRef.current));
      const nextClips = [...clips, ...additions];
      commitClips(nextClips);
    } catch (error) {
      console.error("Failed to add Performing clips.", error);
      setClipError("部分视频素材无法添加。");
    } finally {
      setAddingClips(false);
      if (clipInputRef.current) clipInputRef.current.value = "";
    }
  };

  const updateClip = (
    id: string,
    patch: Partial<
      Pick<
        PerformingClip,
        | "sourceIn"
        | "timelineStart"
        | "timelineDuration"
        | "playbackRate"
        | "repeat"
      >
    >,
  ) => {
    commitClips(
      clips.map((clip) => {
        if (clip.id !== id) return clip;
        const currentPlaced = layout.find((item) => item.id === id);
        const nextStart =
          layout.find(
            (item) =>
              item.id !== id &&
              currentPlaced &&
              item.timelineStart >= currentPlaced.timelineEnd,
          )?.timelineStart ?? state.duration;
        const playbackRate = Math.max(
          0.25,
          Math.min(4, patch.playbackRate ?? clip.playbackRate),
        );
        const sourceIn = Math.max(
          0,
          Math.min(
            clip.kind === "generated"
              ? patch.timelineStart ?? clip.timelineStart ?? clip.sourceIn
              : patch.sourceIn ?? clip.sourceIn,
            Math.max(0, clip.sourceDuration - 0.1),
          ),
        );
        const repeat = patch.repeat ?? clip.repeat ?? false;
        const rateAdjustedDuration =
          patch.playbackRate != null
            ? (clip.timelineDuration * clip.playbackRate) / playbackRate
            : clip.timelineDuration;
        const sourceLimitedDuration =
          clip.kind === "generated" || repeat
            ? rateAdjustedDuration
            : Math.min(
                rateAdjustedDuration,
                (clip.sourceDuration - sourceIn) / playbackRate,
              );
        const availableTimelineDuration = Math.max(
          0.2,
          nextStart - (patch.timelineStart ?? clip.timelineStart ?? 0),
        );
        return {
          ...clip,
          ...patch,
          timelineStart: Math.max(
            0,
            patch.timelineStart ?? clip.timelineStart ?? 0,
          ),
          sourceIn,
          timelineDuration: Math.max(
            0.2,
            Math.min(
              patch.timelineDuration ?? sourceLimitedDuration,
              availableTimelineDuration,
              clip.kind === "generated" || repeat
                ? Number.POSITIVE_INFINITY
                : (clip.sourceDuration - sourceIn) / playbackRate,
            ),
          ),
          playbackRate,
          repeat,
        };
      }),
    );
  };

  const removeClip = (id: string) => {
    const removed = clips.find((clip) => clip.id === id);
    if (!removed || removed.placed === false) return;
    const nextClips =
      removed.kind !== "generated" && !removed.assetId
        ? clips.map((clip) =>
            clip.id === id
              ? {
                  ...clip,
                  placed: false,
                  timelineStart: undefined,
                  sourceIn: 0,
                  timelineDuration: clip.sourceDuration,
                  playbackRate: 1,
                  repeat: false,
                }
              : clip,
          )
        : clips.filter((clip) => clip.id !== id);
    commitClips(nextClips);
    setSelectedId(null);
  };

  const changeClipRange = (id: string, start: number, duration: number) => {
    const placed = layout.find((clip) => clip.id === id);
    if (!placed) return;
    const sourceIn =
      placed.kind === "generated"
        ? start
        : placed.sourceIn +
          (start - placed.timelineStart) * placed.playbackRate;
    updateClip(id, {
      timelineStart: start,
      timelineDuration: duration,
      sourceIn,
    });
  };

  const moveClip = (id: string, requestedStart: number) => {
    const placed = layout.find((clip) => clip.id === id);
    if (!placed) return;
    const timelineStart = fitClipStartToGap(
      layout,
      state.duration,
      placed,
      requestedStart,
    );
    updateClip(id, {
      timelineStart,
      sourceIn:
        placed.kind === "generated" ? timelineStart : placed.sourceIn,
    });
  };

  const addGeneratedClip = (
    template: GeneratedStageTemplate,
    dropTime: number,
  ) => {
    const gap = nearestTimelineGap(layout, state.duration, dropTime);
    if (!gap) {
      setClipError("合成时间线中没有可用的空白区域。");
      return;
    }
    const clip: PerformingClip = {
      id: crypto.randomUUID(),
      name: GENERATED_TEMPLATE_NAMES[template],
      kind: "generated",
      generatedTemplate: template,
      placed: true,
      sourceDuration: state.duration,
      sourceIn: gap.start,
      timelineStart: gap.start,
      timelineDuration: gap.end - gap.start,
      playbackRate: 1,
    };
    setClipError(null);
    commitClips([...clips, clip]);
    setSelectedId(clip.id);
  };

  const placeVideoClip = (id: string, dropTime: number) => {
    const asset = clips.find(
      (item) => item.id === id && item.kind !== "generated" && !item.assetId,
    );
    if (!asset) return;
    const gap = nearestTimelineGap(layout, state.duration, dropTime);
    if (!gap) {
      setClipError("合成时间线中没有可用的空白区域。");
      return;
    }
    const snappedDrop =
      performanceStart != null && dropTime < performanceStart
        ? dropTime
        : snapToNearbyBeatTime(beats, dropTime);
    let timelineStart = Math.max(
      gap.start,
      Math.min(snappedDrop, gap.end - 0.2),
    );
    if (gap.end - timelineStart < 0.2) timelineStart = gap.start;
    const timelineDuration = Math.min(
      asset.sourceDuration,
      gap.end - timelineStart,
    );
    const instance: PerformingClip = {
      ...asset,
      id: crypto.randomUUID(),
      assetId: asset.id,
      placed: true,
      thumbnail: undefined,
      timelineStart,
      timelineDuration,
      sourceIn: 0,
      playbackRate: 1,
      repeat: false,
    };
    setClipError(null);
    commitClips([...clips, instance]);
    setSelectedId(instance.id);
  };

  const jumpBeat = useCallback(
    (direction: -1 | 1) => {
      actions.seek(
        adjacentBeatTime(
          beats,
          videoRef.current?.currentTime ?? state.currentTime,
          direction,
          state.duration,
        ),
      );
    },
    [actions, beats, state.currentTime, state.duration, videoRef],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        actions.togglePlay();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        jumpBeat(-1);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        jumpBeat(1);
      } else if (
        (event.code === "Delete" || event.code === "Backspace") &&
        selectedId &&
        selectedId !== OVERLAY_MATERIAL_ID
      ) {
        event.preventDefault();
        removeClip(selectedId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, jumpBeat, selectedId]);

  useEffect(() => {
    const area = stageAreaRef.current;
    if (!area) return;
    const updateCanvasSize = () => {
      const { width, height } = area.getBoundingClientRect();
      if (!width || !height) return;
      const areaAspectRatio = width / height;
      const next =
        areaAspectRatio > mediaAspectRatio
          ? { width: height * mediaAspectRatio, height }
          : { width, height: width / mediaAspectRatio };
      setCanvasSize({
        width: Math.floor(next.width),
        height: Math.floor(next.height),
      });
    };
    const observer = new ResizeObserver(updateCanvasSize);
    observer.observe(area);
    updateCanvasSize();
    return () => observer.disconnect();
  }, [mediaAspectRatio]);

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/5 bg-neutral-950 px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回
        </button>
        <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">
          {project.name}
        </span>
        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-300">
          Performing
        </span>
        <button
          type="button"
          onClick={() => {
            actions.pause();
            setExportOpen(true);
          }}
          title="导出视频"
          className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Download className="h-3.5 w-3.5" />
          导出
        </button>
        <DevToolsButton />
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          ref={stageAreaRef}
          className="relative flex min-h-0 flex-1 cursor-pointer items-center justify-center overflow-hidden bg-black"
          onClick={actions.togglePlay}
        >
          <div
            className="relative shrink-0 overflow-hidden bg-black"
            style={{
              width: canvasSize.width || undefined,
              height: canvasSize.height || undefined,
            }}
          >
          <video
            {...videoProps}
            ref={videoRef}
            src={src}
            onLoadedMetadata={(event) => {
              videoProps.onLoadedMetadata(event);
              const { videoWidth, videoHeight } = event.currentTarget;
              if (videoWidth > 0 && videoHeight > 0) {
                setMediaAspectRatio(videoWidth / videoHeight);
              }
            }}
            className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${
              trackVisibility.source ? "opacity-100" : "opacity-0"
            } ${state.mirrored ? "-scale-x-100" : ""}`}
          />
          {displayedVideoClip &&
            activeClipUrl && (
            <video
              key={displayedVideoClip.id}
              ref={clipVideoRef}
              src={activeClipUrl}
              muted
              playsInline
              onLoadedMetadata={(event) => {
                event.currentTarget.currentTime = displayedVideoClip.sourceIn;
              }}
              className={`pointer-events-none relative z-[1] h-full w-full object-contain ${
                state.mirrored ? "-scale-x-100" : ""
              }`}
            />
          )}
          {displayedVideoClip && !activeClipUrl && (
            <div className="relative z-[1] text-sm text-neutral-600">
              正在加载素材预览…
            </div>
          )}
          {trackVisibility.overlay && (
            <PerformerSignalRenderer
              time={state.currentTime}
              beats={beats}
              countdownBeats={countdownBeats}
              settings={stageSettings}
            />
          )}
          {displayedGeneratedClip ? (
            <PerformanceStageRenderer
              time={state.currentTime}
              beats={beats}
              countdownBeats={countdownBeats}
              template={displayedGeneratedClip.generatedTemplate ?? "street"}
              playing={state.isPlaying}
              showBeatCode={false}
              showSectionRail={false}
              beatCodePositions={stageSettings.beatCodePositions}
              railPositions={[]}
              visualLeadMs={0}
              secondaryAccentCount={stageSettings.secondaryAccentCount}
            />
          ) : (
            <PerformanceStageRenderer
              time={state.currentTime}
              beats={beats}
              countdownBeats={countdownBeats}
              template="minimal"
              playing={state.isPlaying}
              showBeatCode={false}
              showSectionRail={false}
              beatCodePositions={stageSettings.beatCodePositions}
              railPositions={[]}
              visualLeadMs={0}
              secondaryAccentCount={stageSettings.secondaryAccentCount}
              signalOnly
            />
          )}
          </div>
        </div>

        <div className="shrink-0 bg-neutral-950 px-3 pb-0">
          <div className="flex items-center justify-between py-4 pl-2 pr-3">
            <span className="text-xs font-medium text-neutral-300">
              合成时间线
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-neutral-600">当前拍</span>
              <span className="text-xs font-medium tabular-nums text-neutral-300">
                {currentBeatLabel}
              </span>
            </span>
          </div>
          <CompositionTimeline
            layout={layout}
            beats={beats}
            duration={state.duration}
            snapStartTime={performanceStart ?? 0}
            sourceName={project.sourceName ?? project.name}
            sourceThumbnail={project.cover}
            trackVisibility={trackVisibility}
            onTrackVisibilityChange={(track, visible) =>
              setTrackVisibility((current) => ({
                ...current,
                [track]: visible,
              }))
            }
            currentTime={state.currentTime}
            selectedId={selectedId}
            overlaySelected={selectedId === OVERLAY_MATERIAL_ID}
            onSelect={(id) => {
              setSelectedId(id);
              if (id) {
                const clip = layout.find((item) => item.id === id);
                if (clip) actions.seek(clip.timelineStart);
              }
            }}
            onSelectOverlay={() => setSelectedId(OVERLAY_MATERIAL_ID)}
            onSeek={actions.seek}
            onChangeRange={changeClipRange}
            onMove={moveClip}
            onDropGenerated={addGeneratedClip}
            onDropVideo={placeVideoClip}
          />
        </div>

        <FormationControls
          className="bg-neutral-950"
          isPlaying={state.isPlaying}
          currentTime={state.currentTime}
          duration={state.duration}
          volume={state.volume}
          muted={state.muted}
          playbackRate={state.playbackRate}
          mirrored={state.mirrored}
          showMirror={false}
          showProgress={false}
          onTogglePlay={actions.togglePlay}
          onSeek={actions.seek}
          onPrevBeat={() => jumpBeat(-1)}
          onNextBeat={() => jumpBeat(1)}
          onSetVolume={actions.setVolume}
          onToggleMute={actions.toggleMute}
          onSetRate={actions.setPlaybackRate}
          onToggleMirror={actions.toggleMirror}
        />
      </div>

      <aside className="flex h-full w-[clamp(300px,28vw,380px)] shrink-0 flex-col border-l border-white/5 bg-neutral-950">
        <section className="flex min-h-0 flex-[3] flex-col border-b border-white/5">
          <div className="shrink-0 p-5">
            <p className="text-xs font-medium text-neutral-300">
              素材设置
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedId === OVERLAY_MATERIAL_ID ? (
              <OverlayInspector
                settings={stageSettings}
                onChange={updateStage}
              />
            ) : selectedClip ? (
              <div className="px-3 pb-3 pt-0">
                <ClipInspector
                  clip={selectedClip}
                  onChange={updateClip}
                  onDelete={removeClip}
                />
              </div>
            ) : (
              <div className="flex h-full min-h-32 flex-col items-center justify-center px-3 text-center">
                <p className="text-xs text-neutral-600">
                  请在时间线中选择一个素材
                </p>
                <p className="mt-2 text-[11px] leading-5 text-neutral-700">
                  素材的时间、速度与播放设置会显示在这里
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-[2] flex-col">
          <div className="shrink-0 p-5">
            <p className="text-xs font-medium text-neutral-300">
              素材库
            </p>
          </div>
          <div className="mx-3 grid shrink-0 grid-cols-2 rounded-lg bg-neutral-900 text-sm">
            {([
              ["generated", "生成素材", Sparkles],
              ["clips", "视频素材", Clapperboard],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLibraryTab(id)}
                onDragOver={(event) => {
                  if (
                    id !== "clips" ||
                    !event.dataTransfer.types.includes("Files")
                  ) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setLibraryTab("clips");
                  setClipDropActive(true);
                }}
                onDrop={(event) => {
                  if (id !== "clips") return;
                  event.preventDefault();
                  setLibraryTab("clips");
                  setClipDropActive(false);
                  void addClipFiles(event.dataTransfer.files);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs transition-colors ${
                  libraryTab === id
                    ? id === "clips"
                      ? "bg-[#30E6FF] text-black"
                      : "bg-violet-500 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {libraryTab === "clips" ? (
              <div
                className={`min-h-full px-3 pb-3 pt-4 transition-colors ${
                  clipDropActive ? "bg-[#30E6FF]/[0.04]" : ""
                }`}
                onDragEnter={(event) => {
                  if (!event.dataTransfer.types.includes("Files")) return;
                  event.preventDefault();
                  setClipDropActive(true);
                }}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes("Files")) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setClipDropActive(true);
                }}
                onDragLeave={(event) => {
                  const nextTarget = event.relatedTarget;
                  if (
                    !(nextTarget instanceof Node) ||
                    !event.currentTarget.contains(nextTarget)
                  ) {
                    setClipDropActive(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setClipDropActive(false);
                  void addClipFiles(event.dataTransfer.files);
                }}
              >
            <input
              ref={clipInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(event) => void addClipFiles(event.target.files)}
            />
            <button
              type="button"
              onClick={() => clipInputRef.current?.click()}
              disabled={addingClips}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-[11px] text-[#30E6FF] transition-colors disabled:opacity-40 ${
                clipDropActive
                  ? "border-[#30E6FF]/70 bg-[#30E6FF]/15"
                  : "border-[#30E6FF]/25 bg-[#30E6FF]/5 hover:border-[#30E6FF]/50 hover:bg-[#30E6FF]/10"
              }`}
            >
              {clipDropActive ? (
                <Upload className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {addingClips
                ? "正在添加…"
                : clipDropActive
                  ? "松开以上传视频"
                  : "点击或拖放视频素材"}
            </button>
            {clipError && (
              <p className="mt-2 text-[11px] leading-5 text-red-300/80">
                {clipError}
              </p>
            )}

            {videoClips.length > 0 && (
              <div className="mt-4 space-y-2">
                {videoClips.map((clip) => {
                  const placed = layout.find((item) => item.id === clip.id);
                  const instanceCount =
                    layout.filter(
                      (item) =>
                        item.assetId === clip.id ||
                        (item.id === clip.id && !item.assetId),
                    ).length;
                  const clipUrl = clipUrls.get(clip.id);
                  return (
                  <button
                    key={clip.id}
                    type="button"
                    draggable
                    aria-label={`拖拽 ${clip.name} 到合成时间线`}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copyMove";
                      event.dataTransfer.setData(VIDEO_CLIP_DRAG_TYPE, clip.id);
                    }}
                    onClick={() => {
                      if (!placed) return;
                      setSelectedId(clip.id);
                      actions.seek(placed.timelineStart);
                    }}
                    className={`flex w-full cursor-grab items-center gap-3 rounded-lg border p-2 text-left transition-colors active:cursor-grabbing ${
                      selectedId === clip.id && placed
                        ? "border-[#30e6ff66] bg-[#30E6FF]/10"
                        : "border-white/[0.07] bg-black/30 hover:border-white/15 hover:bg-white/[0.035] active:border-white/25"
                    }`}
                  >
                    <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-black">
                      {clip.thumbnail ? (
                        <img
                          src={clip.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : clipUrl ? (
                        <video
                          src={clipUrl}
                          muted
                          playsInline
                          preload="metadata"
                          onLoadedMetadata={(event) => {
                            event.currentTarget.currentTime = Math.min(
                              0.1,
                              event.currentTarget.duration,
                            );
                          }}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <Clapperboard className="h-4 w-4 text-neutral-700" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[11px] font-medium text-neutral-300"
                        title={clip.name}
                      >
                        {clip.name}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[10px] tabular-nums text-neutral-600">
                        <span>{formatTime(clip.sourceDuration)}</span>
                        {instanceCount > 0 && (
                          <span className="rounded bg-[#30E6FF]/10 px-1.5 py-0.5 text-[#30E6FF]">
                            时间线 ×{instanceCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  );
                })}
              </div>
            )}

              </div>
            ) : libraryTab === "generated" ? (
              <StageInspector />
            ) : null}
          </div>
        </section>
      </aside>
      </div>
      {exportOpen && (
        <PerformingExportDialog
          project={{
            ...project,
            clips,
            stage: stageSettings,
          }}
          src={src}
          beats={beats}
          countdownBeats={countdownBeats}
          mirrored={state.mirrored}
          visibility={trackVisibility}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
