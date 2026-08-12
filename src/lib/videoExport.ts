import type {
  BeatVizConfig,
  FormationAudiencePosition,
  FormationChange,
  FormationPosition,
  Marker,
  MarkerColor,
} from "./types";
import { formatTime } from "./format";
import { FORMATION_COLORS, formationAtTime } from "./formations";

export type FormationExportPlacement =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "overlay";

export interface ExportOverlayOptions {
  mirror: boolean;
  beatViz: boolean;
  markers: boolean;
  countIn: boolean;
  formation: boolean;
  formationPlacement: FormationExportPlacement;
}

export interface ExportParams {
  src: string; // objectURL
  bpm: number;
  offset: number;
  musicStart: number | null;
  markers: Marker[];
  formationChanges: FormationChange[];
  formationAudiencePosition: FormationAudiencePosition;
  options: ExportOverlayOptions;
  vizConfig: BeatVizConfig;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  ext: "mp4" | "webm";
}

const MARKER_HEX: Record<MarkerColor, string> = {
  yellow: "#fde047",
  white: "#ffffff",
  pink: "#f9a8d4",
  blue: "#60a5fa",
  green: "#6ee7b7",
};

const DISPLAY = 4.5;
const MAX_W = 1920;
const evenDimension = (value: number) =>
  Math.max(2, Math.round(value / 2) * 2);

export class ExportUnsupportedError extends Error {
  constructor() {
    super("EXPORT_UNSUPPORTED");
    this.name = "ExportUnsupportedError";
  }
}
export class ExportAbortedError extends Error {
  constructor() {
    super("EXPORT_ABORTED");
    this.name = "ExportAbortedError";
  }
}

/** 选择导出容器，优先 MP4(H.264)，否则回退 WebM。 */
function pickMime(): { mime: string; ext: "mp4" | "webm" } | null {
  const candidates: { mime: string; ext: "mp4" | "webm" }[] = [
    { mime: 'video/mp4;codecs="avc1.640029,mp4a.40.2"', ext: "mp4" },
    { mime: "video/mp4;codecs=avc1.640029", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) {
      return c;
    }
  }
  return null;
}

