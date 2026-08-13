"use client";

import {
  ArrowLeft,
  Clapperboard,
  Download,
  Plus,
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
import { adjacentBeatTime, deriveSegments } from "@/lib/segments";
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
import { FormationControls } from "./Controls";
import { DevToolsButton } from "./DevToolsButton";
import { OverlayInspector } from "./OverlayInspector";
import { PerformanceStageRenderer } from "./PerformanceStageRenderer";
import { StageInspector } from "./StageInspector";

type LibraryTab = "clips" | "generated";

const OVERLAY_MATERIAL_ID = "performing-overlay";

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
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("clips");
  const [clips, setClips] = useState<PerformingClip[]>(project.clips ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(
    project.clips?.[0]?.id ?? null,
  );
  const [clipUrls, setClipUrls] = useState<Map<string, string>>(new Map());
  const [addingClips, setAddingClips] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const [mediaAspectRatio, setMediaAspectRatio] = useState(16 / 9);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
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
  const layout = useMemo(() => layoutPerformingClips(clips), [clips]);
  const selectedClip = layout.find((clip) => clip.id === selectedId) ?? null;
  const activeClip = clipAtTimelineTime(layout, state.currentTime);
  const activeClipUrl = activeClip ? clipUrls.get(activeClip.id) : null;

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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, jumpBeat]);

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
          disabled
          title="下一阶段接入导出"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-neutral-600"
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
            className={
              stageSettings.backgroundMode === "generated" || clips.length
                ? "pointer-events-none absolute h-px w-px opacity-0"
                : `pointer-events-none h-full w-full object-contain ${
                    state.mirrored ? "-scale-x-100" : ""
                  }`
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
              className={`pointer-events-none h-full w-full object-contain ${
                state.mirrored ? "-scale-x-100" : ""
              }`}
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
            onResize={(id, duration) =>
              updateClip(id, { timelineDuration: duration })
            }
            onReorder={reorderClips}
          />
        </div>

        <FormationControls
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
          <div className="shrink-0 border-b border-white/5 px-5 py-4">
            <p className="text-base font-semibold text-white">素材设置</p>
            <p className="mt-1 text-[11px] text-neutral-600">
              Settings for the selected timeline material
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedId === OVERLAY_MATERIAL_ID ? (
              <OverlayInspector
                settings={stageSettings}
                onChange={updateStage}
              />
            ) : selectedClip ? (
              <div className="p-4">
              <ClipInspector
                clip={selectedClip}
                onChange={updateClip}
                onDelete={removeClip}
              />
              </div>
            ) : (
              <div className="flex h-full min-h-32 flex-col items-center justify-center px-4 text-center">
                <p className="text-xs text-neutral-600">
                  Select a material on the timeline.
                </p>
                <p className="mt-2 text-[11px] leading-5 text-neutral-700">
                  Source in, speed, and duration will appear here.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-[2] flex-col">
          <div className="shrink-0 px-5 py-4">
            <p className="text-base font-semibold text-white">素材库</p>
            <p className="mt-1 text-[11px] text-neutral-600">
              Clips and generated materials
            </p>
          </div>
          <div className="mx-4 mb-3 grid shrink-0 grid-cols-2 rounded-lg bg-neutral-900 p-0.5 text-sm">
            {([
              ["clips", "Clips", Clapperboard],
              ["generated", "Generated", Sparkles],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLibraryTab(id)}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
                  libraryTab === id
                    ? "bg-violet-500 text-white"
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
              <div className="p-3">
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
              onClick={() => updateStage({ backgroundMode: "video" })}
              className={`mb-2 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                stageSettings.backgroundMode === "video"
                  ? "border-violet-300/40 bg-violet-400/10 text-violet-200"
                  : "border-white/[0.07] text-neutral-500 hover:border-white/15 hover:text-neutral-300"
              }`}
            >
              <span className="flex aspect-video w-16 shrink-0 items-center justify-center rounded bg-neutral-900">
                <Clapperboard className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-medium">
                  Clip composition
                </span>
                <span className="mt-0.5 block text-[9px] text-neutral-600">
                  {clips.length} uploaded materials
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => clipInputRef.current?.click()}
              disabled={addingClips}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-violet-300/20 bg-violet-400/5 px-3 py-2.5 text-[11px] text-violet-300 transition-colors hover:border-violet-300/40 hover:bg-violet-400/10 disabled:opacity-40"
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

              </div>
            ) : libraryTab === "generated" ? (
              <StageInspector settings={stageSettings} onChange={updateStage} />
            ) : null}
          </div>
        </section>
      </aside>
      </div>
    </div>
  );
}
