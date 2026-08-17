"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Home, type WorkspaceMode } from "@/components/Home";
import { AnalyzingScreen } from "@/components/AnalyzingScreen";
import { Player } from "@/components/Player";
import { ExportDialog } from "@/components/ExportDialog";
import { PerformingWorkspace } from "@/components/PerformingWorkspace";
import { MotionAnalyzer } from "@/features/motion-analyzer/MotionAnalyzer";
import {
  analyzeAudio,
  type AnalyzeStage,
} from "@/lib/beatDetection";
import { ThumbnailGenerator } from "@/lib/thumbnailGenerator";
import {
  alignBeatGridToMusicStart,
  calibrateBeatGrid,
  resolvePerformanceStart,
} from "@/lib/segments";
import {
  deleteDance,
  getDanceBlob,
  listDances,
  saveDance,
  updateDanceMeta,
  DanceStoreTimeoutError,
} from "@/lib/danceStore";
import {
  deletePerformingProject,
  getPerformingProjectMedia,
  listPerformingProjects,
  savePerformingProjectWithMedia,
  updatePerformingProject,
} from "@/lib/performingStore";
import type {
  DanceSection,
  FormationAudiencePosition,
  FormationChange,
  Marker,
  SavedDanceMeta,
  PerformingProject,
} from "@/lib/types";

type Phase =
  | "home"
  | "analyzing"
  | "player"
  | "performing"
  | "motion-analyzer";

interface CurrentDance {
  id: string;
  url: string;
  meta: SavedDanceMeta;
  openCalibrationOnEnter: boolean;
}