export function canExport(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    pickMime() !== null
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBeatDots(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  bpm: number,
  offset: number,
  musicStart: number | null,
  orientation: "horizontal" | "vertical",
) {
  const beat = beatInfo(t, bpm, offset);
  const musicStarted = musicStart == null || t >= musicStart - 0.02;
  const segmentNumber = beat
    ? Math.floor(beat.globalBeat / 8) + 1
    : 1;

  const vertical = orientation === "vertical";
  const r = Math.max(
    5,
    Math.min(
      vertical ? w * 0.12 : h * 0.14,
      vertical ? h * 0.035 : w * 0.022,
    ),
  );
  const available = vertical ? h : w;
  const gap = Math.min(r * 3.4, (available - r * 5) / 7);
  const total = gap * 7;
  const labelH = r * 1.8;
  const start = available / 2 - total / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${r * 1.25}px sans-serif`;
  for (let i = 0; i < 8; i++) {
    const x = vertical ? w * 0.38 : start + i * gap;
    const y = vertical ? start + i * gap : h * 0.42;
    const active = beat != null && i === beat.local;
    const strong = i === 0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (!musicStarted) {
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.fillStyle = active
        ? "rgba(82,82,91,0.95)"
        : strong
          ? "rgba(113,113,122,0.25)"
          : "rgba(63,63,70,0.8)";
      ctx.shadowColor = active ? "rgba(163,163,163,0.6)" : "transparent";
      ctx.shadowBlur = active ? r * 1.5 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = active
        ? "rgba(212,212,216,0.9)"
        : strong
          ? "rgba(161,161,170,0.6)"
          : "rgba(82,82,91,0.9)";
      ctx.stroke();
    } else if (active) {
      ctx.fillStyle = strong ? "#db2777" : "#2563eb";
      ctx.shadowColor = strong
        ? "rgba(219,39,119,0.8)"
        : "rgba(37,99,235,0.8)";
      ctx.shadowBlur = r * 1.5;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.fillStyle = strong
        ? "rgba(219,39,119,0.10)"
        : "rgba(37,99,235,0.10)";
      ctx.fill();
      ctx.strokeStyle = strong
        ? "rgba(236,72,153,0.55)"
        : "rgba(59,130,246,0.45)";
      ctx.stroke();
    }
    ctx.fillStyle = !musicStarted
      ? active
        ? "#f5f5f5"
        : strong
          ? "#a1a1aa"
          : "#71717a"
      : strong
        ? active
          ? "#fbcfe8"
          : "rgba(249,168,212,0.55)"
        : active
          ? "#bfdbfe"
          : "rgba(147,197,253,0.45)";
    ctx.fillText(
      String(strong ? segmentNumber : i + 1),
      vertical ? x + r + labelH * 0.65 : x,
      vertical ? y : y + r + labelH * 0.6,
    );
  }
  ctx.restore();
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  markers: Marker[],
) {
  const active = markers.filter((m) => t >= m.time && t < m.time + DISPLAY);
  if (!active.length) return;

  const fontSize = Math.max(13, h * 0.026);
  const padX = fontSize * 0.8;
  const padY = fontSize * 0.5;
  const gapY = fontSize * 0.6;
  const rowH = fontSize + padY * 2;
  let y = h * 0.18;

  ctx.save();
  ctx.textBaseline = "middle";
  for (const m of active) {
    const ts = formatTime(m.time);
    const seg: { text: string; color: string; bold: boolean }[] = [
      { text: ts, color: MARKER_HEX[m.color], bold: false },
    ];
    if (m.label) seg.push({ text: m.label, color: "#ffffff", bold: true });
    if (m.text) seg.push({ text: m.text, color: "rgba(255,255,255,0.92)", bold: false });

    // 量取总宽
    let contentW = 0;
    const gapBetween = fontSize * 0.45;
    for (let i = 0; i < seg.length; i++) {
      ctx.font = `${seg[i].bold ? "700" : "500"} ${fontSize}px sans-serif`;
      contentW += ctx.measureText(seg[i].text).width;
      if (i < seg.length - 1) contentW += gapBetween;
    }
    const boxW = contentW + padX * 2;
    const boxX = w / 2 - boxW / 2;

    ctx.fillStyle = "rgba(0,0,0,0.62)";
    roundRect(ctx, boxX, y, boxW, rowH, rowH / 2);
    ctx.fill();

    let x = boxX + padX;
    ctx.textAlign = "left";
    for (let i = 0; i < seg.length; i++) {
      ctx.font = `${seg[i].bold ? "700" : "500"} ${fontSize}px sans-serif`;
      ctx.fillStyle = seg[i].color;
      ctx.fillText(seg[i].text, x, y + rowH / 2);
      x += ctx.measureText(seg[i].text).width + gapBetween;
    }
    y += rowH + gapY;
  }
  ctx.restore();
}

function beatInfo(t: number, bpm: number, offset: number) {
  const firstBeat = Math.max(0, offset);
  if (t < firstBeat) return null;
  const spb = 60 / bpm;
  const rel = (t - firstBeat) / spb;
  const fl = Math.floor(rel);
  const local = ((fl % 8) + 8) % 8;
  return { phase: rel - fl, isDownbeat: local === 0, local, globalBeat: fl };
}

function drawCountTiles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  bpm: number,
  offset: number,
  musicStart: number | null,
  orientation: "horizontal" | "vertical",
) {
  const beat = beatInfo(t, bpm, offset);
  const musicStarted = musicStart == null || t >= musicStart - 0.02;
  const activeTile = beat ? beat.local % 4 : -1;
  const secondHalf = beat ? beat.local >= 4 : false;
  const segmentNumber = beat
    ? Math.floor(beat.globalBeat / 8) + 1
    : 1;
  const pulse = beat ? Math.max(0, 1 - beat.phase) : 0;
  const vertical = orientation === "vertical";
  const railW = vertical
    ? w * 0.72
    : Math.min(w * 0.78, h * 5.8);
  const railH = vertical
    ? h * 0.74
    : Math.min(h * 0.68, railW * 0.22);
  const gap = Math.max(
    6,
    (vertical ? railH : railW) * 0.018,
  );
  const tileW = vertical ? railW : (railW - gap * 3) / 4;
  const tileH = vertical ? (railH - gap * 3) / 4 : railH;
  const x = (w - railW) / 2;
  const y = (h - railH) / 2;
  const radius = Math.max(8, Math.min(tileW, tileH) * 0.14);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.max(18, tileH * 0.38)}px sans-serif`;

  for (let index = 0; index < 4; index++) {
    const left = vertical ? x : x + index * (tileW + gap);
    const top = vertical ? y + index * (tileH + gap) : y;
    const isDownbeat = !secondHalf && index === 0;
    const isActive = index === activeTile;
    const color = isDownbeat ? "219,39,119" : "37,99,235";
    const edge = isDownbeat ? "244,114,182" : "103,232,249";

    roundRect(ctx, left, top, tileW, tileH, radius);
    if (!musicStarted) {
      if (isActive) {
        const gradient = ctx.createLinearGradient(
          left,
          top,
          left + tileW,
          top + tileH,
        );
        gradient.addColorStop(0, "#737373");
        gradient.addColorStop(1, "#404040");
        ctx.fillStyle = gradient;
        ctx.shadowColor = "rgba(163,163,163,0.55)";
        ctx.shadowBlur = 34 * (0.65 + pulse * 0.35);
      } else {
        ctx.fillStyle = isDownbeat
          ? "rgba(113,113,122,0.25)"
          : "rgba(63,63,70,0.8)";
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    } else if (isActive) {
      const gradient = ctx.createLinearGradient(
        left,
        top,
        left + tileW,
        top + tileH,
      );
      if (isDownbeat) {
        gradient.addColorStop(0, "#db2777");
        gradient.addColorStop(1, "#9333ea");
      } else {
        gradient.addColorStop(0, "#2563eb");
        gradient.addColorStop(1, "#22d3ee");
      }
      ctx.fillStyle = gradient;
      ctx.shadowColor = isDownbeat
        ? "rgba(219,39,119,0.7)"
        : "rgba(37,99,235,0.6)";
      ctx.shadowBlur = (isDownbeat ? 40 : 34) * (0.65 + pulse * 0.35);
    } else {
      ctx.fillStyle = isDownbeat
        ? "rgba(219,39,119,0.07)"
        : "rgba(37,99,235,0.06)";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    ctx.lineWidth = Math.max(1.5, tileH * 0.025);
    ctx.strokeStyle = !musicStarted
      ? isDownbeat
        ? isActive
          ? "rgba(229,229,229,0.95)"
          : "rgba(161,161,170,0.6)"
        : isActive
          ? "rgba(212,212,216,0.9)"
          : "rgba(82,82,91,0.9)"
      : isActive
        ? `rgba(${edge},${0.72 + pulse * 0.28})`
        : `rgba(${color},${isDownbeat ? 0.28 : 0.22})`;
    ctx.stroke();

    ctx.fillStyle = !musicStarted
      ? isDownbeat
        ? isActive
          ? "#ffffff"
          : "#a1a1aa"
        : isActive
          ? "#ffffff"
          : "#71717a"
      : isActive
        ? "#ffffff"
        : "rgba(255,255,255,0.25)";
    ctx.fillText(
      secondHalf
        ? String(index + 5)
        : index === 0
          ? String(segmentNumber)
          : String(index + 1),
      left + tileW / 2,
      top + tileH / 2,
    );
  }

  ctx.restore();
}

/** 边缘脉冲：四边发光，第 1 拍紫色更强，其余蓝色。 */
function drawBeatPulse(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  bpm: number,
  offset: number,
  musicStart: number | null,
) {
  const b = beatInfo(t, bpm, offset);
  if (!b) return;
  const musicStarted = musicStart == null || t >= musicStart - 0.02;
  const i = Math.max(0, 1 - b.phase);
  const intensity = i * i;
  const alpha = musicStarted
    ? (b.isDownbeat ? 0.9 : 0.55) * intensity
    : (b.isDownbeat ? 0.65 : 0.42) * intensity;
  if (alpha <= 0.01) return;
  const c = musicStarted
    ? b.isDownbeat
      ? "168,85,247"
      : "59,130,246"
    : "82,82,91";
  const th = (b?.isDownbeat ? 0.18 : 0.12) * Math.min(w, h);
  const mk = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${c},${alpha})`);
    g.addColorStop(1, `rgba(${c},0)`);
    return g;
  };
  ctx.save();
  ctx.fillStyle = mk(0, 0, 0, th);
  ctx.fillRect(0, 0, w, th);
  ctx.fillStyle = mk(0, h, 0, h - th);
  ctx.fillRect(0, h - th, w, th);
  ctx.fillStyle = mk(0, 0, th, 0);
  ctx.fillRect(0, 0, th, h);
  ctx.fillStyle = mk(w, 0, w - th, 0);
  ctx.fillRect(w - th, 0, th, h);
  ctx.restore();
}

/** 呼吸灯：顶部居中蓝色光球 + 四角星，第 1 拍扩散更大。 */
function drawBeatBreath(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  bpm: number,
  offset: number,
  musicStart: number | null,
) {
  const b = beatInfo(t, bpm, offset);
  if (!b) return;
  const musicStarted = musicStart == null || t >= musicStart - 0.02;
  const intensity = Math.max(0, 1 - b.phase);
  const base = b.isDownbeat ? 0.72 : 0.46;
  const amp = b.isDownbeat ? 1.05 : 0.3;
  const scale = base + amp * intensity;
  const opacity = (b.isDownbeat ? 0.5 : 0.4) + 0.5 * intensity;
  const R0 = h * 0.15;
  const R = R0 * scale;
  const cx = w / 2;
  const cy = h * 0.05 + R0;

  ctx.save();
  ctx.globalAlpha = opacity;
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  bloom.addColorStop(0, musicStarted ? "rgba(255,255,255,0.95)" : "rgba(229,229,229,0.7)");
  bloom.addColorStop(0.25, musicStarted ? "rgba(186,230,253,0.8)" : "rgba(163,163,163,0.55)");
  bloom.addColorStop(0.55, musicStarted ? "rgba(96,165,250,0.45)" : "rgba(115,115,115,0.35)");
  bloom.addColorStop(1, musicStarted ? "rgba(59,130,246,0)" : "rgba(82,82,82,0)");
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  const pts: [number, number][] = [
    [0, -0.92], [0.06, -0.06], [0.92, 0], [0.06, 0.06],
    [0, 0.92], [-0.06, 0.06], [-0.92, 0], [-0.06, -0.06],
  ];
  const star = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  star.addColorStop(0, musicStarted ? "rgba(255,255,255,1)" : "rgba(229,229,229,0.8)");
  star.addColorStop(0.45, musicStarted ? "rgba(147,197,253,1)" : "rgba(163,163,163,0.65)");
  star.addColorStop(1, musicStarted ? "rgba(59,130,246,0.15)" : "rgba(82,82,82,0.15)");
  ctx.fillStyle = star;
  ctx.beginPath();
  pts.forEach(([ox, oy], idx) => {
    const x = cx + ox * R;
    const y = cy + oy * R;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 起播跟拍 count-in：第 1 拍前 3 拍内绘制 3/2/1 + 半透明蓝边脉冲。 */
function drawCountIn(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  bpm: number,
  offset: number,
) {
  const firstBeat = Math.max(0, offset);
  if (firstBeat <= 0.05) return;
  const spb = 60 / bpm;
  const remaining = firstBeat - t;
  if (remaining <= 0.02 || remaining > spb * 3 + 0.02) return;
  const n = Math.max(1, Math.min(3, Math.ceil(remaining / spb)));

  ctx.save();
  // 半透明蓝色边框，每拍脉冲（刚过拍点最亮）
  const frac = (remaining / spb) % 1;
  const pulse = 0.2 + 0.5 * frac;
  ctx.lineWidth = Math.max(8, h * 0.025);
  ctx.strokeStyle = `rgba(59,130,246,${pulse})`;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

  // 数字 + 柔和暗晕（仅为可读性）
  const fs = h * 0.28;
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.arc(w / 2, h / 2, fs * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 ${fs}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = fs * 0.15;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(n), w / 2, h / 2);
  ctx.restore();
}

interface ExportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function containRect(rect: ExportRect, ratio: number, padding: number): ExportRect {
  const availableWidth = Math.max(1, rect.width - padding * 2);
  const availableHeight = Math.max(1, rect.height - padding * 2);
  const width = Math.min(availableWidth, availableHeight * ratio);
  const height = width / ratio;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

function drawFormationAudience(
  ctx: CanvasRenderingContext2D,
  stage: ExportRect,
  audiencePosition: FormationAudiencePosition,
) {
  const horizontal =
    audiencePosition === "top" || audiencePosition === "bottom";
  const pillWidth = horizontal ? stage.width * 0.18 : stage.width * 0.09;
  const pillHeight = horizontal ? stage.height * 0.1 : stage.height * 0.2;
  const inset = Math.max(4, Math.min(stage.width, stage.height) * 0.025);
  const x =
    audiencePosition === "left"
      ? stage.x + inset
      : audiencePosition === "right"
        ? stage.x + stage.width - pillWidth - inset
        : stage.x + (stage.width - pillWidth) / 2;
  const y =
    audiencePosition === "top"
      ? stage.y + inset
      : audiencePosition === "bottom"
        ? stage.y + stage.height - pillHeight - inset
        : stage.y + (stage.height - pillHeight) / 2;

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1, Math.min(stage.width, stage.height) * 0.004);
  roundRect(ctx, x, y, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `600 ${Math.max(8, pillHeight * 0.46)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("观众", x + pillWidth / 2, y + pillHeight / 2);
}

function drawFormation(
  ctx: CanvasRenderingContext2D,
  rect: ExportRect,
  positions: FormationPosition[],
  audiencePosition: FormationAudiencePosition,
  overlay: boolean,
) {
  const radius = Math.max(10, Math.min(rect.width, rect.height) * 0.045);
  const panelRadius = Math.max(10, Math.min(rect.width, rect.height) * 0.045);
  ctx.save();
  ctx.fillStyle = overlay ? "rgba(8,8,8,0.76)" : "#080808";
  ctx.strokeStyle = overlay
    ? "rgba(255,255,255,0.2)"
    : "rgba(255,255,255,0.12)";
  ctx.lineWidth = Math.max(1, Math.min(rect.width, rect.height) * 0.006);
  if (overlay) {
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, panelRadius);
  } else {
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.fill();
  ctx.stroke();

  const stage = containRect(
    rect,
    16 / 9,
    Math.max(8, Math.min(rect.width, rect.height) * 0.07),
  );
  ctx.save();
  roundRect(ctx, stage.x, stage.y, stage.width, stage.height, panelRadius * 0.5);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  for (let index = 1; index < 10; index += 1) {
    const x = stage.x + (stage.width * index) / 10;
    ctx.beginPath();
    ctx.moveTo(x, stage.y);
    ctx.lineTo(x, stage.y + stage.height);
    ctx.stroke();
  }
  for (let index = 1; index < 6; index += 1) {
    const y = stage.y + (stage.height * index) / 6;
    ctx.beginPath();
    ctx.moveTo(stage.x, y);
    ctx.lineTo(stage.x + stage.width, y);
    ctx.stroke();
  }
  ctx.restore();

  drawFormationAudience(ctx, stage, audiencePosition);
  for (const position of positions) {
    const x = stage.x + position.x * stage.width;
    const y = stage.y + position.y * stage.height;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle =
      FORMATION_COLORS[
        (position.dancer - 1 + FORMATION_COLORS.length) %
          FORMATION_COLORS.length
      ];
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.94)";
    ctx.lineWidth = Math.max(2, radius * 0.14);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.max(10, radius * 0.92)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(position.dancer), x, y);
  }
  ctx.restore();
}

function exportLayout(
  width: number,
  height: number,
  placement: FormationExportPlacement,
  formationEnabled: boolean,
  beatVizEnabled: boolean,
  vizConfig: BeatVizConfig,
) {
  let contentLayout;
  if (!formationEnabled || placement === "overlay") {
    const overlayWidth = width * 0.32;
    const overlayHeight = overlayWidth * (9 / 16);
    contentLayout = {
      outputWidth: width,
      outputHeight: height,
      video: { x: 0, y: 0, width, height },
      formation: {
        x: width - overlayWidth - width * 0.025,
        y: height - overlayHeight - height * 0.04,
        width: overlayWidth,
        height: overlayHeight,
      },
    };
  } else if (placement === "top" || placement === "bottom") {
    const panelHeight = evenDimension(height * 0.34);
    contentLayout = {
      outputWidth: width,
      outputHeight: height + panelHeight,
      video: {
        x: 0,
        y: placement === "top" ? panelHeight : 0,
        width,
        height,
      },
      formation: {
        x: 0,
        y: placement === "top" ? 0 : height,
        width,
        height: panelHeight,
      },
    };
  } else {
    const panelWidth = evenDimension(width * 0.34);
    contentLayout = {
      outputWidth: width + panelWidth,
      outputHeight: height,
      video: {
        x: placement === "left" ? panelWidth : 0,
        y: 0,
        width,
        height,
      },
      formation: {
        x: placement === "left" ? 0 : width,
        y: 0,
        width: panelWidth,
        height,
      },
    };
  }

  const countPointsEnabled = beatVizEnabled && vizConfig.countPoints;
  const countPointPosition = vizConfig.countPointPosition;
  const verticalDock =
    countPointsEnabled &&
    (countPointPosition === "left" || countPointPosition === "right");
  const horizontalDock = countPointsEnabled && !verticalDock;
  const dockWidth = verticalDock
    ? evenDimension(
        contentLayout.outputWidth *
          (vizConfig.countPointStyle === "tiles" ? 1 / 6 : 0.1),
      )
    : 0;
  const dockHeight = horizontalDock ? evenDimension(height * 0.24) : 0;
  const contentOffsetX =
    verticalDock && countPointPosition === "left" ? dockWidth : 0;
  const contentOffsetY =
    horizontalDock && countPointPosition === "top" ? dockHeight : 0;
  const shiftContent = (rect: ExportRect): ExportRect => ({
    ...rect,
    x: rect.x + contentOffsetX,
    y: rect.y + contentOffsetY,
  });
  const content = {
    x: contentOffsetX,
    y: contentOffsetY,
    width: contentLayout.outputWidth,
    height: contentLayout.outputHeight,
  };

  let countPointVisual: ExportRect | null = null;
  if (countPointsEnabled) {
    if (horizontalDock) {
      countPointVisual = {
        x: 0,
        y:
          countPointPosition === "top"
            ? 0
            : contentLayout.outputHeight,
        width: contentLayout.outputWidth + dockWidth,
        height: dockHeight,
      };
    } else {
      countPointVisual = {
        x:
          countPointPosition === "left"
            ? 0
            : contentLayout.outputWidth,
        y: 0,
        width: dockWidth,
        height: contentLayout.outputHeight,
      };
    }
  }
  const countPointLayer: ExportRect | null =
    countPointsEnabled
      ? countPointVisual
      : null;

  return {
    outputWidth: contentLayout.outputWidth + dockWidth,
    outputHeight: contentLayout.outputHeight + dockHeight,
    video: shiftContent(contentLayout.video),
    formation: shiftContent(contentLayout.formation),
    content,
    countPointLayer,
    countPointVisual,
  };
}

/**
 * 在浏览器本地把叠加图层「烧录」进视频并导出。实时录制，耗时约等于视频时长。
 */
export async function exportVideoWithOverlays(params: ExportParams): Promise<ExportResult> {
  const picked = pickMime();
  if (!picked || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
    throw new ExportUnsupportedError();
  }
  const {
    src,
    bpm,
    offset,
    musicStart,
    markers,
    formationChanges,
    formationAudiencePosition,
    options,
    vizConfig,
    onProgress,
    signal,
  } = params;

  const video = document.createElement("video");
  video.src = src;
  video.muted = false;
  video.playsInline = true;
  video.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("LOAD_FAILED"));
  });

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const formationWidthFactor =
    options.formation &&
    (options.formationPlacement === "left" ||
      options.formationPlacement === "right")
      ? 1.34
      : 1;
  const countPointWidthFactor =
    options.beatViz &&
    vizConfig.countPoints &&
    (vizConfig.countPointPosition === "left" ||
      vizConfig.countPointPosition === "right")
      ? 1 + (vizConfig.countPointStyle === "tiles" ? 1 / 6 : 0.1)
      : 1;
  const widthFactor = formationWidthFactor * countPointWidthFactor;
  const scale = Math.min(1, MAX_W / (vw * widthFactor));
  const w = evenDimension(vw * scale);
  const h = evenDimension(vh * scale);
  const duration = video.duration || 0;
  const layout = exportLayout(
    w,
    h,
    options.formationPlacement,
    options.formation && formationChanges.length > 0,
    options.beatViz,
    vizConfig,
  );

  const canvas = document.createElement("canvas");
  canvas.width = layout.outputWidth;
  canvas.height = layout.outputHeight;
  const ctx = canvas.getContext("2d")!;
  const videoCanvas = document.createElement("canvas");
  videoCanvas.width = w;
  videoCanvas.height = h;
  const videoCtx = videoCanvas.getContext("2d")!;

  // 音频：经 Web Audio 捕获，但不连扬声器（导出时静音）
  let audioCtx: AudioContext | null = null;
  let audioTrack: MediaStreamTrack | null = null;
  try {
    audioCtx = new AudioContext();
    await audioCtx.resume().catch(() => {});
    const srcNode = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    srcNode.connect(dest);
    audioTrack = dest.stream.getAudioTracks()[0] ?? null;
  } catch {
    audioTrack = null;
  }

  const supportsManualFrames =
    typeof CanvasCaptureMediaStreamTrack !== "undefined" &&
    "requestFrame" in CanvasCaptureMediaStreamTrack.prototype;
  const canvasStream = canvas.captureStream(supportsManualFrames ? 0 : 30);
  const canvasTrack = canvasStream.getVideoTracks()[0] as
    | CanvasCaptureMediaStreamTrack
    | undefined;
  const tracks: MediaStreamTrack[] = canvasTrack ? [canvasTrack] : [];
  if (audioTrack) tracks.push(audioTrack);
  const stream = new MediaStream(tracks);

  const recorder = new MediaRecorder(stream, {
    mimeType: picked.mime,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  let videoFrameCallback = 0;
  let fallbackTimer = 0;
  let watchdogTimer = 0;
  let aborted = false;
  let renderError: Error | null = null;
  let lastRenderedTime = -1;

  const draw = () => {
    const t = video.currentTime;
    videoCtx.clearRect(0, 0, w, h);
    videoCtx.save();
    if (options.mirror) {
      videoCtx.translate(w, 0);
      videoCtx.scale(-1, 1);
    }
    videoCtx.drawImage(video, 0, 0, w, h);
    videoCtx.restore();
    if (options.markers) drawMarkers(videoCtx, w, h, t, markers);
    if (options.countIn) drawCountIn(videoCtx, w, h, t, bpm, offset);

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      videoCanvas,
      layout.video.x,
      layout.video.y,
      layout.video.width,
      layout.video.height,
    );
    if (options.formation && formationChanges.length > 0) {
      drawFormation(
        ctx,
        layout.formation,
        formationAtTime(formationChanges, t),
        formationAudiencePosition,
        options.formationPlacement === "overlay",
      );
    }
    if (
      layout.countPointLayer &&
      layout.countPointVisual &&
      options.beatViz &&
      vizConfig.countPoints
    ) {
      ctx.fillStyle = "#0e0e10";
      ctx.fillRect(
        layout.countPointLayer.x,
        layout.countPointLayer.y,
        layout.countPointLayer.width,
        layout.countPointLayer.height,
      );
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (vizConfig.countPointPosition === "top") {
        ctx.moveTo(0, layout.countPointLayer.height);
        ctx.lineTo(layout.countPointLayer.width, layout.countPointLayer.height);
      } else if (vizConfig.countPointPosition === "bottom") {
        ctx.moveTo(0, layout.countPointLayer.y);
        ctx.lineTo(layout.countPointLayer.width, layout.countPointLayer.y);
      } else if (vizConfig.countPointPosition === "left") {
        ctx.moveTo(layout.countPointLayer.width, 0);
        ctx.lineTo(layout.countPointLayer.width, layout.countPointLayer.height);
      } else {
        ctx.moveTo(layout.countPointLayer.x, 0);
        ctx.lineTo(layout.countPointLayer.x, layout.countPointLayer.height);
      }
      ctx.stroke();
      ctx.save();
      ctx.translate(layout.countPointVisual.x, layout.countPointVisual.y);
      const countPointOrientation =
        vizConfig.countPointPosition === "left" ||
        vizConfig.countPointPosition === "right"
          ? "vertical"
          : "horizontal";
      if (vizConfig.countPointStyle === "tiles") {
        drawCountTiles(
          ctx,
          layout.countPointVisual.width,
          layout.countPointVisual.height,
          t,
          bpm,
          offset,
          musicStart,
          countPointOrientation,
        );
      } else {
        drawBeatDots(
          ctx,
          layout.countPointVisual.width,
          layout.countPointVisual.height,
          t,
          bpm,
          offset,
          musicStart,
          countPointOrientation,
        );
      }
      ctx.restore();
    }
    if (options.beatViz && vizConfig.pulse) {
      ctx.save();
      ctx.translate(layout.content.x, layout.content.y);
      drawBeatPulse(
        ctx,
        layout.content.width,
        layout.content.height,
        t,
        bpm,
        offset,
        musicStart,
      );
      ctx.restore();
    }
    if (options.beatViz && vizConfig.breath) {
      ctx.save();
      ctx.translate(layout.content.x, layout.content.y);
      drawBeatBreath(
        ctx,
        layout.content.width,
        layout.content.height,
        t,
        bpm,
        offset,
        musicStart,
      );
      ctx.restore();
    }
    if (duration) onProgress?.(Math.min(1, t / duration));
    if (supportsManualFrames) canvasTrack?.requestFrame();
    lastRenderedTime = t;
  };

  const stop = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };

  const renderFrame = () => {
    try {
      draw();
      return true;
    } catch (error) {
      renderError =
        error instanceof Error ? error : new Error("EXPORT_RENDER_FAILED");
      stop();
      return false;
    }
  };

  const drawNextVideoFrame = () => {
    if (!renderFrame()) return;
    if ("requestVideoFrameCallback" in video) {
      videoFrameCallback = video.requestVideoFrameCallback(drawNextVideoFrame);
    } else {
      fallbackTimer = window.setTimeout(drawNextVideoFrame, 1000 / 30);
    }
  };

  const cleanup = () => {
    if (videoFrameCallback) {
      video.cancelVideoFrameCallback(videoFrameCallback);
    }
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    if (watchdogTimer) window.clearInterval(watchdogTimer);
    video.pause();
    video.removeAttribute("src");
    video.load();
    audioCtx?.close().catch(() => {});
  };

  const result = new Promise<ExportResult>((resolve, reject) => {
    recorder.onstop = () => {
      cleanup();
      if (aborted) {
        reject(new ExportAbortedError());
        return;
      }
      if (renderError) {
        reject(renderError);
        return;
      }
      resolve({ blob: new Blob(chunks, { type: picked.mime.split(";")[0] }), ext: picked.ext });
    };
    recorder.onerror = () => {
      cleanup();
      reject(new Error("RECORD_FAILED"));
    };
  });

  signal?.addEventListener("abort", () => {
    aborted = true;
    stop();
  });
  video.onended = () => {
    onProgress?.(1);
    stop();
  };

  recorder.start(5000);
  renderFrame();
  await video.play();
  watchdogTimer = window.setInterval(() => {
    if (
      !video.paused &&
      video.currentTime > lastRenderedTime + 0.2
    ) {
      renderFrame();
    }
  }, 250);
  if ("requestVideoFrameCallback" in video) {
    videoFrameCallback = video.requestVideoFrameCallback(drawNextVideoFrame);
  } else {
    fallbackTimer = window.setTimeout(drawNextVideoFrame, 1000 / 30);
  }

  return result;
}
