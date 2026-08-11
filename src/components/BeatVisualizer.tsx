"use client";

import type { BeatVizMode } from "@/lib/types";

interface BeatVisualizerProps {
  mode: Extract<BeatVizMode, "pulse" | "breath">;
  phase: number; // 当前拍内进度 0..1（0=刚踩拍）
  isDownbeat: boolean; // 是否八拍的第 1 拍
  active: boolean; // 当前是否落在某个八拍内
  musicStarted: boolean;
}

const COLOR_DOWN = "168,85,247"; // 紫 purple-500
const COLOR_NORM = "59,130,246"; // 蓝 blue-500

/**
 * 节拍可视化（叠加在视频上，半透明）：
 * - pulse：全屏四边脉冲闪光，第 1 拍紫色更强，其余蓝色不变。
 * - breath：顶部居中十字形（四角星）光晕呼吸绽放，第 1 拍扩散更大，其余更小。
 */
export function BeatVisualizer({
  mode,
  phase,
  isDownbeat,
  active,
  musicStarted,
}: BeatVisualizerProps) {
  if (!active) return null;

  if (mode === "pulse") {
    const color = musicStarted
      ? isDownbeat
        ? COLOR_DOWN
        : COLOR_NORM
      : "115,115,115";
    const i = Math.max(0, 1 - phase);
    const intensity = i * i; // 锐利衰减
    const alpha = (
      musicStarted
        ? isDownbeat
          ? 0.9
          : 0.55
        : isDownbeat
          ? 0.65
          : 0.42
    ) * intensity;
    const blur = isDownbeat ? 120 : 85;
    const spread = isDownbeat ? 34 : 18;
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: `inset 0 0 ${blur}px ${spread}px rgba(${color},${alpha})` }}
      />
    );
  }

  // breath：顶部居中「光球 + 四角星」，呼吸绽放；第 1 拍扩散大、其余小
  const intensity = Math.max(0, 1 - phase); // 线性，更柔
  const base = isDownbeat ? 0.72 : 0.46;
  const amp = isDownbeat ? 1.05 : 0.3; // 第 1 拍绽放大，其余小
  const scale = base + amp * intensity;
  const opacity = (isDownbeat ? 0.5 : 0.4) + 0.5 * intensity;
  const size = 220;

  return (
    <div className="pointer-events-none absolute left-1/2 top-[7%] -translate-x-1/2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center",
          opacity,
          filter: musicStarted
            ? "drop-shadow(0 0 16px rgba(96,165,250,0.85))"
            : "drop-shadow(0 0 16px rgba(163,163,163,0.55))",
        }}
      >
        <defs>
          {/* 柔和圆形光晕：白核 → 浅蓝 → 蓝 → 透明 */}
          <radialGradient id="orbBloom" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={musicStarted ? "#ffffff" : "#e5e5e5"} stopOpacity="0.95" />
            <stop offset="25%" stopColor={musicStarted ? "#bae6fd" : "#a3a3a3"} stopOpacity="0.8" />
            <stop offset="55%" stopColor={musicStarted ? "#60a5fa" : "#737373"} stopOpacity="0.45" />
            <stop offset="100%" stopColor={musicStarted ? "#3b82f6" : "#525252"} stopOpacity="0" />
          </radialGradient>
          {/* 星芒渐变 */}
          <radialGradient id="orbStar" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={musicStarted ? "#ffffff" : "#f5f5f5"} />
            <stop offset="45%" stopColor={musicStarted ? "#93c5fd" : "#a3a3a3"} />
            <stop offset="100%" stopColor={musicStarted ? "#3b82f6" : "#525252"} stopOpacity="0.15" />
          </radialGradient>
        </defs>
        {/* 圆形柔光晕 */}
        <circle cx="50" cy="50" r="34" fill="url(#orbBloom)" />
        {/* 四角星（细长十字星芒） */}
        <path d="M50 4 L53 47 L96 50 L53 53 L50 96 L47 53 L4 50 L47 47 Z" fill="url(#orbStar)" />
        {/* 亮核 */}
        <circle cx="50" cy="50" r="6.5" fill={musicStarted ? "#ffffff" : "#e5e5e5"} />
      </svg>
    </div>
  );
}
