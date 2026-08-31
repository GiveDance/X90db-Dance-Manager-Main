"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Film, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/i18n/LanguageProvider";

interface UploaderProps {
  onFile: (file: File) => void;
  mode?: "learning" | "performing";
}

export function Uploader({ onFile, mode = "learning" }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, translateText } = useLanguage();

  const handleFile = useCallback(
    (file: File | undefined | null) => {
      setError(null);
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        setError("请选择视频文件（mp4 / webm 等浏览器支持的格式）。");
        return;
      }
      // 用临时 video 探测能否解码，提前拦截不支持的编码（如部分 .mov / HEVC）
      const probe = document.createElement("video");
      const url = URL.createObjectURL(file);
      let settled = false;
      const cleanup = () => URL.revokeObjectURL(url);
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        if (settled) return;
        settled = true;
        cleanup();
        onFile(file);
      };
      probe.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        setError("无法播放该视频，可能是浏览器不支持的编码（如 HEVC）。请尝试 H.264 编码的 mp4。");
      };
      probe.src = url;
    },
    [onFile],
  );

  return (
    <div className="w-full">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:px-8 sm:py-12",
            dragging
              ? mode === "learning"
                ? "border-blue-500 bg-blue-500/10"
                : "border-violet-500 bg-violet-500/10"
              : mode === "learning"
                ? "border-neutral-700 bg-neutral-900/40 hover:border-neutral-500 hover:bg-neutral-900/70"
                : "border-neutral-700 bg-neutral-900/40 hover:border-violet-400/60 hover:bg-violet-500/5",
          )}
        >
          <div
            className={cn(
              "mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors",
              dragging
                ? mode === "learning"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-violet-500/20 text-violet-300"
                : "bg-neutral-800 text-ui-secondary",
            )}
          >
            <UploadCloud className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold text-white">
            {mode === "learning"
              ? t("上传练舞视频")
              : t("上传演出主视频")}
          </p>
          <p className="text-ui-secondary mt-1 flex flex-wrap items-center justify-center gap-1.5 text-sm">
            <Film className="h-4 w-4 shrink-0" />
            {t("点击选择或将视频拖入此处")}
          </p>
        </button>
        <p className="text-ui-secondary mt-2 px-1 text-xs">
          {t("推荐使用 H.264 编码的 MP4 · 所有处理均在本地完成")}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{translateText(error)}</span>
          </div>
        )}
    </div>
  );
}
