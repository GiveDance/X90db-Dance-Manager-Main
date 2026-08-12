export type RhythmAnalysisEngine = "madmom" | "essentia" | "web-audio" | "manual";

export interface RhythmBeat {
  time: number;
  beatInBar: number | null;
  confidence: number;
}

export interface BeatAnalysis {
  bpm: number;
  offset: number; // 第 1 拍的时间（秒）
  musicStart: number | null; // First sustained audio onset in seconds.
  beats?: RhythmBeat[]; // Actual tracked beat times. Missing means the uniform legacy grid.
  engine?: RhythmAnalysisEngine;
  confidence?: number;
}

export interface Segment {
  num: number; // 1-based 显示序号
  start: number; // 钳制到 [0, duration] 的起点
  end: number; // 钳制到 [0, duration] 的终点
  origin: number; // 未钳制的八拍起点（downbeat 时间），用于推导节拍点
  spb: number; // seconds per beat
  beats: number[]; // 该段内 8 个节拍点时间
}

/** 节拍可视化形式：顶部拍点 / 边缘脉冲 / 呼吸灯。 */
export type BeatVizMode = "dots" | "pulse" | "breath" | "tiles";

export type CountPointStyle = "dots" | "tiles";

export type CountPointPosition = "top" | "bottom" | "left" | "right";

export interface BeatVizConfig {
  countPoints: boolean;
  countPointStyle: CountPointStyle;
  countPointPosition: CountPointPosition;
  pulse: boolean;
  breath: boolean;
}

export type MarkerColor = "yellow" | "white" | "pink" | "blue" | "green";

export interface Marker {
  id: string;
  time: number;
  label: string; // 简短标签，如 "Turn"
  text: string; // 说明文字
  color: MarkerColor;
}

/**
 * 舞蹈段落（前奏 / 第1段…）。以「八拍序号」存储而非时间，
 * 保证重新校准 BPM 后段落仍严格对齐整数个八拍。
 */
export interface DanceSection {
  id: string;
  name: string;
  startSeg: number; // 起始八拍序号（含）
  endSeg: number; // 结束八拍序号（含）
}

export interface FormationPosition {
  dancer: number;
  x: number;
  y: number;
}

export type FormationAudiencePosition = "top" | "bottom" | "left" | "right";

export interface FormationChange {
  id: string;
  startTime: number;
  endTime: number;
  startPositions: FormationPosition[];
  endPositions: FormationPosition[];
}

/** 保存在 IndexedDB 中的一支舞蹈的元数据（视频 Blob 单独存储）。 */
export interface SavedDanceMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  bpm: number; // 校准后的节奏，自动保存
  offset: number; // 校准后的第 1 拍位置
  /** @deprecated Read-only migration field. Current calibrated value is `bpm`. */
  analysisBpm?: number;
  /** @deprecated Read-only migration field. Current calibrated value is `offset`. */
  analysisOffset?: number;
  detectedBpm?: number; // Immutable BPM from the first successful video analysis.
  detectedOffset?: number; // Immutable offset from the first successful video analysis.
  detectedBeats?: RhythmBeat[]; // Immutable per-beat result from the first successful analysis.
  analysisBeats?: RhythmBeat[]; // Canonical beat grid used by playback after calibration.
  analysisEngine?: RhythmAnalysisEngine;
  analysisConfidence?: number;
  musicStart?: number | null; // Optional for compatibility with saved dances created before onset detection.
  performanceStart?: number | null; // Presentation count 1; does not modify detected beat timestamps.
  duration: number;
  size: number;
  type: string;
  cover: string | null; // 封面缩略图 dataURL
  markers: Marker[];
  sections?: DanceSection[]; // 段落（可选，旧数据可能没有）
  formationChanges?: FormationChange[];
  formationAudiencePosition?: FormationAudiencePosition;
}

export const MARKER_COLORS: Record<MarkerColor, { dot: string; text: string; pill: string }> = {
  yellow: { dot: "bg-yellow-400", text: "text-yellow-300", pill: "border-yellow-400/40" },
  white: { dot: "bg-white", text: "text-white", pill: "border-white/40" },
  pink: { dot: "bg-pink-400", text: "text-pink-300", pill: "border-pink-400/40" },
  blue: { dot: "bg-blue-400", text: "text-blue-300", pill: "border-blue-400/40" },
  green: { dot: "bg-emerald-400", text: "text-emerald-300", pill: "border-emerald-400/40" },
};
