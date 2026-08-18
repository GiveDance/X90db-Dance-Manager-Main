"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Film,
  Loader2,
  Music2,
  X,
} from "lucide-react";
import {
  canExportPerforming,
  exportPerformingVideo,
  PerformingExportAbortedError,
  type PerformingExportResolution,
  type PerformingExportVisibility,
} from "@/lib/performingExport";
import type { PerformingProject } from "@/lib/types";

interface PerformingExportDialogProps {
  project: PerformingProject;
  src: string;
  beats: number[];
  countdownBeats: number[];
  mirrored: boolean;
  visibility: PerformingExportVisibility;
  onClose: () => void;
}

type ExportStatus = "idle" | "exporting" | "done" | "error";

function baseName(name: string) {
  return name.replace(/\.[^/.]+$/, "") || "performance";
}

export function PerformingExportDialog({
  project,
  src,
  beats,
  countdownBeats,
  mirrored,
  visibility,
  onClose,
}: PerformingExportDialogProps) {
  const [resolution, setResolution] =
    useState<PerformingExportResolution>("1080p");
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    ext: "mp4" | "webm";
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const downloadUrlRef = useRef<string | null>(null);
  const supported = canExportPerforming();

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current);
      }
    },
    [],
  );

  const download = (blob: Blob, ext: string) => {
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    const url = URL.createObjectURL(blob);
    downloadUrlRef.current = url;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${baseName(project.name)}-performing.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const startExport = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("exporting");
    setProgress(0);
    setResult(null);
    setError("");
    try {
      const exported = await exportPerformingVideo({
        project,
        src,
        beats,
        countdownBeats,
        mirrored,
        visibility,
        resolution,
        signal: controller.signal,
        onProgress: setProgress,
      });
      download(exported.blob, exported.ext);
      setResult({
        ext: exported.ext,
        width: exported.width,
        height: exported.height,
      });
      setStatus("done");
    } catch (exportError) {
      if (exportError instanceof PerformingExportAbortedError) {
        setStatus("idle");
        return;
      }
      console.error("Performing export failed.", exportError);
      const message =
        exportError instanceof Error ? exportError.message : "";
      if (message.startsWith("CLIP_MEDIA_MISSING")) {
        setError("有素材文件已从本地存储中丢失，请重新添加该素材后再导出。");
      } else if (
        message === "MEDIA_LOAD_FAILED" ||
        message === "SOURCE_PLAYBACK_FAILED"
      ) {
        setError("当前浏览器无法解码项目中的某个视频素材。");
      } else if (message === "AUDIO_CAPTURE_UNAVAILABLE") {
        setError("无法读取项目主音乐轨，已停止导出以避免生成无声视频。");
      } else if (message === "SOURCE_AUDIO_MISSING") {
        setError("项目主视频不包含音轨，无法按当前设置导出。");
      } else {
        setError("导出失败。请使用最新版 Chrome 或 Edge，并确认素材可以正常播放。");
      }
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  };

  const exporting = status === "exporting";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      onClick={exporting ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="performing-export-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2
              id="performing-export-title"
              className="text-sm font-semibold text-white"
            >
              导出 Performing 视频
            </h2>
            <p className="mt-1 text-[11px] text-neutral-500">
              烧录当前编排、舞台模板和节拍信号
            </p>
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={onClose}
            aria-label="关闭导出"
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!supported ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-200">
              当前浏览器不支持本地视频录制，请使用最新版 Chrome 或 Edge。
            </div>
          ) : (
            <>
              <div>
                <div className="mb-2 text-[11px] font-medium text-neutral-400">
                  导出清晰度
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["1080p", "最高 1920 × 1080"],
                      ["720p", "最高 1280 × 720"],
                    ] as const
                  ).map(([value, description]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={exporting}
                      onClick={() => setResolution(value)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        resolution === value
                          ? "border-violet-400/45 bg-violet-400/10"
                          : "border-white/10 bg-white/[0.025] hover:bg-white/[0.045]"
                      } disabled:opacity-50`}
                    >
                      <span className="block text-xs font-semibold text-white">
                        {value.toUpperCase()}
                      </span>
                      <span className="mt-1 block text-[10px] text-neutral-500">
                        {description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3">
                  <Film className="h-4 w-4 text-violet-300" />
                  <span>
                    <span className="block text-[11px] text-neutral-300">
                      画面
                    </span>
                    <span className="block text-[10px] text-neutral-600">
                      素材、模板、节拍
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3">
                  <Music2 className="h-4 w-4 text-cyan-300" />
                  <span>
                    <span className="block text-[11px] text-neutral-300">
                      音频
                    </span>
                    <span className="block text-[10px] text-neutral-600">
                      项目主音乐轨
                    </span>
                  </span>
                </div>
              </div>

              <p className="text-[10px] leading-4 text-neutral-600">
                导出在本地完成，耗时约等于视频长度。优先输出 MP4，不支持时自动使用 WebM。
              </p>

              {exporting && (
                <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.07] p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-2 text-violet-200">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      正在合成并编码
                    </span>
                    <span className="tabular-nums text-neutral-400">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-[width] duration-200"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {status === "done" && result && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-3 text-xs text-emerald-200">
                  <Check className="h-4 w-4" />
                  已导出 {result.ext.toUpperCase()} · {result.width} ×{" "}
                  {result.height}，下载已开始。
                </div>
              )}

              {status === "error" && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/[0.08] px-3 py-3 text-xs leading-5 text-red-200">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          {exporting ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-white/5"
            >
              取消导出
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-xs text-neutral-500 transition-colors hover:text-white"
            >
              关闭
            </button>
          )}
          <button
            type="button"
            disabled={!supported || exporting}
            onClick={() => void startExport()}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Download className="h-3.5 w-3.5" />
            {status === "done" ? "重新导出" : "开始导出"}
          </button>
        </div>
      </div>
    </div>
  );
}
