"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ArrowLeft,
  Redo2,
  RefreshCw,
  RotateCcw,
  Undo2,
} from "lucide-react";
import type {
  FormationAudiencePosition,
  FormationChange,
  FormationPosition,
} from "@/lib/types";
import {
  adjacentBeatTime,
} from "@/lib/segments";
import {
  defaultFormationPositions,
  formationAtTime,
  resizeFormationPositions,
  snapTimeToBeat,
} from "@/lib/formations";
import { FormationSidebar } from "./FormationSidebar";
import { FormationStageEditor } from "./FormationStageEditor";
import { FormationTimeline } from "./FormationTimeline";
import { FormationControls } from "./Controls";
import { cn } from "@/lib/cn";
import { PausedVideoFrame } from "./PausedVideoFrame";

type Endpoint = "start" | "end";
const HISTORY_LIMIT = 5;

const closestEndpoint = (
  changes: FormationChange[],
  time: number,
): { id: string; endpoint: Endpoint } | null => {
  let closest: { id: string; endpoint: Endpoint; distance: number } | null =
    null;
  for (const [index, change] of changes.entries()) {
    const endpoints: Endpoint[] = index === 0 ? ["start", "end"] : ["end"];
    for (const endpoint of endpoints) {
      const endpointTime =
        endpoint === "start" ? change.startTime : change.endTime;
      const distance = Math.abs(endpointTime - time);
      if (!closest || distance < closest.distance) {
        closest = { id: change.id, endpoint, distance };
      }
    }
  }
  return closest ? { id: closest.id, endpoint: closest.endpoint } : null;
};

const previewEndpoint = (
  changes: FormationChange[],
  time: number,
): { id: string; endpoint: Endpoint } | null => {
  const sorted = [...changes].sort((a, b) => a.startTime - b.startTime);
  if (
    sorted.some((change) => time >= change.startTime && time <= change.endTime)
  ) {
    return null;
  }
  const previous = [...sorted]
    .reverse()
    .find((change) => change.endTime < time);
  if (previous) return { id: previous.id, endpoint: "end" };
  const next = sorted.find((change) => change.startTime > time);
  return next ? { id: next.id, endpoint: "start" } : null;
};

interface FormationEditorPageProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  videoProps: React.VideoHTMLAttributes<HTMLVideoElement>;
  mirrored: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  initialChanges: FormationChange[];
  initialAudiencePosition: FormationAudiencePosition;
  activeSegmentNumber: number | null;
  activeBeat: number;
  bpm: number;
  offset: number;
  beatTimes: number[];
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onSetRate: (rate: number) => void;
  onToggleMirror: () => void;
  onBack: () => void;
  onChange: (
    changes: FormationChange[],
    audiencePosition: FormationAudiencePosition,
  ) => void;
}

const copyPositions = (positions: FormationPosition[]) =>
  positions.map((position) => ({ ...position }));

const copyChanges = (changes: FormationChange[]) =>
  changes.map((change) => ({
    ...change,
    startPositions: copyPositions(change.startPositions),
    endPositions: copyPositions(change.endPositions),
  }));

const linkFormationStarts = (changes: FormationChange[]) => {
  const sorted = copyChanges(changes).sort(
    (first, second) => first.startTime - second.startTime,
  );
  return sorted.map((change, index) =>
    index === 0
      ? change
      : {
          ...change,
          startPositions: copyPositions(sorted[index - 1].endPositions),
        },
  );
};

