"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Download } from "lucide-react";
import { VideoStage } from "./VideoStage";
import { Controls } from "./Controls";
import { SegmentSidebar, type SidebarTab } from "./SegmentSidebar";
import { SectionTimeline } from "./SectionTimeline";
import { SectionDialog } from "./SectionDialog";
import { ExportDialog } from "./ExportDialog";
import { DevToolsButton } from "./DevToolsButton";
import { FormationEditorPage } from "./FormationEditorPage";
import { usePlayer } from "@/hooks/usePlayer";
import { ThumbnailGenerator } from "@/lib/thumbnailGenerator";
import { detectSectionsFromUrl } from "@/lib/sectionDetection";
import { hasMusicStarted, musicStartPreRoll } from "@/lib/countIn";
import {
  activeBeatInSegment,
  beatGridAnchorIndex,
  beatPhaseInSegment,
  calibrateBeatGrid,
  deriveSegmentsFromBeats,
  findSectionIndex,
  findSegmentIndex,
  resolvePerformanceStart,
  sectionTimeRange,
} from "@/lib/segments";
import type {
  BeatAnalysis,
  BeatVizConfig,
  DanceSection,
  FormationAudiencePosition,
  FormationChange,
  Marker,
  MarkerColor,
  RhythmBeat,
  Segment,
} from "@/lib/types";

type LoopTarget = { kind: "beat" | "section"; key: number } | null;

const DEFAULT_BEAT_VIZ_CONFIG: BeatVizConfig = {
  countPoints: true,
  countPointStyle: "tiles",
  countPointPosition: "top",
  pulse: false,
  breath: false,
};

function isBeatVizConfig(value: unknown): value is BeatVizConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<BeatVizConfig>;
  return (
    typeof config.countPoints === "boolean" &&
    (config.countPointStyle === "dots" ||
      config.countPointStyle === "tiles") &&
    (config.countPointPosition === "top" ||
      config.countPointPosition === "bottom" ||
      config.countPointPosition === "left" ||
      config.countPointPosition === "right") &&
    typeof config.pulse === "boolean" &&
    typeof config.breath === "boolean"
  );
}

interface PlayerProps {
  src: string;
  fileName: string;
  analysis: BeatAnalysis;
  defaultAnalysis: Pick<
    BeatAnalysis,
    "bpm" | "offset" | "beats" | "engine" | "confidence"
  >;
  initialPerformanceStart?: number | null;
  initialCalibrationOpen?: boolean;
  initialMarkers?: Marker[];
  initialSections?: DanceSection[];
  initialFormationChanges?: FormationChange[];
  initialFormationAudiencePosition?: FormationAudiencePosition;
  onReset: () => void;
  /** 校准 / 标记 / 段落 / 时长变化时回调，用于自动保存到舞蹈库（防抖后触发）。 */
  onPersist?: (data: {
    bpm: number;
    offset: number;
    beats?: RhythmBeat[];
    musicStart?: number;
    performanceStart?: number;
    tempoChanged: boolean;
    markers: Marker[];
    sections: DanceSection[];
    formationChanges: FormationChange[];
    formationAudiencePosition: FormationAudiencePosition;
    duration: number;
  }) => void;
}

