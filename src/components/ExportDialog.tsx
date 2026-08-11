"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Download, FlipHorizontal2, CircleDot, MessageSquareText, Timer, Loader2, Check } from "lucide-react";
import {
  canExport,
  exportVideoWithOverlays,
  ExportAbortedError,
  type ExportOverlayOptions,
} from "@/lib/videoExport";
import type { BeatVizMode, Marker } from "@/lib/types";
import { cn } from "@/lib/cn";

interface ExportDialogProps {
  src: string;
  name: string;
  bpm: number;
  offset: number;
  musicStart: number | null;
  markers: Marker[];
  vizModes: Record<BeatVizMode, boolean>;
  onClose: () => void;
}

type Status = "idle" | "exporting" | "done" | "error";

function baseName(name: string) {
  return name.replace(/\.[^/.]+$/, "") || "dance";
}

export function ExportDialog({
  src,
  name,
  bpm,
  offset,
  musicStart,
  markers,
  vizModes,
  onClose,
}: ExportDialogProps) {
  const [options, setOptions] = useState<ExportOverlayOptions>({
    mirror: false,
    beatViz: true,
    markers: true,
    countIn: true,
  });
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultExt, setResultExt] = useState<"mp4" | "webm">("mp4");
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  const supported = canExport();

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const triggerDownload = (blob: Blob, ext: string) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName(name)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const startExport = async () => {
    setStatus("exporting");
    setProgress(0);
    setErrorMsg("");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const { blob, ext } = await exportVideoWithOverlays({
        src,
        bpm,
        offset,
        musicStart,
        markers,
        options,
        vizModes,
        onProgress: setProgress,
        signal: ac.signal,
      });
      setResultExt(ext);
      triggerDownload(blob, ext);
      setStatus("done");
    } catch (e) {
      if (e instanceof ExportAbortedError) {
        setStatus("idle");
        return;
      }
      setErrorMsg("导出失败，可能是当前浏览器不支持视频录制。建议使用最新版 Chrome / Edge。");
      setStatus("error");
    }
  };

  const cancel = () => abortRef.current?.abort();

  const OPTION_ROWS: { key: keyof ExportOverlayOptions; label: string; desc: string; icon: React.ReactNode }[] = [
    { key: "mirror", label: "镜像", desc: "左右翻转画面", icon: <FlipHorizontal2 className="h-4 w-4" /> },
    { key: "beatViz", label: "节拍视觉", desc: "顶部拍点 / 边缘脉冲 / 呼吸灯（按当前选择）", icon: <CircleDot className="h-4 w-4" /> },
    { key: "markers", label: "动作标记", desc: "你添加的标记弹幕", icon: <MessageSquareText className="h-4 w-4" /> },
    { key: "countIn", label: "起播倒计时", desc: "第1拍前的 3-2-1 准备", icon: <Timer className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">导出视频</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!supported ? (
          <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            当前浏览器不支持视频录制导出。请使用最新版 Chrome 或 Edge。
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-neutral-500">勾选要烧录进视频的内容：</p>
            <div className="space-y-2">
              {OPTION_ROWS.map((row) => (
                <button
                  key={row.key}
                  disabled={status === "exporting"}
                  onClick={() => setOptions((o) => ({ ...o, [row.key]: !o[row.key] }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                    options[row.key]
                      ? "border-blue-500/50 bg-blue-500/10"
                      : "border-white/10 bg-neutral-800/40 hover:bg-neutral-800",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      options[row.key] ? "bg-blue-500/20 text-blue-400" : "bg-neutral-800 text-neutral-400",
                    )}
                  >
                    {row.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-white">{row.label}</span>
                    <span className="block text-xs text-neutral-500">{row.desc}</span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md border",
                      options[row.key] ? "border-blue-500 bg-blue-500 text-white" : "border-white/20",
                    )}
                  >
                    {options[row.key] && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              ))}
            </div>

            {status === "exporting" && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    导出中…（耗时约等于视频时长）
                  </span>
                  <span className="tabular-nums">{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-[width] duration-200"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {status === "done" && (
              <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
                <Check className="h-4 w-4" />
                已导出 {resultExt.toUpperCase()}，下载已开始。
              </p>
            )}

            {status === "error" && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                {errorMsg}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              {status === "exporting" ? (
                <button
                  onClick={cancel}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/10"
                >
                  取消
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-400 hover:text-white"
                >
                  {status === "done" ? "关闭" : "取消"}
                </button>
              )}
              <button
                onClick={startExport}
                disabled={status === "exporting"}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {status === "done" ? "重新导出" : "导出 MP4"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