export function FormationEditorPage({
  src,
  videoRef,
  videoProps,
  mirrored,
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  playbackRate,
  initialChanges,
  initialAudiencePosition,
  activeSegmentNumber,
  activeBeat,
  bpm,
  offset,
  beatTimes,
  onTogglePlay,
  onSeek,
  onSetVolume,
  onToggleMute,
  onSetRate,
  onToggleMirror,
  onBack,
  onChange,
}: FormationEditorPageProps) {
  const resumeTimeRef = useRef(currentTime);
  const [changes, setChanges] = useState<FormationChange[]>(() =>
    linkFormationStarts(initialChanges),
  );
  const changesRef = useRef(changes);
  const [undoStack, setUndoStack] = useState<FormationChange[][]>([]);
  const [redoStack, setRedoStack] = useState<FormationChange[][]>([]);
  const [syncedEndIds, setSyncedEndIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [audiencePosition, setAudiencePositionState] =
    useState<FormationAudiencePosition>(initialAudiencePosition);
  const [defaultPositions, setDefaultPositions] = useState<
    FormationPosition[]
  >(() => defaultFormationPositions());
  const [selectedState, setSelected] = useState<{
    id: string;
    endpoint: Endpoint;
  } | null>(() => closestEndpoint(initialChanges, currentTime));

  const setCurrentChanges = (next: FormationChange[]) => {
    changesRef.current = next;
    setChanges(next);
    onChange(next, audiencePosition);
  };

  const setCurrentAudiencePosition = (next: FormationAudiencePosition) => {
    setAudiencePositionState(next);
    onChange(changesRef.current, next);
  };

  const recordHistory = () => {
    const snapshot = copyChanges(changesRef.current);
    setUndoStack((stack) => [...stack, snapshot].slice(-HISTORY_LIMIT));
    setRedoStack([]);
  };

  const commitChanges = (
    update:
      | FormationChange[]
      | ((current: FormationChange[]) => FormationChange[]),
    record = true,
  ) => {
    const current = changesRef.current;
    const updated = typeof update === "function" ? update(current) : update;
    const next = linkFormationStarts(updated);
    if (record) recordHistory();
    setCurrentChanges(next);
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    const currentSnapshot = copyChanges(changesRef.current);
    setRedoStack((stack) =>
      [...stack, currentSnapshot].slice(-HISTORY_LIMIT),
    );
    setUndoStack((stack) => stack.slice(0, -1));
    setCurrentChanges(copyChanges(previous));
  };

  const redo = () => {
    const next = redoStack.at(-1);
    if (!next) return;
    const currentSnapshot = copyChanges(changesRef.current);
    setUndoStack((stack) =>
      [...stack, currentSnapshot].slice(-HISTORY_LIMIT),
    );
    setRedoStack((stack) => stack.slice(0, -1));
    setCurrentChanges(copyChanges(next));
  };

  const selected =
    selectedState &&
    changes.some((change) => change.id === selectedState.id)
      ? selectedState
      : null;
  const selectedChange = selected
    ? changes.find((change) => change.id === selected.id) ?? null
    : null;
  const previewEditTarget =
    !selected && !isPlaying ? previewEndpoint(changes, currentTime) : null;
  const stageEditTarget = selected ?? previewEditTarget;
  const displayedPositions =
    isPlaying && changes.length > 0
      ? formationAtTime(changes, currentTime)
      : selectedChange
        ? selected?.endpoint === "start"
          ? selectedChange.startPositions
          : selectedChange.endPositions
        : changes.length > 0
          ? formationAtTime(changes, currentTime)
          : defaultPositions;
  const selectedIndex = selectedChange
    ? changes.findIndex((change) => change.id === selectedChange.id)
    : -1;
  const previousChange =
    selectedIndex > 0 ? changes[selectedIndex - 1] : null;
  const dancerCount = displayedPositions.length;
  const resetLabel =
    selected?.endpoint === "end"
      ? syncedEndIds.has(selected.id)
        ? "重置为开始走位"
        : "同步为开始走位"
      : previousChange
        ? "重置为前置走位"
        : "重置为默认走位";

  const selectEndpoint = (
    id: string,
    endpoint: Endpoint,
    previewTime?: number,
  ) => {
    const change = changes.find((item) => item.id === id);
    if (!change) return;
    setSelected({ id, endpoint });
    onSeek(
      previewTime ??
        (endpoint === "start" ? change.startTime : change.endTime),
    );
  };

  const createChange = (requestedStart: number, requestedEnd: number) => {
    const maxTime = duration > 0 ? duration : requestedEnd;
    const startTime = snapTimeToBeat(requestedStart, bpm, offset, maxTime);
    const endTime = Math.max(
      startTime,
      snapTimeToBeat(requestedEnd, bpm, offset, maxTime),
    );
    const previous = [...changesRef.current]
      .filter((item) => item.startTime <= startTime)
      .sort((a, b) => a.startTime - b.startTime)
      .at(-1);
    const positions = previous
      ? copyPositions(previous.endPositions)
      : copyPositions(defaultPositions);
    const change: FormationChange = {
      id: crypto.randomUUID(),
      startTime,
      endTime,
      startPositions: copyPositions(positions),
      endPositions: copyPositions(positions),
    };
    commitChanges((current) =>
      [...current, change].sort((a, b) => a.startTime - b.startTime),
    );
    setSyncedEndIds((ids) => new Set(ids).add(change.id));
    setSelected({ id: change.id, endpoint: "end" });
    onSeek(endTime);
  };

  const seekBeat = useCallback(
    (direction: -1 | 1) => {
      onSeek(
        adjacentBeatTime(
          beatTimes,
          videoRef.current?.currentTime ?? currentTime,
          direction,
          duration,
        ),
      );
    },
    [beatTimes, currentTime, duration, onSeek, videoRef],
  );
  const seekPreviousBeat = useCallback(() => seekBeat(-1), [seekBeat]);
  const seekNextBeat = useCallback(() => seekBeat(1), [seekBeat]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        onTogglePlay();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekPreviousBeat();
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        seekNextBeat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTogglePlay, seekNextBeat, seekPreviousBeat]);

  const updateTime = (id: string, endpoint: Endpoint, time: number) => {
    commitChanges((current) =>
      current
        .map((change) => {
          if (change.id !== id) return change;
          if (endpoint === "end") {
            return { ...change, endTime: Math.max(time, change.startTime) };
          }
          if (time < change.endTime) {
            return { ...change, startTime: time };
          }
          const rangeDuration = Math.max(
            60 / Math.max(1, bpm),
            change.endTime - change.startTime,
          );
          const startTime = Math.min(time, Math.max(0, duration - rangeDuration));
          return {
            ...change,
            startTime,
            endTime: Math.min(duration, startTime + rangeDuration),
          };
        })
        .sort((a, b) => a.startTime - b.startTime),
    );
  };

  const updatePositions = (positions: FormationPosition[]) => {
    if (!stageEditTarget) {
      setDefaultPositions(positions);
      return;
    }
    commitChanges((current) =>
      current.map((change) => {
        if (change.id !== stageEditTarget.id) return change;
        return stageEditTarget.endpoint === "start"
          ? { ...change, startPositions: positions }
          : { ...change, endPositions: positions };
      }),
      false,
    );
    if (stageEditTarget.endpoint === "start") {
      setSyncedEndIds((ids) => {
        const next = new Set(ids);
        next.delete(stageEditTarget.id);
        return next;
      });
    } else {
      const index = changes.findIndex(
        (change) => change.id === stageEditTarget.id,
      );
      const followingChange = changes[index + 1];
      if (followingChange) {
        setSyncedEndIds((ids) => {
          const next = new Set(ids);
          next.delete(followingChange.id);
          return next;
        });
      }
    }
  };

  const setDancerCount = (count: number) => {
    setDefaultPositions(defaultFormationPositions(count));
    if (changesRef.current.length === 0) return;

    commitChanges((current) =>
      current.map((change) => ({
        ...change,
        startPositions: resizeFormationPositions(change.startPositions, count),
        endPositions: resizeFormationPositions(change.endPositions, count),
      })),
    );
  };

  const resetSelectedFormation = () => {
    if (!selected || !selectedChange) {
      setDefaultPositions(defaultFormationPositions(dancerCount));
      return;
    }
    commitChanges((current) =>
      current.map((change) => {
        if (change.id !== selected.id) return change;
        if (selected.endpoint === "start") {
          return {
            ...change,
            startPositions: previousChange
              ? copyPositions(previousChange.endPositions)
              : defaultFormationPositions(dancerCount),
          };
        }
        return {
          ...change,
          endPositions: copyPositions(change.startPositions),
        };
      }),
    );
    if (selected.endpoint === "end") {
      setSyncedEndIds((ids) => new Set(ids).add(selected.id));
    } else {
      setSyncedEndIds((ids) => {
        const next = new Set(ids);
        next.delete(selected.id);
        return next;
      });
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/5 bg-neutral-950 px-4">
        <button
          type="button"
          onClick={onBack}
          data-tooltip="返回播放器"
          className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回
        </button>
        <span className="flex-1 text-sm font-semibold text-white">编辑走位</span>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col bg-black">
          <div className="relative flex min-h-44 flex-[3] items-center justify-center overflow-hidden border-b border-white/5 bg-black">
            <video
              {...videoProps}
              ref={videoRef}
              src={src}
              onLoadedMetadata={(event) => {
                videoProps.onLoadedMetadata?.(event);
                event.currentTarget.currentTime = Math.min(
                  resumeTimeRef.current,
                  event.currentTarget.duration || resumeTimeRef.current,
                );
              }}
              onClick={onTogglePlay}
              className={cn(
                "max-h-full max-w-full cursor-pointer object-contain",
                mirrored && "-scale-x-100",
              )}
            />
            <PausedVideoFrame
              videoRef={videoRef}
              src={src}
              mirrored={mirrored}
            />
          </div>
          <div className="flex h-10 shrink-0 items-center justify-center border-b border-white/5 bg-neutral-950 px-5">
            <span className="text-base font-semibold text-white">
              {activeSegmentNumber != null && activeBeat >= 0
                ? `${activeSegmentNumber}-${activeBeat + 1}`
                : "–"}
            </span>
          </div>

          <div className="flex min-h-[240px] flex-[2] flex-col bg-neutral-950">
            <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-white/5 px-4 py-2">
              {selectedChange ? (
                <span className="whitespace-nowrap text-xs font-medium text-neutral-300">
                  {selected?.endpoint === "start"
                    ? "初始走位"
                    : `走位 ${selectedIndex + 1}`}
                </span>
              ) : (
                <span className="text-xs font-medium text-neutral-500">
                  选择右侧关键帧
                </span>
              )}
              <div className="min-w-2 flex-1" />
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                人数
                <select
                  value={dancerCount}
                  onChange={(event) =>
                    setDancerCount(Number(event.target.value))
                  }
                  className="h-8 rounded-lg border border-white/10 bg-neutral-900 px-2 text-xs text-neutral-200 outline-none"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (count) => (
                      <option key={count} value={count}>
                        {count} 人
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                观众
                <select
                  value={audiencePosition}
                  onChange={(event) =>
                    setCurrentAudiencePosition(
                      event.target.value as FormationAudiencePosition,
                    )
                  }
                  aria-label="观众位置"
                  className="h-8 rounded-lg border border-white/10 bg-neutral-900 px-2 text-xs text-neutral-200 outline-none"
                >
                  <option value="bottom">下方</option>
                  <option value="top">上方</option>
                  <option value="left">左侧</option>
                  <option value="right">右侧</option>
                </select>
              </label>
              <button
                type="button"
                data-tooltip={resetLabel}
                aria-label={resetLabel}
                onClick={resetSelectedFormation}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {selected?.endpoint === "end" &&
                !syncedEndIds.has(selected.id) ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                disabled={undoStack.length === 0}
                data-tooltip="撤回"
                aria-label="撤回"
                onClick={undo}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={redoStack.length === 0}
                data-tooltip="前进"
                aria-label="前进"
                onClick={redo}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <FormationStageEditor
                positions={displayedPositions}
                audiencePosition={audiencePosition}
                editable={
                  !isPlaying &&
                  (changes.length === 0 || Boolean(stageEditTarget))
                }
                onEditStart={
                  !isPlaying && stageEditTarget
                    ? () => {
                        setSelected(stageEditTarget);
                        recordHistory();
                      }
                    : undefined
                }
                onChange={updatePositions}
              />
            </div>
          </div>

          <FormationTimeline
            changes={changes}
            duration={duration}
            bpm={bpm}
            offset={offset}
            beatTimes={beatTimes}
            currentTime={currentTime}
            selectedId={selected?.id ?? null}
            onPreview={(time) => {
              setSelected(null);
              onSeek(time);
            }}
            onSelect={(id) => selectEndpoint(id, "end")}
            onResizeStart={recordHistory}
            onResize={(id, startTime, endTime) => {
              commitChanges(
                (current) =>
                current
                  .map((change) =>
                    change.id === id
                      ? { ...change, startTime, endTime }
                      : change,
                  )
                  .sort((a, b) => a.startTime - b.startTime),
                false,
              );
            }}
            onCreate={createChange}
          />

          <FormationControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            muted={muted}
            playbackRate={playbackRate}
            mirrored={mirrored}
            showProgress={false}
            onTogglePlay={onTogglePlay}
            onSeek={onSeek}
            onPrevBeat={seekPreviousBeat}
            onNextBeat={seekNextBeat}
            onSetVolume={onSetVolume}
            onToggleMute={onToggleMute}
            onSetRate={onSetRate}
            onToggleMirror={onToggleMirror}
          />

        </main>

        <FormationSidebar
          changes={changes}
          duration={duration}
          bpm={bpm}
          offset={offset}
          audiencePosition={audiencePosition}
          selected={selected}
          onAdd={() => createChange(currentTime, currentTime + 60 / bpm)}
          onDelete={(id) => {
            commitChanges((current) =>
              current.filter((change) => change.id !== id),
            );
            if (selected?.id === id) setSelected(null);
          }}
          onSelectEndpoint={selectEndpoint}
          onTimeChange={updateTime}
        />
      </div>
    </div>
  );
}