export function Player({
  src,
  fileName,
  analysis,
  defaultAnalysis,
  initialPerformanceStart,
  initialCalibrationOpen = false,
  initialMarkers,
  initialSections,
  initialFormationChanges,
  initialFormationAudiencePosition = "bottom",
  onReset,
  onPersist,
}: PlayerProps) {
  const { videoRef, videoProps, state, actions } = usePlayer();
  const { currentTime, duration } = state;

  const [markers, setMarkers] = useState<Marker[]>(initialMarkers ?? []);
  const [sections, setSections] = useState<DanceSection[]>(initialSections ?? []);
  const [formationChanges, setFormationChanges] = useState<FormationChange[]>(
    initialFormationChanges ?? [],
  );
  const [formationAudiencePosition, setFormationAudiencePosition] =
    useState<FormationAudiencePosition>(initialFormationAudiencePosition);
  const [tab, setTab] = useState<SidebarTab>("beat");
  const [danmakuOn, setDanmakuOn] = useState(true);
  const [formationOpen, setFormationOpen] = useState(false);
  const [formationEditing, setFormationEditing] = useState(false);
  const [vizConfig, setVizConfig] = useState<BeatVizConfig>(
    DEFAULT_BEAT_VIZ_CONFIG,
  );
  const activeVizConfig = isBeatVizConfig(vizConfig)
    ? vizConfig
    : DEFAULT_BEAT_VIZ_CONFIG;
  const [calibOpen, setCalibOpen] = useState(false);
  const calibrationTimerRef = useRef<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [selectedBeatIndices, setSelectedBeatIndices] = useState<number[]>([]);
  const [sectionDialog, setSectionDialog] = useState<
    { mode: "new" | "edit"; index: number; draft: DanceSection } | null
  >(null);
  const [loopTarget, setLoopTarget] = useState<LoopTarget>(null);
  useEffect(() => {
    if (!initialCalibrationOpen) return;
    calibrationTimerRef.current = window.setTimeout(() => {
      calibrationTimerRef.current = null;
      setCalibOpen(true);
    }, 1000);
    return () => {
      if (calibrationTimerRef.current != null) {
        window.clearTimeout(calibrationTimerRef.current);
        calibrationTimerRef.current = null;
      }
    };
  }, [initialCalibrationOpen]);

  const toggleCalibration = useCallback(() => {
    if (calibrationTimerRef.current != null) {
      window.clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }
    setCalibOpen((open) => !open);
  }, []);

  // 可校准的节拍参数：初始为 AI 检测值，校准面板可手动修正。
  const [bpm, setBpm] = useState(analysis.bpm);
  const [offset, setOffset] = useState(analysis.offset);
  const [beatBase, setBeatBase] = useState<RhythmBeat[]>(analysis.beats ?? []);
  const [beatBaseBpm, setBeatBaseBpm] = useState(analysis.bpm);
  const [beatBaseOffset, setBeatBaseOffset] = useState(analysis.offset);
  const [tempoChanged, setTempoChanged] = useState(false);
  const musicStart = analysis.musicStart;
  const [presentationAnchorReference] = useState(
    initialPerformanceStart ?? musicStart,
  );

  // 缩略图生成器：随视频源创建，卸载/切换时销毁
  const generator = useMemo(() => new ThumbnailGenerator(src), [src]);
  useEffect(() => () => generator.destroy(), [generator]);

  const calibratedBeats = useMemo(
    () =>
      calibrateBeatGrid(
        beatBase,
        beatBaseBpm,
        beatBaseOffset,
        bpm,
        offset,
      ),
    [beatBase, beatBaseBpm, beatBaseOffset, bpm, offset],
  );
  const presentationAnchorIndex = useMemo(
    () =>
      beatGridAnchorIndex(
        beatBase,
        presentationAnchorReference,
      ),
    [beatBase, presentationAnchorReference],
  );
  const presentationBeats = useMemo(
    () =>
      calibrateBeatGrid(
        beatBase.slice(presentationAnchorIndex),
        beatBaseBpm,
        beatBaseOffset,
        bpm,
        offset,
      ),
    [
      beatBase,
      presentationAnchorIndex,
      beatBaseBpm,
      beatBaseOffset,
      bpm,
      offset,
    ],
  );

  // Keep detector timestamps intact; only the presentation grid starts at count 1.
  const segments = useMemo<Segment[]>(
    () => deriveSegmentsFromBeats(presentationBeats, bpm, offset, duration),
    [presentationBeats, bpm, offset, duration],
  );
  const navigationBeats = useMemo(
    () =>
      (presentationBeats.length
        ? presentationBeats.map((beat) => beat.time)
        : segments.flatMap((segment) => segment.beats)
      ).filter(
        (time, index, all) =>
          Number.isFinite(time) &&
          time >= 0 &&
          time <= duration &&
          (index === 0 || time > all[index - 1]),
      ),
    [presentationBeats, segments, duration],
  );
  const performanceStart = useMemo(
    () =>
      presentationBeats[0]?.time ??
      resolvePerformanceStart(undefined, bpm, offset, musicStart),
    [presentationBeats, bpm, offset, musicStart],
  );

  const activeIndex = useMemo(
    () => findSegmentIndex(segments, currentTime),
    [segments, currentTime],
  );
  const activeBeat = useMemo(() => {
    if (activeIndex < 0 || !segments[activeIndex]) return -1;
    return activeBeatInSegment(segments[activeIndex], currentTime);
  }, [segments, activeIndex, currentTime]);
  const activeSectionIndex = useMemo(
    () => findSectionIndex(sections, segments, currentTime),
    [sections, segments, currentTime],
  );
  const activeSegmentNumber =
    activeIndex >= 0 ? segments[activeIndex]?.num ?? null : null;
  const secondsPerBeat = activeIndex >= 0
    ? segments[activeIndex]?.spb ?? 60 / bpm
    : 60 / bpm;

  // 边缘节拍可视化所需：当前拍内进度 + 是否第1拍
  const beatViz = useMemo(() => {
    const seg = activeIndex >= 0 ? segments[activeIndex] : null;
    if (!seg) return { active: false, phase: 1, isDownbeat: false };
    const beat = beatPhaseInSegment(seg, currentTime);
    return {
      active: true,
      phase: beat.phase,
      isDownbeat: beat.index === 0,
    };
  }, [activeIndex, segments, currentTime]);

  // 首次切到「段落」tab 且无段落时，本地自动识别一次
  const autoDetectTried = useRef((initialSections?.length ?? 0) > 0);
  useEffect(() => {
    if (tab !== "section" || autoDetectTried.current || duration <= 0) return;
    autoDetectTried.current = true;
    setDetecting(true);
    detectSectionsFromUrl(src, bpm, offset, duration, presentationBeats)
      .then((secs) => setSections(secs))
      .catch(() => {})
      .finally(() => setDetecting(false));
  }, [tab, duration, src, bpm, offset, presentationBeats]);

  // —— 循环（八拍 / 段落 互斥，开始时 5678 倒计时）——
  const beatLoopKey = loopTarget?.kind === "beat" ? loopTarget.key : null;
  const sectionLoopKey = loopTarget?.kind === "section" ? loopTarget.key : null;

  const toggleBeatLoop = useCallback(
    (i: number, seg: Segment) => {
      if (loopTarget?.kind === "beat" && loopTarget.key === i) {
        actions.stopLoop();
        setLoopTarget(null);
      } else {
        actions.startLoop({ start: seg.start, end: seg.end });
        setLoopTarget({ kind: "beat", key: i });
      }
    },
    [loopTarget, actions],
  );

  const toggleSectionLoop = useCallback(
    (i: number) => {
      const r = sectionTimeRange(sections[i], segments);
      if (!r) return;
      if (loopTarget?.kind === "section" && loopTarget.key === i) {
        actions.stopLoop();
        setLoopTarget(null);
      } else {
        actions.startLoop(r);
        setLoopTarget({ kind: "section", key: i });
      }
    },
    [loopTarget, actions, sections, segments],
  );

  const jumpToSegment = useCallback(
    (seg: Segment) => {
      if (loopTarget) {
        actions.stopLoop();
        setLoopTarget(null);
      }
      actions.seek(seg.start);
    },
    [loopTarget, actions],
  );

  const playSegmentWithCountIn = useCallback(
    (seg: Segment) => {
      if (loopTarget) {
        actions.stopLoop();
        setLoopTarget(null);
      }
      actions.startWithCountIn(seg.start);
    },
    [loopTarget, actions],
  );

  const jumpSection = useCallback(
    (i: number) => {
      const r = sectionTimeRange(sections[i], segments);
      if (!r) return;
      if (loopTarget) {
        actions.stopLoop();
        setLoopTarget(null);
      }
      actions.seek(r.start);
    },
    [sections, segments, loopTarget, actions],
  );

  const seekBeat = useCallback(
    (direction: -1 | 1) => {
      if (!navigationBeats.length) return;
      if (loopTarget) {
        actions.stopLoop();
        setLoopTarget(null);
      }
      const tolerance = 0.05;
      const target =
        direction < 0
          ? navigationBeats.findLast(
              (time) => time < currentTime - tolerance,
            )
          : navigationBeats.find((time) => time > currentTime + tolerance);
      actions.seek(target ?? (direction < 0 ? 0 : duration));
    },
    [navigationBeats, loopTarget, actions, currentTime, duration],
  );
  const prevBeat = useCallback(() => seekBeat(-1), [seekBeat]);
  const nextBeat = useCallback(() => seekBeat(1), [seekBeat]);

  // —— 段落增删改 ——
  const openAddSection = useCallback(() => {
    actions.pause();
    const last = Math.max(0, segments.length - 1);
    const start = activeIndex >= 0 ? activeIndex : 0;
    const end = Math.min(start + 3, last);
    setSectionDialog({
      mode: "new",
      index: -1,
      draft: { id: crypto.randomUUID(), name: `第${sections.length + 1}段`, startSeg: start, endSeg: end },
    });
  }, [actions, segments.length, activeIndex, sections.length]);

  const openEditSection = useCallback(
    (i: number) => {
      actions.pause();
      setSectionDialog({ mode: "edit", index: i, draft: sections[i] });
    },
    [actions, sections],
  );

  const saveSection = (data: { name: string; startSeg: number; endSeg: number }) => {
    if (!sectionDialog) return;
    // 编辑/删除可能改变区间或索引，先停掉正在进行的段落循环
    if (loopTarget?.kind === "section") {
      actions.stopLoop();
      setLoopTarget(null);
    }
    setSections((prev) => {
      const next =
        sectionDialog.mode === "new"
          ? [...prev, { ...sectionDialog.draft, ...data }]
          : prev.map((s, i) => (i === sectionDialog.index ? { ...s, ...data } : s));
      return next.sort((a, b) => a.startSeg - b.startSeg);
    });
    setSectionDialog(null);
  };

  const deleteSection = () => {
    if (!sectionDialog || sectionDialog.mode !== "edit") return;
    if (loopTarget?.kind === "section") {
      actions.stopLoop();
      setLoopTarget(null);
    }
    setSections((prev) => prev.filter((_, i) => i !== sectionDialog.index));
    setSectionDialog(null);
  };

  // 时间轴拖拽改段落区间（不排序，避免拖动中下标跳动）
  const resizeSection = useCallback((i: number, startSeg: number, endSeg: number) => {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, startSeg, endSeg } : s)));
  }, []);

  // 时间轴框选新建段落
  const createSection = useCallback((startSeg: number, endSeg: number) => {
    setSections((prev) =>
      [...prev, { id: crypto.randomUUID(), name: "自定义段落", startSeg, endSeg }].sort(
        (a, b) => a.startSeg - b.startSeg,
      ),
    );
  }, []);

  const toggleBeatSelection = useCallback((index: number) => {
    setSelectedBeatIndices((current) =>
      current.includes(index)
        ? current.filter((selected) => selected !== index)
        : [...current, index].sort((a, b) => a - b),
    );
  }, []);

  const createSectionFromSelection = useCallback(() => {
    if (selectedBeatIndices.length === 0) return;
    const sorted = [...selectedBeatIndices].sort((a, b) => a - b);
    const isContinuous = sorted.every(
      (index, position) => index === sorted[0] + position,
    );
    if (!isContinuous) return;

    const startSeg = sorted[0];
    const endSeg = sorted[sorted.length - 1];
    setSections((current) =>
      [
        ...current,
        {
          id: crypto.randomUUID(),
          name: `第${current.length + 1}段`,
          startSeg,
          endSeg,
        },
      ].sort((a, b) => a.startSeg - b.startSeg),
    );
    autoDetectTried.current = true;
    setSelectedBeatIndices([]);
    setTab("section");
  }, [selectedBeatIndices]);

  const cancelLoop = useCallback(() => {
    actions.stopLoop();
    setLoopTarget(null);
  }, [actions]);

  // —— 标记 ——
  const addMarker = (data: {
    time: number;
    label: string;
    text: string;
    color: MarkerColor;
  }) => {
    setMarkers((prev) =>
      [...prev, { id: crypto.randomUUID(), ...data }].sort(
        (a, b) => a.time - b.time,
      ),
    );
  };
  const removeMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const toggleDanmaku = useCallback(() => setDanmakuOn((v) => !v), []);

  // Countdown, pre-roll beats, and gray-to-color all meet on count 1.
  const musicStarted = hasMusicStarted(currentTime, musicStart);
  const preRoll = useMemo(
    () => musicStartPreRoll(currentTime, bpm, performanceStart),
    [currentTime, bpm, performanceStart],
  );

  // 循环 5678 倒计时的每拍间隔跟随歌曲 BPM 与当前倍速（慢放时口令也随之放慢，保持同步）。
  useEffect(() => {
    const spb = 60 / bpm;
    actions.setCountInBeatMs((spb / state.playbackRate) * 1000);
  }, [bpm, state.playbackRate, actions]);

  // 循环倒计时（暂停态）优先；否则显示起播 count-in
  const displayCountdown = state.countdown ?? preRoll?.count ?? null;
  const showPreRoll = state.countdown == null && preRoll != null;

  // —— 校准 ——
  const setBpmClamped = useCallback((b: number) => {
    setBpm(Math.max(40, Math.min(240, b)));
    setTempoChanged(true);
  }, []);
  const shiftOffset = useCallback((delta: number) => {
    setOffset((o) => o + delta);
    setTempoChanged(true);
  }, []);
  const setOffsetValue = useCallback((value: number) => {
    setOffset((current) => current + value - (performanceStart ?? current));
    setTempoChanged(true);
  }, [performanceStart]);
  const setDownbeatToNow = useCallback(() => {
    setOffset((current) => current + currentTime - (performanceStart ?? current));
    setTempoChanged(true);
  }, [currentTime, performanceStart]);
  const resetCalibration = useCallback(() => {
    setBpm(defaultAnalysis.bpm);
    setOffset(defaultAnalysis.offset);
    setBeatBase(defaultAnalysis.beats ?? []);
    setBeatBaseBpm(defaultAnalysis.bpm);
    setBeatBaseOffset(defaultAnalysis.offset);
    setTempoChanged(true);
  }, [defaultAnalysis]);

  // 自动保存：播放器数据变化后防抖写入舞蹈库（跳过首次）。
  const onPersistRef = useRef(onPersist);
  useEffect(() => {
    onPersistRef.current = onPersist;
  }, [onPersist]);
  const persistCurrentState = useCallback(() => {
    onPersistRef.current?.({
      bpm,
      offset,
      beats: calibratedBeats.length ? calibratedBeats : undefined,
      ...(musicStart != null ? { musicStart } : {}),
      ...(performanceStart != null ? { performanceStart } : {}),
      tempoChanged,
      markers,
      sections,
      formationChanges,
      formationAudiencePosition,
      duration,
    });
  }, [
    bpm,
    offset,
    calibratedBeats,
    musicStart,
    tempoChanged,
    markers,
    sections,
    formationChanges,
    formationAudiencePosition,
    duration,
  ]);
  const firstPersist = useRef(true);
  useEffect(() => {
    if (firstPersist.current) {
      firstPersist.current = false;
      return;
    }
    const t = setTimeout(persistCurrentState, 600);
    return () => clearTimeout(t);
  }, [persistCurrentState]);

  // 键盘快捷键：Space / ← / →，忽略输入框与任何弹窗
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sectionDialog || exportOpen || formationEditing) return;
      const t = e.target as HTMLElement;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        actions.togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        prevBeat();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        nextBeat();
      } else if (e.code === "KeyD") {
        e.preventDefault();
        toggleDanmaku();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    actions,
    sectionDialog,
    exportOpen,
    formationEditing,
    toggleDanmaku,
    prevBeat,
    nextBeat,
  ]);

  const enterFormationEditor = () => {
    actions.pause();
    setFormationEditing(true);
  };

  const exitFormationEditor = () => {
    actions.pause();
    setFormationEditing(false);
  };

  if (formationEditing) {
    return (
      <FormationEditorPage
        src={src}
        videoRef={videoRef}
        videoProps={videoProps}
        mirrored={state.mirrored}
        isPlaying={state.isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={state.volume}
        muted={state.muted}
        playbackRate={state.playbackRate}
        initialChanges={formationChanges}
        initialAudiencePosition={formationAudiencePosition}
        activeSegmentNumber={activeSegmentNumber}
        activeBeat={activeBeat}
        bpm={bpm}
        offset={performanceStart ?? offset}
        onTogglePlay={actions.togglePlay}
        onSeek={actions.seek}
        onSetVolume={actions.setVolume}
        onToggleMute={actions.toggleMute}
        onSetRate={actions.setPlaybackRate}
        onToggleMirror={actions.toggleMirror}
        onBack={exitFormationEditor}
        onChange={(changes, audiencePosition) => {
          setFormationChanges(changes);
          setFormationAudiencePosition(audiencePosition);
        }}
      />
    );
  }

  return (
    <div className="flex h-full w-full bg-black">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/5 bg-neutral-950 px-4">
          <button
            type="button"
            onClick={() => {
              persistCurrentState();
              onReset();
            }}
            title="返回首页"
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </button>
          <span
            className="min-w-0 flex-1 truncate text-xs text-neutral-500"
            title={fileName}
          >
            {fileName}
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

        <VideoStage
          src={src}
          videoRef={videoRef}
          videoProps={videoProps}
          mirrored={state.mirrored}
          activeBeat={showPreRoll ? preRoll.count - 1 : activeBeat}
          markers={markers}
          currentTime={currentTime}
          danmakuOn={danmakuOn}
          countdown={displayCountdown}
          vizConfig={activeVizConfig}
          beatPhase={showPreRoll ? preRoll.phase : beatViz.phase}
          isDownbeat={showPreRoll ? false : beatViz.isDownbeat}
          beatActive={showPreRoll || beatViz.active}
          activeSegmentNumber={activeSegmentNumber}
          isPlaying={state.isPlaying}
          musicStarted={musicStarted}
          preRoll={showPreRoll}
          secondsPerBeat={secondsPerBeat}
          onTogglePlay={actions.togglePlay}
          onRemoveMarker={removeMarker}
          formationOpen={formationOpen}
          formationChanges={formationChanges}
          formationAudiencePosition={formationAudiencePosition}
          onEditFormation={enterFormationEditor}
          onDismissFormation={() => setFormationOpen(false)}
        />

        {/* 段落 tab：底部出现可拖拽段落时间轴（替代普通进度条） */}
        {tab === "section" && (
          <SectionTimeline
            segments={segments}
            sections={sections}
            duration={duration}
            currentTime={currentTime}
            activeSectionIndex={activeSectionIndex}
            sectionLoopKey={sectionLoopKey}
            onSeek={actions.seek}
            onToggleSectionLoop={toggleSectionLoop}
            onResizeSection={resizeSection}
            onCreateSection={createSection}
            onStopLoop={cancelLoop}
          />
        )}

        <Controls
          isPlaying={state.isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={state.volume}
          muted={state.muted}
          playbackRate={state.playbackRate}
          mirrored={state.mirrored}
          formationOpen={formationOpen}
          danmakuOn={danmakuOn}
          showProgress={tab === "beat"}
          vizConfig={activeVizConfig}
          onVizConfigChange={setVizConfig}
          onTogglePlay={actions.togglePlay}
          onSeek={actions.seek}
          onPrevBeat={prevBeat}
          onNextBeat={nextBeat}
          onSetVolume={actions.setVolume}
          onToggleMute={actions.toggleMute}
          onSetRate={actions.setPlaybackRate}
          onToggleMirror={actions.toggleMirror}
          onToggleFormation={() => setFormationOpen((open) => !open)}
          onToggleDanmaku={toggleDanmaku}
          onOpenHints={actions.pause}
          onAddMarker={addMarker}
          beatLoopName={
            beatLoopKey != null && segments[beatLoopKey]
              ? `8拍 ${segments[beatLoopKey].num}`
              : null
          }
          onStopLoop={cancelLoop}
        />

        <AnimatePresence>
          {sectionDialog && (
            <SectionDialog
              section={sectionDialog.draft}
              isNew={sectionDialog.mode === "new"}
              segCount={segments.length}
              currentBeatIndex={activeIndex >= 0 ? activeIndex : 0}
              onSave={saveSection}
              onDelete={deleteSection}
              onClose={() => setSectionDialog(null)}
            />
          )}
        </AnimatePresence>

        {exportOpen && (
          <ExportDialog
            src={src}
            name={fileName}
            bpm={bpm}
            offset={performanceStart ?? offset}
            beats={presentationBeats}
            musicStart={musicStart}
            countInStart={performanceStart}
            markers={markers}
            formationChanges={formationChanges}
            formationAudiencePosition={formationAudiencePosition}
            vizConfig={activeVizConfig}
            mirrorEnabled={state.mirrored}
            formationEnabled={formationOpen}
            markersEnabled={danmakuOn}
            onClose={() => setExportOpen(false)}
          />
        )}
      </div>

      {/* 右：分段侧栏（八拍 / 段落） */}
      <SegmentSidebar
        tab={tab}
        onTabChange={setTab}
        calibrating={calibOpen}
        onToggleCalibration={toggleCalibration}
        bpm={bpm}
        offset={performanceStart ?? offset}
        currentCount={activeBeat >= 0 ? activeBeat + 1 : 0}
        onSetBpm={setBpmClamped}
        onSetOffset={setOffsetValue}
        onShiftOffset={shiftOffset}
        onSetDownbeat={setDownbeatToNow}
        onResetCalibration={resetCalibration}
        segments={segments}
        markers={markers}
        generator={generator}
        activeIndex={activeIndex}
        beatLoopKey={beatLoopKey}
        onJump={playSegmentWithCountIn}
        onToggleBeatLoop={toggleBeatLoop}
        selectedBeatIndices={selectedBeatIndices}
        onToggleBeatSelection={toggleBeatSelection}
        onCreateSectionFromSelection={createSectionFromSelection}
        sections={sections}
        activeSectionIndex={activeSectionIndex}
        sectionLoopKey={sectionLoopKey}
        detectingSections={detecting}
        onJumpSection={jumpSection}
        onToggleSectionLoop={toggleSectionLoop}
        onEditSection={openEditSection}
        onAddSection={openAddSection}
      />
    </div>
  );
}
