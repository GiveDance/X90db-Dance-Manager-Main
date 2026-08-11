"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Home } from "@/components/Home";
import { AnalyzingScreen } from "@/components/AnalyzingScreen";
import { Player } from "@/components/Player";
import { ExportDialog } from "@/components/ExportDialog";
import {
  analyzeAudio,
  type AnalyzeStage,
} from "@/lib/beatDetection";
import { ThumbnailGenerator } from "@/lib/thumbnailGenerator";
import {
  deleteDance,
  getDanceBlob,
  listDances,
  saveDance,
  updateDanceMeta,
  DanceStoreTimeoutError,
} from "@/lib/danceStore";
import type { DanceSection, Marker, SavedDanceMeta } from "@/lib/types";

type Phase = "home" | "analyzing" | "player";

interface CurrentDance {
  id: string;
  url: string;
  meta: SavedDanceMeta;
  openCalibrationOnEnter: boolean;
}

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("home");
  const [dances, setDances] = useState<SavedDanceMeta[]>([]);
  const [libLoading, setLibLoading] = useState(true);
  const [stage, setStage] = useState<AnalyzeStage>("decode");
  const [pendingName, setPendingName] = useState("");
  const [current, setCurrent] = useState<CurrentDance | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<{ url: string; meta: SavedDanceMeta } | null>(null);
  const pendingSavesRef = useRef(new Map<string, Promise<void>>());

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

  const handleFile = useCallback(
    async (file: File) => {
      revoke();
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      setPendingName(file.name);
      setStage("decode");
      setPhase("analyzing");

      let bpm = 120;
      let offset = 0;
      let musicStart = 0;
      try {
        const res = await analyzeAudio(file, setStage);
        bpm = res.bpm;
        offset = res.offset;
        musicStart = res.musicStart ?? 0;
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
      const meta: SavedDanceMeta = {
        id: crypto.randomUUID(),
        name: file.name,
        createdAt: now,
        updatedAt: now,
        bpm,
        offset,
        analysisBpm: bpm,
        analysisOffset: offset,
        detectedBpm: bpm,
        detectedOffset: offset,
        musicStart,
        duration,
        size: file.size,
        type: file.type,
        cover,
        markers: [],
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
    [revoke],
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
        if (
          meta.musicStart == null ||
          meta.detectedBpm == null ||
          meta.detectedOffset == null
        ) {
          try {
            const analysis = await analyzeAudio(blob);
            const analysisPatch: Partial<SavedDanceMeta> = {
              detectedBpm: meta.detectedBpm ?? analysis.bpm,
              detectedOffset: meta.detectedOffset ?? analysis.offset,
              updatedAt: Date.now(),
              ...(meta.musicStart == null
                ? {
                    bpm: analysis.bpm,
                    offset: analysis.offset,
                    analysisBpm: analysis.bpm,
                    analysisOffset: analysis.offset,
                    musicStart: analysis.musicStart,
                  }
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

  const handlePersist = useCallback(
    (data: {
      bpm: number;
      offset: number;
      musicStart?: number;
      tempoChanged: boolean;
      markers: Marker[];
      sections: DanceSection[];
      duration: number;
    }) => {
      setCurrent((cur) => {
        if (!cur) return cur;
        const { tempoChanged, ...persistedData } = data;
        const patch = {
          ...persistedData,
          ...(tempoChanged
            ? {
                analysisBpm: data.bpm,
                analysisOffset: data.offset,
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
    setPhase("home");
  }, [revoke]);

  if (phase === "analyzing") {
    return <AnalyzingScreen stage={stage} fileName={pendingName} />;
  }
  if (phase === "player" && current) {
    return (
      <Player
        key={current.id}
        src={current.url}
        fileName={current.meta.name}
        analysis={{
          bpm: current.meta.analysisBpm ?? current.meta.bpm,
          offset: current.meta.analysisOffset ?? current.meta.offset,
          musicStart: current.meta.musicStart ?? null,
        }}
        defaultAnalysis={{
          bpm: current.meta.detectedBpm ?? current.meta.analysisBpm ?? current.meta.bpm,
          offset:
            current.meta.detectedOffset ??
            current.meta.analysisOffset ??
            current.meta.offset,
        }}
        initialCalibrationOpen={current.openCalibrationOnEnter}
        initialMarkers={current.meta.markers}
        initialSections={current.meta.sections}
        onReset={backToHome}
        onPersist={handlePersist}
      />
    );
  }
  return (
    <>
      <Home
        dances={dances}
        loading={libLoading}
        onFile={handleFile}
        onOpen={handleOpen}
        onDelete={handleDelete}
        onExport={handleExport}
        openingId={openingId}
        libraryError={libraryError}
      />
      {exportTarget && (
        <ExportDialog
          src={exportTarget.url}
          name={exportTarget.meta.name}
          bpm={exportTarget.meta.analysisBpm ?? exportTarget.meta.bpm}
          offset={exportTarget.meta.analysisOffset ?? exportTarget.meta.offset}
          musicStart={exportTarget.meta.musicStart ?? null}
          markers={exportTarget.meta.markers}
          vizModes={{ dots: false, pulse: false, breath: false, tiles: true }}
          onClose={closeExport}
        />
      )}
    </>
  );
}
