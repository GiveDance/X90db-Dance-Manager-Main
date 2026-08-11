"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Film, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

interface UploaderProps {
  onFile: (file: File) => void;
}

export function Uploader({ onFile }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            "group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-14 transition-colors",
            dragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-neutral-700 bg-neutral-900/40 hover:border-neutral-500 hover:bg-neutral-900/70",
          )}
        >
          <div
            className={cn(
              "mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors",
              dragging ? "bg-blue-500/20 text-blue-400" : "bg-neutral-800 text-neutral-300",
            )}
          >
            <UploadCloud className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium text-white">点击上传，或将视频拖拽到此处</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
            <Film className="h-4 w-4" />
            推荐 16:9 的 mp4（H.264）· 全程本地运行，视频不上传
          </p>
        </button>

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
            <span>{error}</span>
          </div>
        )}
    </div>
  );
}
