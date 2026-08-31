"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { VideoRole, VideoFile } from "@/features/motion-analyzer/types";
import { useLanguage } from "@/i18n/LanguageProvider";

interface VideoUploadCardProps {
  role: VideoRole;
  video: VideoFile | null;
  onUpload: (video: VideoFile) => void;
  onRemove: () => void;
}

export function VideoUploadCard({
  role,
  video,
  onUpload,
  onRemove,
}: VideoUploadCardProps) {
  const { language, t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const label = role === "reference" ? "标准视频" : "练习视频";
  const sublabel =
    role === "reference" ? "上传教学 / 标准动作" : "上传你的练习";

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) return;
      const url = URL.createObjectURL(file);
      onUpload({ id: crypto.randomUUID(), role, name: file.name, url });
    },
    [onUpload, role]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (video) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex flex-col rounded-2xl border border-white/12 bg-[#1c1c1c] overflow-hidden"
      >
        <div className="relative bg-black" style={{ aspectRatio: '16 / 7.2' }}>
          <video
            src={video.url}
            className="w-full h-full object-contain"
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = 1;
            }}
          />
          <div className="absolute top-3 left-3">
            <span className="text-xs font-semibold text-white bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              {t(label)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm text-white/60">
            {video.name}
          </p>
          <button
            onClick={onRemove}
            aria-label={
              language === "en" ? `Remove ${t(label).toLowerCase()}` : `移除${label}`
            }
            className="shrink-0 text-xs text-white/30 transition-colors hover:text-red-400"
          >
            {t("移除")}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      style={{ aspectRatio: '16 / 7.2' }}
      role="button"
      tabIndex={0}
      aria-label={t(sublabel)}
      className={`
        relative flex flex-col items-center justify-center gap-3
        rounded-2xl border-2 border-dashed cursor-pointer
        transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fe2c55]
        ${isDragging
          ? "border-[#fe2c55]/50 bg-[#fe2c55]/5"
          : "border-white/15 bg-[#1c1c1c] hover:border-white/25 hover:bg-[#252525]"
        }
      `}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
        <svg className="h-6 w-6 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white/90">{t(label)}</p>
        <p className="text-xs text-white/45 mt-0.5">{t(sublabel)}</p>
      </div>
      <p className="text-[11px] text-white/35">{t("拖放文件或点击浏览")}</p>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        className="hidden"
      />
    </motion.div>
  );
}
