"use client";

import {
  ArrowLeft,
  Clapperboard,
  Download,
  Layers3,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePlayer } from "@/hooks/usePlayer";
import { deriveSegments, findSegmentIndex } from "@/lib/segments";
import { formatTime } from "@/lib/format";
import {
  clipAtTimelineTime,
  layoutPerformingClips,
} from "@/lib/composition";
import {
  deletePerformingClipMedia,
  getPerformingClipMedia,
  savePerformingClipMedia,
} from "@/lib/performingStore";
import type { PerformingClip, PerformingProject } from "@/lib/types";
import { DEFAULT_PERFORMING_STAGE } from "@/lib/types";
import { ClipInspector } from "./ClipInspector";
import { CompositionTimeline } from "./CompositionTimeline";
import { DevToolsButton } from "./DevToolsButton";
import { OverlayInspector } from "./OverlayInspector";
import { PerformanceStageRenderer } from "./PerformanceStageRenderer";
import { ProgressBar } from "./ProgressBar";
import { StageInspector } from "./StageInspector";

type InspectorTab = "clips" | "stage" | "overlay";

interface PerformingWorkspaceProps {
  project: PerformingProject;
  src: string;
  onBack: () => void;
  onProjectChange: (project: PerformingProject) => void;
}

function mediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let settled = false;
    const timer = window.setTimeout(() => finish(), 10_000);
    const finish = (duration?: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      if (duration == null || !Number.isFinite(duration)) {
        reject(new Error(`Unable to read ${file.name}.`));
      } else {
        resolve(duration);
      }
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(video.duration);
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
  const [tab, setTab] = useState<InspectorTab>("clips");
  const [clips, setClips] = useState<PerformingClip[]>(project.clips ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(
    project.clips?.[0]?.id ?? null,
  );
  const [clipUrls, setClipUrls] = useState<Map<string, string>>(new Map());
  const [addingClips, setAddingClips] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const stageSettings = useMemo(
    () => ({
      ...DEFAULT_PERFORMING_STAGE,
      ...project.stage,
    }),
    [project.stage],
  );
  const bpm = project.bpm ?? 120;
  const offset = project.offset ?? 0;
  const segments = useMemo(
    () => deriveSegments(bpm, offset, state.duration),
    [bpm, offset, state.duration],
  );
  const beats = useMemo(
    () => segments.flatMap((segment) => segment.beats),
    [segments],
  );
  const activeIndex = useMemo(
    () => findSegmentIndex(segments, state.currentTime),
    [segments, state.currentTime],
  );
  const layout = useMemo(() => layoutPerformingClips(clips), [clips]);
  const selectedClip = layout.find((clip) => clip.id === selectedId) ?? null;
  const activeClip = clipAtTimelineTime(layout, state.currentTime);
  const activeClipUrl = activeClip ? clipUrls.get(activeClip.id) : null;
  const usedDuration = layout.at(-1)?.timelineEnd ?? 0;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const loaded = new Map<string, string>();
      for (const clip of initialClipsRef.current) {
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
    if (!video || !activeClip) return;
    const desiredTime = Math.min(
      activeClip.sourceOut,
      Math.max(
        activeClip.sourceIn,
        activeClip.sourceIn +
          (state.currentTime - activeClip.timelineStart) *
            activeClip.playbackRate,
      ),
    );
    video.playbackRate = Math.max(
      0.25,
      Math.min(4, activeClip.playbackRate),
    );
    if (!state.isPlaying || Math.abs(video.currentTime - desiredTime) > 0.18) {
      video.currentTime = desiredTime;
    }
    if (state.isPlaying && video.paused) {
      void video.play().catch(() => {});
    } else if (!state.isPlaying && !video.paused) {
      video.pause();
    }
  }, [activeClip, state.currentTime, state.isPlaying]);

  const commitClips = useCallback(
    (nextClips: PerformingClip[]) => {
      setClips(nextClips);
      onProjectChange({
        ...project,
        clips: nextClips,
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
        const sourceDuration = await mediaDuration(file);
        const clip: PerformingClip = {
          id: crypto.randomUUID(),
          name: file.name,
          sourceDuration,
          sourceIn: 0,
          timelineDuration: Math.min(sourceDuration, (60 / bpm) * 8),
          playbackRate: 1,
        };
        await savePerformingClipMedia(project.id, clip.id, file);
        const url = URL.createObjectURL(file);
        clipUrlsRef.current.set(clip.id, url);
        additions.push(clip);
      }
      if (!additions.length) {
        setClipError("Choose browser-playable video files.");
        return;
      }
      setClipUrls(new Map(clipUrlsRef.current));
      const nextClips = [...clips, ...additions];
      commitClips(nextClips);
      setSelectedId(additions[0].id);
    } catch (error) {
      console.error("Failed to add Performing clips.", error);
      setClipError("One or more clips could not be added.");
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
        "sourceIn" | "timelineDuration" | "playbackRate"
      >
    >,
  ) => {
    commitClips(
      clips.map((clip) => {
        if (clip.id !== id) return clip;
        return {
          ...clip,
          ...patch,
          sourceIn: Math.max(
            0,
            Math.min(
              patch.sourceIn ?? clip.sourceIn,
              Math.max(0, clip.sourceDuration - 0.1),
            ),
          ),
          timelineDuration: Math.max(
            0.2,
            patch.timelineDuration ?? clip.timelineDuration,
          ),
          playbackRate: Math.max(
            0.25,
            Math.min(4, patch.playbackRate ?? clip.playbackRate),
          ),
        };
      }),
    );
  };

  const removeClip = (id: string) => {
    const url = clipUrlsRef.current.get(id);
    if (url) URL.revokeObjectURL(url);
    clipUrlsRef.current.delete(id);
    setClipUrls(new Map(clipUrlsRef.current));
    const nextClips = clips.filter((clip) => clip.id !== id);
    commitClips(nextClips);
    setSelectedId(nextClips[0]?.id ?? null);
    void deletePerformingClipMedia(project.id, id).catch((error) => {
      console.error("Failed to remove clip media.", error);
    });
  };

  const reorderClips = (ids: string[]) => {
    const byId = new Map(clips.map((clip) => [clip.id, clip]));
    commitClips(
      ids
        .map((id) => byId.get(id))
        .filter((clip): clip is PerformingClip => clip != null),
    );
  };

  const jumpSegment = (direction: -1 | 1) => {
    const index = Math.max(
      0,
      Math.min(segments.length - 1, activeIndex + direction),
    );
    const target = segments[index];
    if (target) actions.seek(target.start);
  };

  return (
    <div className="flex h-full w-full bg-black">
      <div className="relative flex min-w-0 flex-1 flex-col">
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
            disabled
            title="下一阶段接入导出"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-neutral-600"
          >
            <Download className="h-3.5 w-3.5" />
            导出
          </button>
          <DevToolsButton />
        </header>

        <div
          className="relative flex min-h-0 flex-1 cursor-pointer items-center justify-center overflow-hidden bg-black"
          onClick={actions.togglePlay}
        >
          <video
            {...videoProps}
            ref={videoRef}
            src={src}
            className={
              stageSettings.backgroundMode === "generated" || clips.length
                ? "pointer-events-none absolute h-px w-px opacity-0"
                : "pointer-events-none max-h-full max-w-full object-contain"
            }
          />
          {stageSettings.backgroundMode === "video" &&
            activeClip &&
            activeClipUrl && (
            <video
              key={activeClip.id}
              ref={clipVideoRef}
              src={activeClipUrl}
              muted
              playsInline
              onLoadedMetadata={(event) => {
                event.currentTarget.currentTime = activeClip.sourceIn;
              }}
              className="pointer-events-none max-h-full max-w-full object-contain"
            />
          )}
          {stageSettings.backgroundMode === "video" &&
            clips.length > 0 &&
            (!activeClip || !activeClipUrl) && (
            <div className="text-sm text-neutral-600">Loading clip preview...</div>
          )}
          {stageSettings.backgroundMode === "generated" ? (
            <PerformanceStageRenderer
              time={state.currentTime}
              beats={beats}
              template={stageSettings.template}
              playing={state.isPlaying}
              showBeatCode={stageSettings.showBeatCode}
              showSectionRail={stageSettings.showSectionRail}
              beatCodePositions={stageSettings.beatCodePositions}
              railPositions={stageSettings.railPositions}
              visualLeadMs={stageSettings.visualLeadMs}
              secondaryAccentCount={stageSettings.secondaryAccentCount}
            />
          ) : (
            <PerformanceStageRenderer
              time={state.currentTime}
              beats={beats}
              template="minimal"
              playing={state.isPlaying}
              showBeatCode={stageSettings.showBeatCode}
              showSectionRail={stageSettings.showSectionRail}
              beatCodePositions={stageSettings.beatCodePositions}
              railPositions={stageSettings.railPositions}
              visualLeadMs={stageSettings.visualLeadMs}
              secondaryAccentCount={stageSettings.secondaryAccentCount}
              signalOnly
            />
          )}
          <div className="pointer-events-none absolute left-5 top-5 rounded-lg border border-white/10 bg-black/45 px-3 py-2 backdrop-blur">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {stageSettings.backgroundMode === "generated"
                ? "Generated stage"
                : activeClip
                  ? `Clip ${layout.indexOf(activeClip) + 1}`
                  : "Main media"}
            </p>
            <p className="mt-1 max-w-56 truncate text-xs text-neutral-300">
              {stageSettings.backgroundMode === "generated"
                ? stageSettings.template
                : activeClip?.name ?? project.sourceName}
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/5 bg-neutral-950 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-600">
              Composition timeline
            </span>
            <span className="text-[10px] text-neutral-700">
              Drag to reorder · Drag right edge to snap duration
            </span>
          </div>
          <CompositionTimeline
            layout={layout}
            beats={beats}
            duration={state.duration}
            currentTime={state.currentTime}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              if (id) {
                const clip = layout.find((item) => item.id === id);
                if (clip) actions.seek(clip.timelineStart);
              }
            }}
            onSeek={actions.seek}
            onResize={(id, duration) =>
              updateClip(id, { timelineDuration: duration })
            }
            onReorder={reorderClips}
          />
          {clips.length > 0 && (
            <div className="mt-2 flex justify-between text-[10px] text-neutral-700">
              <span>{clips.length} clips · {usedDuration.toFixed(1)}s placed</span>
              <span>
                {usedDuration > state.duration
                  ? `${(usedDuration - state.duration).toFixed(1)}s over soundtrack`
                  : `${Math.max(0, state.duration - usedDuration).toFixed(1)}s remaining`}
              </span>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/5 bg-neutral-950 px-4 py-2.5">
          <ProgressBar
            currentTime={state.currentTime}
            duration={state.duration}
            onSeek={actions.seek}
          />
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => jumpSegment(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-white/10"
              aria-label="上一八拍"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={actions.togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-black"
              aria-label="播放或暂停"
            >
              {state.isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 fill-black" />
              )}
            </button>
            <button
              type="button"
              onClick={() => jumpSegment(1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-white/10"
              aria-label="下一八拍"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <span className="ml-3 text-xs tabular-nums text-neutral-500">
              {formatTime(state.currentTime)} / {formatTime(state.duration)}
            </span>
            <span className="ml-auto text-xs tabular-nums text-neutral-600">
              {Math.round(bpm)} BPM
            </span>
          </div>
        </div>
      </div>

      <aside className="flex w-72 shrink-0 flex-col border-l border-white/5 bg-neutral-950">
        <div className="border-b border-white/5 px-4 py-4">
          <p className="text-sm font-medium text-white">Performing</p>
          <p className="mt-1 text-xs text-neutral-600">Compose and stage</p>
        </div>
        <div className="grid grid-cols-3 border-b border-white/5 px-2 py-2">
          {([
            ["clips", "Clips", Clapperboard],
            ["stage", "Stage", Sparkles],
            ["overlay", "Overlay", Layers3],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] transition-colors ${
                tab === id
                  ? "bg-violet-400/10 text-violet-300"
                  : "text-neutral-600 hover:text-neutral-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "clips" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-violet-300/20 bg-violet-400/5 px-3 py-3 text-xs text-violet-300 transition-colors hover:border-violet-300/40 hover:bg-violet-400/10 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              {addingClips ? "Adding clips..." : "Add video clips"}
            </button>
            {clipError && (
              <p className="mt-2 text-[11px] leading-5 text-red-300/80">
                {clipError}
              </p>
            )}

            {clips.length > 0 && (
              <div className="mt-4 space-y-1">
                {clips.map((clip, index) => (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(clip.id);
                      const placed = layout.find((item) => item.id === clip.id);
                      if (placed) actions.seek(placed.timelineStart);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
                      selectedId === clip.id
                        ? "bg-violet-400/10 text-white"
                        : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/5 text-[10px] tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {clip.name}
                    </span>
                    <span className="text-[10px] tabular-nums text-neutral-700">
                      {clip.timelineDuration.toFixed(1)}s
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="my-5 h-px bg-white/5" />
            {selectedClip ? (
              <ClipInspector
                clip={selectedClip}
                onChange={updateClip}
                onDelete={removeClip}
              />
            ) : (
              <div className="py-8 text-center">
                <p className="text-xs text-neutral-600">
                  Add or select a clip to edit it.
                </p>
                <p className="mt-2 text-[11px] leading-5 text-neutral-700">
                  Adjust source in, speed, and timeline duration here.
                </p>
              </div>
            )}
          </div>
        ) : tab === "stage" ? (
          <StageInspector settings={stageSettings} onChange={updateStage} />
        ) : (
          <OverlayInspector settings={stageSettings} onChange={updateStage} />
        )}
      </aside>
    </div>
  );
}