interface CurrentPerformingProject {
  project: PerformingProject;
  url: string;
}

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("home");
  const [mode, setMode] = useState<WorkspaceMode>("learning");
  const [dances, setDances] = useState<SavedDanceMeta[]>([]);
  const [libLoading, setLibLoading] = useState(true);
  const [stage, setStage] = useState<AnalyzeStage>("decode");
  const [pendingName, setPendingName] = useState("");
  const [current, setCurrent] = useState<CurrentDance | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [performingProjects, setPerformingProjects] = useState<PerformingProject[]>([]);
  const [performingLoading, setPerformingLoading] = useState(true);
  const [performingError, setPerformingError] = useState<string | null>(null);
  const [performingOpeningId, setPerformingOpeningId] = useState<string | null>(null);
  const [creatingPerformanceId, setCreatingPerformanceId] = useState<
    string | null
  >(null);
  const [creatingLearningId, setCreatingLearningId] = useState<string | null>(
    null,
  );
  const [currentPerforming, setCurrentPerforming] =
    useState<CurrentPerformingProject | null>(null);
  const [exportTarget, setExportTarget] = useState<{ url: string; meta: SavedDanceMeta } | null>(null);
  const pendingSavesRef = useRef(new Map<string, Promise<void>>());
  const performingSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const performingSaveTimerRef = useRef<number | null>(null);
  const latestPerformingProjectRef = useRef<PerformingProject | null>(null);
  const creatingPerformanceRef = useRef<string | null>(null);
  const creatingLearningRef = useRef<string | null>(null);

  const exportUrlRef = useRef<string | null>(null);
  const closeExport = useCallback(() => {
    if (exportUrlRef.current) {
      URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
    }
    setExportTarget(null);
  }, []);

  const urlRef = useRef<string | null>(null);
  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);
  useEffect(() => () => revoke(), [revoke]);

  useEffect(() => {
    listDances()
      .then(setDances)
      .catch(() => {})
      .finally(() => setLibLoading(false));
  }, []);

  useEffect(() => {
    listPerformingProjects()
      .then(setPerformingProjects)
      .catch((error) => {
        console.error("Failed to load Performing projects.", error);
        setPerformingError("无法加载本地演出项目。");
      })
      .finally(() => setPerformingLoading(false));
  }, []);

  const handleDeletePerformingProject = useCallback(async (id: string) => {
    setPerformingError(null);
    try {
      if (latestPerformingProjectRef.current?.id === id) {
        latestPerformingProjectRef.current = null;
        if (performingSaveTimerRef.current != null) {
          window.clearTimeout(performingSaveTimerRef.current);
          performingSaveTimerRef.current = null;
        }
      }
      await performingSaveQueueRef.current;
      await deletePerformingProject(id);
      setPerformingProjects((currentProjects) =>
        currentProjects.filter((project) => project.id !== id),
      );
    } catch (error) {
      console.error("Failed to delete the Performing project.", error);
      setPerformingError("无法删除该演出项目，请重试。");
      throw error;
    }
  }, []);

  const handlePerformingProjectChange = useCallback(
    (project: PerformingProject) => {
      setCurrentPerforming((currentProject) =>
        currentProject?.project.id === project.id
          ? { ...currentProject, project }
          : currentProject,
      );
      setPerformingProjects((projects) => [
        project,
        ...projects.filter((item) => item.id !== project.id),
      ]);
      latestPerformingProjectRef.current = project;
      if (performingSaveTimerRef.current != null) {
        window.clearTimeout(performingSaveTimerRef.current);
      }
      performingSaveTimerRef.current = window.setTimeout(() => {
        performingSaveTimerRef.current = null;
        const latestProject = latestPerformingProjectRef.current;
        if (!latestProject) return;
        const write = performingSaveQueueRef.current.then(() =>
          updatePerformingProject(latestProject),
        );
        performingSaveQueueRef.current = write.catch((error) => {
          console.error("Failed to update the Performing project.", error);
          setPerformingError("最近的演出项目修改未能保存。");
        });
      }, 350);
    },
    [],
  );

  const handleOpenPerformingProject = useCallback(
    async (id: string) => {
      const project = performingProjects.find((item) => item.id === id);
      if (!project) return;
      setPerformingOpeningId(id);
      setPerformingError(null);
      try {
        const media = await getPerformingProjectMedia(id);
        if (!media) {
          setPerformingError("该项目缺少主视频，请重新上传后继续。");
          return;
        }
        let resolvedProject = project;
        if (project.analysisEngine == null && project.beats == null) {
          try {
            const analysis = await analyzeAudio(media);
            resolvedProject = {
              ...project,
              bpm: analysis.bpm,
              offset: analysis.offset,
              musicStart: analysis.musicStart,
              beats: analysis.beats,
              analysisEngine: analysis.engine,
              analysisConfidence: analysis.confidence,
              updatedAt: Date.now(),
            };
            await updatePerformingProject(resolvedProject);
            setPerformingProjects((projects) =>
              projects.map((item) =>
                item.id === resolvedProject.id ? resolvedProject : item,
              ),
            );
          } catch (error) {
            console.error(
              "Failed to migrate the Performing rhythm analysis.",
              error,
            );
            setPerformingError(
              "项目已打开，但旧节拍结果未能重新分析，请稍后重试。",
            );
          }
        }
        revoke();
        const url = URL.createObjectURL(media);
        urlRef.current = url;
        setCurrentPerforming({ project: resolvedProject, url });
        setPhase("performing");
      } catch (error) {
        console.error("Failed to open the Performing project.", error);
        setPerformingError("无法打开该演出项目。");
      } finally {
        setPerformingOpeningId(null);
      }
    },
    [performingProjects, revoke],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const selectedMode = mode;
      revoke();
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      setPendingName(file.name);
      setStage("decode");
      setPhase("analyzing");

      let bpm = 120;
      let offset = 0;
      let musicStart: number | null = null;
      let analysisResult: Awaited<ReturnType<typeof analyzeAudio>> | null = null;
      try {
        const res = await analyzeAudio(file, setStage);
        analysisResult = res;
        bpm = res.bpm;
        offset = res.offset;
        musicStart = res.musicStart;
      } catch {
        // Continue with safe defaults when the audio track cannot be decoded.
      }

      let cover: string | null = null;
      let duration = 0;
      try {
        const gen = new ThumbnailGenerator(url, 320, 180);
        duration = await gen.getDuration();
        const coverTime = Math.min(Math.max(offset, 0.5), duration > 0 ? duration * 0.5 : 1);
        cover = await gen.request(coverTime);
        gen.destroy();
      } catch {
        // A missing thumbnail does not prevent the video from being used.
      }

      const now = Date.now();
      if (selectedMode === "performing") {
        const project: PerformingProject = {
          id: crypto.randomUUID(),
          version: 1,
          name: file.name.replace(/\.[^.]+$/, "") || file.name,
          createdAt: now,
          updatedAt: now,
          status: "draft",
          sourceName: file.name,
          duration,
          size: file.size,
          type: file.type,
          cover,
          bpm,
          offset,
          musicStart,
          beats: analysisResult?.beats,
          analysisEngine: analysisResult?.engine,
          analysisConfidence: analysisResult?.confidence,
        };
        setCurrentPerforming({ project, url });
        setPhase("performing");
        void savePerformingProjectWithMedia(project, file)
          .then(() => {
            setPerformingProjects((projects) => [
              project,
              ...projects.filter((item) => item.id !== project.id),
            ]);
          })
          .catch((error) => {
            console.error("Failed to save the Performing project.", error);
            setPerformingError(
              "项目已打开，但未能保存。请检查浏览器存储空间。",
            );
          });
        return;
      }

      const meta: SavedDanceMeta = {
        id: crypto.randomUUID(),
        name: file.name,
        createdAt: now,
        updatedAt: now,
        bpm,
        offset,
        ...(analysisResult
          ? {
              detectedBpm: bpm,
              detectedOffset: offset,
              detectedBeats: analysisResult.beats,
              analysisBeats: analysisResult.beats,
              analysisEngine: analysisResult.engine,
              analysisConfidence: analysisResult.confidence,
            }
          : {}),
        musicStart,
        performanceStart: resolvePerformanceStart(
          analysisResult?.beats,
          bpm,
          offset,
          musicStart,
        ),
        duration,
        size: file.size,
        type: file.type,
        cover,
        markers: [],
        formationChanges: [],
        formationAudiencePosition: "bottom",
      };

      setCurrent({ id: meta.id, url, meta, openCalibrationOnEnter: true });
      setPhase("player");

      // Persist independently so a large IndexedDB write cannot hold the analysis screen open.
      const pendingSave = saveDance(meta, file)
        .then(() => {
          setDances((prev) => [meta, ...prev.filter((d) => d.id !== meta.id)]);
        })
        .catch((error) => {
          console.error("Failed to save the dance.", error);
          setLibraryError(
            `“${meta.name}”可以播放，但未能保存到本地舞蹈库。请检查浏览器存储空间。`,
          );
          throw error;
        })
        .finally(() => {
          pendingSavesRef.current.delete(meta.id);
        });
      pendingSavesRef.current.set(meta.id, pendingSave);
      void pendingSave.catch(() => {});
    },
    [mode, revoke],
  );

  const handleOpen = useCallback(
    async (id: string) => {
      const meta = dances.find((d) => d.id === id);
      if (!meta) {
        setLibraryError("找不到该舞蹈的记录，请刷新页面后重试。");
        return;
      }

      setOpeningId(id);
      setLibraryError(null);
      try {
        const blob = await getDanceBlob(id);
        if (!blob) {
          setLibraryError(
            `“${meta.name}”的视频文件已不在本地存储中，请重新上传原视频。`,
          );
          return;
        }
        let resolvedMeta = meta;
        const regressedAnalysis =
          meta.analysisEngine == null &&
          meta.detectedBeats == null &&
          meta.analysisBeats == null &&
          meta.detectedBpm != null &&
          meta.detectedOffset != null;
        if (
          meta.musicStart == null ||
          meta.detectedBpm == null ||
          meta.detectedOffset == null ||
          meta.analysisEngine == null
        ) {
          try {
            const analysis = await analyzeAudio(blob);
            const preservedCalibration =
              regressedAnalysis &&
              (Math.abs(meta.bpm - (meta.detectedBpm ?? meta.bpm)) > 0.001 ||
                Math.abs(meta.offset - (meta.detectedOffset ?? meta.offset)) >
                  0.001);
            const resolvedBpm = preservedCalibration ? meta.bpm : analysis.bpm;
            const resolvedOffset = preservedCalibration
              ? meta.offset
              : analysis.offset;
            const migratedBeats = calibrateBeatGrid(
              analysis.beats,
              analysis.bpm,
              analysis.offset,
              resolvedBpm,
              resolvedOffset,
            );
            const analysisPatch: Partial<SavedDanceMeta> = {
              ...(regressedAnalysis && !preservedCalibration
                ? { bpm: analysis.bpm, offset: analysis.offset }
                : {}),
              detectedBpm:
                regressedAnalysis || meta.detectedBpm == null
                  ? analysis.bpm
                  : meta.detectedBpm,
              detectedOffset:
                regressedAnalysis || meta.detectedOffset == null
                  ? analysis.offset
                  : meta.detectedOffset,
              detectedBeats:
                regressedAnalysis || meta.detectedBeats == null
                  ? analysis.beats
                  : meta.detectedBeats,
              analysisEngine: analysis.engine,
              analysisConfidence: analysis.confidence,
              analysisBeats:
                regressedAnalysis || meta.analysisBeats == null
                  ? migratedBeats.length
                    ? migratedBeats
                    : undefined
                  : meta.analysisBeats,
              updatedAt: Date.now(),
              ...(meta.musicStart == null
                ? { musicStart: analysis.musicStart }
                : {}),
            };
            resolvedMeta = {
              ...meta,
              ...analysisPatch,
            };
            await updateDanceMeta(id, analysisPatch);
            setDances((prev) =>
              prev.map((dance) => (dance.id === id ? resolvedMeta : dance)),
            );
          } catch (error) {
            console.error("Failed to detect the saved dance audio onset.", error);
          }
        }
        revoke();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setCurrent({
          id,
          url,
          meta: resolvedMeta,
          openCalibrationOnEnter: false,
        });
        setPhase("player");
      } catch (error) {
        console.error("Failed to open the saved dance.", error);
        setLibraryError(
          error instanceof DanceStoreTimeoutError
            ? "读取本地视频超时。该文件可能已损坏，请重新上传原视频。"
            : "读取本地视频失败，请刷新页面后重试。",
        );
      } finally {
        setOpeningId(null);
      }
    },
    [dances, revoke],
  );

  const handleDelete = useCallback(async (id: string) => {
    await deleteDance(id).catch(() => {});
    setDances((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleExport = useCallback(
    async (id: string) => {
      const meta = dances.find((d) => d.id === id);
      if (!meta) return;
      const blob = await getDanceBlob(id).catch(() => null);
      if (!blob) return;
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
      const url = URL.createObjectURL(blob);
      exportUrlRef.current = url;
      setExportTarget({ url, meta });
    },
    [dances],
  );

  const handleCreatePerformance = useCallback(
    async (id: string) => {
      if (creatingPerformanceRef.current != null) return;
      const meta = dances.find((dance) => dance.id === id);
      if (!meta) return;

      creatingPerformanceRef.current = id;
      setCreatingPerformanceId(id);
      setLibraryError(null);
      setPerformingError(null);
      try {
        const blob = await getDanceBlob(id);
        if (!blob) {
          throw new Error("The saved Learning video is missing.");
        }

        const now = Date.now();
        const beats = meta.analysisBeats ?? meta.detectedBeats;
        const project: PerformingProject = {
          id: crypto.randomUUID(),
          version: 1,
          name: meta.name.replace(/\.[^.]+$/, "") || meta.name,
          createdAt: now,
          updatedAt: now,
          status: "draft",
          sourceName: meta.name,
          duration: meta.duration,
          size: meta.size || blob.size,
          type: meta.type || blob.type,
          cover: meta.cover,
          bpm: meta.bpm,
          offset: meta.offset,
          musicStart: meta.musicStart ?? null,
          performanceStart: meta.performanceStart ?? null,
          beats,
          analysisEngine: meta.analysisEngine,
          analysisConfidence: meta.analysisConfidence,
          learningProjectId: meta.id,
        };

        await savePerformingProjectWithMedia(project, blob);
        revoke();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPerformingProjects((projects) => [
          project,
          ...projects.filter((item) => item.id !== project.id),
        ]);
        setCurrentPerforming({ project, url });
        setMode("performing");
        setPhase("performing");
      } catch (error) {
        console.error(
          "Failed to create a Performing project from Learning.",
          error,
        );
        setLibraryError(
          "无法从该练习视频创建演出项目，请确认本地视频仍然可用。",
        );
      } finally {
        creatingPerformanceRef.current = null;
        setCreatingPerformanceId(null);
      }
    },
    [dances, revoke],
  );

  const handleCreateLearning = useCallback(
    async (id: string) => {
      if (creatingLearningRef.current != null) return;
      const project = performingProjects.find((item) => item.id === id);
      if (!project) return;

      creatingLearningRef.current = id;
      setCreatingLearningId(id);
      setLibraryError(null);
      setPerformingError(null);
      try {
        const blob = await getPerformingProjectMedia(id);
        if (!blob) {
          throw new Error("The saved Performing video is missing.");
        }

        const now = Date.now();
        const bpm = project.bpm ?? 120;
        const offset = project.offset ?? 0;
        const meta: SavedDanceMeta = {
          id: crypto.randomUUID(),
          name: project.sourceName ?? project.name,
          createdAt: now,
          updatedAt: now,
          bpm,
          offset,
          detectedBpm: bpm,
          detectedOffset: offset,
          detectedBeats: project.beats,
          analysisBeats: project.beats,
          analysisEngine: project.analysisEngine,
          analysisConfidence: project.analysisConfidence,
          musicStart: project.musicStart ?? null,
          performanceStart: project.performanceStart ?? null,
          duration: project.duration ?? 0,
          size: project.size ?? blob.size,
          type: project.type ?? blob.type,
          cover: project.cover ?? null,
          markers: [],
          sections: [],
          formationChanges: [],
          formationAudiencePosition: "bottom",
        };
        const linkedProject: PerformingProject = {
          ...project,
          learningProjectId: meta.id,
          updatedAt: now,
        };

        await saveDance(meta, blob);
        try {
          await updatePerformingProject(linkedProject);
        } catch (error) {
          console.error("Failed to link the generated Learning project.", error);
          setLibraryError("练习项目已创建，但项目关联状态未能保存。");
        }

        revoke();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setDances((currentDances) => [
          meta,
          ...currentDances.filter((dance) => dance.id !== meta.id),
        ]);
        setPerformingProjects((projects) =>
          projects.map((item) =>
            item.id === linkedProject.id ? linkedProject : item,
          ),
        );
        setCurrent({
          id: meta.id,
          url,
          meta,
          openCalibrationOnEnter: false,
        });
        setMode("learning");
        setPhase("player");
      } catch (error) {
        console.error(
          "Failed to create a Learning project from Performing.",
          error,
        );
        setPerformingError(
          "无法从该演出视频创建练习项目，请确认本地主视频仍然可用。",
        );
      } finally {
        creatingLearningRef.current = null;
        setCreatingLearningId(null);
      }
    },
    [performingProjects, revoke],
  );

  const handlePersist = useCallback(
    (data: {
      bpm: number;
      offset: number;
      beats?: SavedDanceMeta["analysisBeats"];
      musicStart?: number;
      performanceStart?: number;
      tempoChanged: boolean;
      markers: Marker[];
      sections: DanceSection[];
      formationChanges: FormationChange[];
      formationAudiencePosition: FormationAudiencePosition;
      duration: number;
    }) => {
      setCurrent((cur) => {
        if (!cur) return cur;
        const { tempoChanged, beats, ...persistedData } = data;
        const patch = {
          ...persistedData,
          ...(tempoChanged
            ? {
                analysisBeats: beats,
              }
            : {}),
          updatedAt: Date.now(),
        };
        const pendingSave = pendingSavesRef.current.get(cur.id);
        void (pendingSave ?? Promise.resolve())
          .then(() => updateDanceMeta(cur.id, patch))
          .catch((error) => {
            console.error("Failed to update dance metadata.", error);
          });
        const updated = { ...cur.meta, ...patch };
        setDances((prev) => {
          if (!prev.some((dance) => dance.id === cur.id)) return prev;
          return [updated, ...prev.filter((dance) => dance.id !== cur.id)].sort(
            (a, b) => b.updatedAt - a.updatedAt,
          );
        });
        return { ...cur, meta: updated };
      });
    },
    [],
  );

  const backToHome = useCallback(() => {
    revoke();
    setCurrent(null);
    setCurrentPerforming(null);
    setPhase("home");
  }, [revoke]);

  if (phase === "analyzing") {
    return <AnalyzingScreen stage={stage} fileName={pendingName} />;
  }
  if (phase === "motion-analyzer") {
    return <MotionAnalyzer onBack={() => setPhase("home")} />;
  }
  if (phase === "player" && current) {
    return (
      <Player
        key={current.id}
        src={current.url}
        fileName={current.meta.name}
        analysis={{
          bpm: current.meta.bpm,
          offset: current.meta.offset,
          musicStart: current.meta.musicStart ?? null,
          beats:
            current.meta.analysisBeats ?? current.meta.detectedBeats,
          engine: current.meta.analysisEngine,
          confidence: current.meta.analysisConfidence,
        }}
        initialPerformanceStart={current.meta.performanceStart ?? null}
        defaultAnalysis={{
          bpm: current.meta.detectedBpm ?? current.meta.bpm,
          offset:
            current.meta.detectedOffset ??
            current.meta.offset,
          beats: current.meta.detectedBeats,
          engine: current.meta.analysisEngine,
          confidence: current.meta.analysisConfidence,
        }}
        initialCalibrationOpen={current.openCalibrationOnEnter}
        initialMarkers={current.meta.markers}
        initialSections={current.meta.sections}
        initialFormationChanges={current.meta.formationChanges}
        initialFormationAudiencePosition={
          current.meta.formationAudiencePosition
        }
        onReset={backToHome}
        onPersist={handlePersist}
      />
    );
  }
  if (phase === "performing" && currentPerforming) {
    return (
      <PerformingWorkspace
        key={currentPerforming.project.id}
        project={currentPerforming.project}
        src={currentPerforming.url}
        onBack={backToHome}
        onProjectChange={handlePerformingProjectChange}
      />
    );
  }
  const exportBpm = exportTarget ? exportTarget.meta.bpm : 0;
  const exportOffset = exportTarget ? exportTarget.meta.offset : 0;
  const exportRawBeats = exportTarget
    ? exportTarget.meta.analysisBeats ??
      exportTarget.meta.detectedBeats ??
      []
    : [];
  const exportBeats = alignBeatGridToMusicStart(
    exportRawBeats,
    exportTarget?.meta.performanceStart ??
      exportTarget?.meta.musicStart ??
      null,
  );
  const exportPerformanceStart =
    exportTarget?.meta.performanceStart ??
    (exportTarget
      ? resolvePerformanceStart(
          exportBeats,
          exportBpm,
          exportOffset,
          exportTarget.meta.musicStart ?? null,
        )
      : null);

  return (
    <>
      <Home
        dances={dances}
        loading={libLoading}
        onFile={handleFile}
        onOpen={handleOpen}
        onDelete={handleDelete}
        onExport={handleExport}
        onCreatePerformance={handleCreatePerformance}
        onCreateLearning={handleCreateLearning}
        openingId={openingId}
        creatingPerformanceId={creatingPerformanceId}
        creatingLearningId={creatingLearningId}
        libraryError={libraryError ?? performingError}
        mode={mode}
        onModeChange={setMode}
        performingProjects={performingProjects}
        performingLoading={performingLoading}
        performingOpeningId={performingOpeningId}
        onOpenPerformingProject={handleOpenPerformingProject}
        onDeletePerformingProject={(id) => void handleDeletePerformingProject(id)}
        onOpenMotionAnalyzer={() => setPhase("motion-analyzer")}
      />
      {exportTarget && (
        <ExportDialog
          src={exportTarget.url}
          name={exportTarget.meta.name}
          bpm={exportBpm}
          offset={exportOffset}
          beats={exportBeats}
          musicStart={exportTarget.meta.musicStart ?? null}
          countInStart={exportPerformanceStart}
          markers={exportTarget.meta.markers}
          formationChanges={exportTarget.meta.formationChanges ?? []}
          formationAudiencePosition={
            exportTarget.meta.formationAudiencePosition ?? "bottom"
          }
          vizConfig={{
            countPoints: true,
            countPointStyle: "tiles",
            countPointPosition: "left",
            pulse: false,
            breath: false,
          }}
          onClose={closeExport}
        />
      )}
    </>
  );
}
