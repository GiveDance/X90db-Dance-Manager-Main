import type {
  BeatPointShape,
  CornerSignalShape,
  PerformerSignalTheme,
  StageSignalPosition,
} from "./types";

type RGB = [number, number, number];
type Corner = {
  cx: number;
  cy: number;
  a0: number;
  a1: number;
};
type IconPath = (
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) => void;

export const CORNER_SIGNAL_SHAPES: Array<{
  id: CornerSignalShape;
  label: string;
}> = [
  { id: "bloom", label: "光晕" },
  { id: "burst", label: "星芒" },
];

export const BEAT_POINT_SHAPES: Array<{
  id: BeatPointShape;
  label: string;
}> = [
  { id: "tiles", label: "方块" },
  { id: "hearts", label: "爱心" },
  { id: "stars", label: "四芒星" },
  { id: "star5", label: "五角星" },
];

export const PERFORMER_SIGNAL_THEMES: Array<{
  id: PerformerSignalTheme;
  label: string;
  beat: RGB;
  down: RGB;
}> = [
  { id: "neon", label: "霓虹", beat: [82, 100, 238], down: [244, 72, 38] },
  { id: "gold", label: "暖金", beat: [255, 196, 84], down: [255, 255, 255] },
  { id: "white", label: "纯白", beat: [190, 198, 230], down: [255, 255, 255] },
  { id: "contrast", label: "高对比", beat: [0, 111, 255], down: [255, 214, 0] },
];

interface PerformerSignalRenderSettings {
  corner: {
    enabled: boolean;
    shape: CornerSignalShape;
    beatColor: string;
    accentColor: string;
    size: number;
    opacity: number;
  };
  beatPoints: {
    enabled: boolean;
    shape: BeatPointShape;
    theme: PerformerSignalTheme;
    beatColor: string;
    accentColor: string;
    size: number;
    opacity: number;
    spacing: number;
    rows: 1 | 2;
    positions: StageSignalPosition[];
  };
  secondaryAccentCount: number;
  beatOverride?: {
    index: number;
    elapsed: number;
    visualLead: true;
  };
}

const LEGACY_NEON_BEAT = "#7c6cff";
const LEGACY_NEON_ACCENT = "#ff5c8a";
const NEON_BEAT = "#5264ee";
const NEON_ACCENT = "#f44826";

function usesDefaultNeonPalette(
  theme: PerformerSignalTheme,
  beatColor: string,
  accentColor: string,
) {
  if (theme !== "neon") return false;
  const beat = beatColor.toLowerCase();
  const accent = accentColor.toLowerCase();
  return (
    (beat === LEGACY_NEON_BEAT && accent === LEGACY_NEON_ACCENT) ||
    (beat === NEON_BEAT && accent === NEON_ACCENT)
  );
}

function usesDefaultTexturedPalette(
  theme: PerformerSignalTheme,
  beatColor: string,
  accentColor: string,
) {
  if (usesDefaultNeonPalette(theme, beatColor, accentColor)) return true;
  const beat = beatColor.toLowerCase();
  const accent = accentColor.toLowerCase();
  return (
    (theme === "gold" && beat === "#ffc454" && accent === "#ffffff") ||
    (theme === "white" && beat === "#bec6e6" && accent === "#ffffff") ||
    (theme === "contrast" && beat === "#006fff" && accent === "#ffd600")
  );
}

function hexToRgb(value: string, fallback: RGB): RGB {
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) return fallback;
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function corners(width: number, height: number): Corner[] {
  const quarter = Math.PI / 2;
  return [
    { cx: 0, cy: 0, a0: 0, a1: quarter },
    { cx: width, cy: 0, a0: quarter, a1: 2 * quarter },
    { cx: width, cy: height, a0: 2 * quarter, a1: 3 * quarter },
    { cx: 0, cy: height, a0: 3 * quarter, a1: 4 * quarter },
  ];
}

function lastBeatIndex(beats: number[], time: number): number {
  let low = 0;
  let high = beats.length - 1;
  let index = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (beats[middle] <= time) {
      index = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return index;
}

function drawBloom(
  context: CanvasRenderingContext2D,
  corner: Corner,
  radius: number,
  elapsed: number,
  downbeat: boolean,
  intensity: number,
  ringDuration: number,
  lineWidth: number,
  rgba: (alpha: number) => string,
) {
  const gradient = context.createRadialGradient(
    corner.cx,
    corner.cy,
    0,
    corner.cx,
    corner.cy,
    radius,
  );
  gradient.addColorStop(0, rgba(0.95 * intensity));
  gradient.addColorStop(0.45, rgba(0.45 * intensity));
  gradient.addColorStop(1, rgba(0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(corner.cx, corner.cy, radius, 0, Math.PI * 2);
  context.fill();

  if (elapsed < ringDuration) {
    const progress = elapsed / ringDuration;
    context.lineWidth = Math.max(2, lineWidth);
    context.strokeStyle = rgba((1 - progress) * (downbeat ? 0.9 : 0.65));
    context.beginPath();
    context.arc(
      corner.cx,
      corner.cy,
      radius * (0.35 + 1.05 * progress),
      0,
      Math.PI * 2,
    );
    context.stroke();
  }
}

type SoftOrbKind =
    | "neon-beat"
    | "neon-down"
    | "gold-beat"
    | "gold-down"
    | "white-beat"
    | "white-down"
    | "contrast-beat"
    | "contrast-down";

const SOFT_ORB_PALETTES: Record<SoftOrbKind, RGB[]> = {
    "neon-beat": [
      [68, 73, 210],
      [68, 112, 255],
      [159, 177, 255],
      [219, 184, 255],
      [239, 157, 255],
      [167, 202, 154],
    ],
    "neon-down": [
      [255, 132, 34],
      [255, 78, 31],
      [232, 42, 91],
      [190, 35, 136],
      [105, 42, 168],
      [48, 35, 106],
    ],
    "gold-beat": [
      [180, 104, 18],
      [244, 158, 35],
      [255, 199, 84],
      [255, 225, 142],
      [255, 243, 202],
      [224, 134, 42],
    ],
    "gold-down": [
      [255, 226, 166],
      [255, 240, 209],
      [255, 251, 239],
      [255, 255, 255],
      [255, 255, 255],
      [245, 218, 172],
    ],
    "white-beat": [
      [128, 132, 145],
      [153, 159, 174],
      [181, 187, 200],
      [198, 195, 206],
      [218, 218, 220],
      [144, 153, 159],
    ],
    "white-down": [
      [196, 211, 239],
      [224, 235, 255],
      [244, 240, 255],
      [255, 255, 255],
      [235, 247, 250],
      [205, 190, 229],
    ],
    "contrast-beat": [
      [0, 45, 148],
      [0, 91, 232],
      [0, 111, 255],
      [65, 153, 255],
      [154, 204, 255],
      [33, 62, 177],
    ],
    "contrast-down": [
      [189, 123, 0],
      [239, 176, 0],
      [255, 214, 0],
      [255, 233, 77],
      [255, 248, 176],
      [255, 194, 24],
    ],
};

const SOFT_ORB_BLOBS = [
    { x: -0.26, y: 0.08, rx: 0.72, ry: 0.78 },
    { x: 0.22, y: -0.24, rx: 0.78, ry: 0.68 },
    { x: 0.31, y: 0.25, rx: 0.7, ry: 0.74 },
    { x: -0.02, y: 0.34, rx: 0.74, ry: 0.56 },
    { x: -0.22, y: -0.3, rx: 0.56, ry: 0.62 },
    { x: 0.1, y: -0.42, rx: 0.46, ry: 0.4 },
] as const;

const softOrbSprites = new Map<string, HTMLCanvasElement>();

function createSoftOrbSprite(key: string, palette: RGB[]) {
  const cached = softOrbSprites.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const center = canvas.width / 2;
  const radius = 150;
  const halo = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    radius * 1.3,
  );
  const haloColor = palette[2];
  halo.addColorStop(
    0,
    `rgba(${haloColor[0]},${haloColor[1]},${haloColor[2]},0.42)`,
  );
  halo.addColorStop(
    0.5,
    `rgba(${haloColor[0]},${haloColor[1]},${haloColor[2]},0.22)`,
  );
  halo.addColorStop(1, "rgba(0,0,0,0)");
  context.filter = `blur(${radius * 0.18}px)`;
  context.fillStyle = halo;
  context.beginPath();
  context.arc(center, center, radius * 1.32, 0, Math.PI * 2);
  context.fill();

  SOFT_ORB_BLOBS.forEach((blob, index) => {
    const color = palette[index];
    context.save();
    context.translate(center + radius * blob.x, center + radius * blob.y);
    context.scale(blob.rx, blob.ry);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(
      0,
      `rgba(${color[0]},${color[1]},${color[2]},0.96)`,
    );
    gradient.addColorStop(
      0.42,
      `rgba(${color[0]},${color[1]},${color[2]},0.68)`,
    );
    gradient.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    context.filter = `blur(${radius * 0.09}px)`;
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  softOrbSprites.set(key, canvas);
  return canvas;
}

function drawTexturedBeatPoint(
  context: CanvasRenderingContext2D,
  icon: IconPath,
  cx: number,
  cy: number,
  size: number,
  spriteKey: string,
  palette: RGB[],
  paletteOpacity: number,
  intensity: number,
) {
  const sprite = createSoftOrbSprite(spriteKey, palette);
  const orbSize = size * 2.35;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha *= (0.45 + 0.35 * intensity) * paletteOpacity;
  context.drawImage(
    sprite,
    cx - orbSize / 2,
    cy - orbSize / 2,
    orbSize,
    orbSize,
  );
  context.restore();

  context.save();
  icon(context, cx, cy, size);
  context.clip();
  context.globalAlpha *= (0.94 + 0.06 * intensity) * paletteOpacity;
  context.drawImage(
    sprite,
    cx - orbSize / 2,
    cy - orbSize / 2,
    orbSize,
    orbSize,
  );
  context.restore();
}

function customSoftOrbPalette(color: RGB): RGB[] {
  return [
    mixColor(color, [0, 0, 0], 0.38),
    mixColor(color, [0, 0, 0], 0.12),
    color,
    mixColor(color, [255, 255, 255], 0.28),
    mixColor(mixColor(color, [255, 255, 255], 0.48), [255, 196, 226], 0.12),
    mixColor(mixColor(color, [255, 255, 255], 0.2), [135, 190, 255], 0.14),
  ];
}

function drawBurst(
  context: CanvasRenderingContext2D,
  corner: Corner,
  radius: number,
  elapsed: number,
  downbeat: boolean,
  intensity: number,
  ringDuration: number,
  size: number,
  rgba: (alpha: number) => string,
) {
  const rayCount = downbeat ? 9 : 6;
  const growth =
    elapsed < ringDuration ? 0.4 + 0.6 * (elapsed / ringDuration) : 1;
  const length = radius * growth * (0.5 + 0.5 * intensity);
  context.save();
  context.lineCap = "round";
  context.lineWidth = Math.max(2, 3.5 * size);
  context.strokeStyle = rgba(0.9 * intensity);
  for (let index = 0; index < rayCount; index += 1) {
    const angle =
      corner.a0 +
      ((index + 0.5) / rayCount) * (corner.a1 - corner.a0);
    context.beginPath();
    context.moveTo(corner.cx, corner.cy);
    context.lineTo(
      corner.cx + Math.cos(angle) * length,
      corner.cy + Math.sin(angle) * length,
    );
    context.stroke();
  }
  context.fillStyle = rgba(0.8 * intensity);
  context.beginPath();
  context.arc(corner.cx, corner.cy, Math.max(3, 5 * size), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function fourPointStar(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.38;
  context.beginPath();
  for (let index = 0; index < 8; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 4;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function fivePointStar(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.45;
  context.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function heart(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  const height = size * 0.92;
  const top = height * 0.3;
  const y = cy - height / 2;
  context.beginPath();
  context.moveTo(cx, y + top);
  context.bezierCurveTo(cx, y, cx - size / 2, y, cx - size / 2, y + top);
  context.bezierCurveTo(
    cx - size / 2,
    y + (height + top) / 2,
    cx,
    y + (height + top) / 2,
    cx,
    y + height,
  );
  context.bezierCurveTo(
    cx,
    y + (height + top) / 2,
    cx + size / 2,
    y + (height + top) / 2,
    cx + size / 2,
    y + top,
  );
  context.bezierCurveTo(cx + size / 2, y, cx, y, cx, y + top);
  context.closePath();
}

function tile(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  const radius = size * 0.2;
  const left = cx - size / 2;
  const top = cy - size / 2;
  context.beginPath();
  context.moveTo(left + radius, top);
  context.arcTo(left + size, top, left + size, top + size, radius);
  context.arcTo(
    left + size,
    top + size,
    left,
    top + size,
    radius,
  );
  context.arcTo(left, top + size, left, top, radius);
  context.arcTo(left, top, left + size, top, radius);
  context.closePath();
}

function mixColor(from: RGB, to: RGB, amount: number): RGB {
  const mix = Math.max(0, Math.min(1, amount));
  return from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * mix),
  ) as RGB;
}

function drawBeatPoints(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  beatIndex: number,
  flash: number,
  accentBeat: boolean,
  visualLead: boolean,
  theme: { beat: RGB; down: RGB },
  settings: PerformerSignalRenderSettings["beatPoints"],
) {
  const current = beatIndex >= 0 ? beatIndex % 8 : -1;
  const minSide = Math.min(width, height);
  const size = Math.max(0.6, Math.min(1.8, settings.size));
  const spacing = Math.max(0.5, Math.min(1.5, settings.spacing));
  const baseSize = Math.min(minSide * 0.045, 34) * size;
  const gap = baseSize * 0.51 * spacing;
  const defaultTexture = usesDefaultTexturedPalette(
    settings.theme,
    settings.beatColor,
    settings.accentColor,
  );
  const softOrbKind = defaultTexture
    ? (`${settings.theme}-${accentBeat ? "down" : "beat"}` as SoftOrbKind)
    : null;
  const customTextureColor = accentBeat ? theme.down : theme.beat;
  const textureKey = softOrbKind
    ? softOrbKind
    : `custom-${customTextureColor.join("-")}`;
  const texturePalette = softOrbKind
    ? SOFT_ORB_PALETTES[softOrbKind]
    : customSoftOrbPalette(customTextureColor);
  const textureOpacity = softOrbKind === "white-beat" ? 0.68 : 1;
  const activeColor = visualLead
    ? ([255, 255, 255] as RGB)
    : accentBeat
      ? settings.theme === "neon" && defaultTexture
        ? PERFORMER_SIGNAL_THEMES[0].down
        : theme.down
      : settings.theme === "neon" && defaultTexture
        ? PERFORMER_SIGNAL_THEMES[0].beat
        : theme.beat;
  const icon: IconPath =
    settings.shape === "tiles"
      ? tile
      : settings.shape === "hearts"
        ? heart
        : settings.shape === "stars"
          ? fourPointStar
          : fivePointStar;
  const color = (rgb: RGB, alpha: number) =>
    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, alpha)})`;

  context.save();
  context.lineJoin = "round";
  context.globalAlpha =
    Math.max(0.2, Math.min(1, settings.opacity)) *
    (visualLead ? 0.48 : 1);
  for (const position of settings.positions) {
    const vertical = position === "left" || position === "right";
    const double = settings.rows === 2;
    const columns = vertical ? (double ? 2 : 1) : double ? 4 : 8;
    const rows = vertical ? (double ? 4 : 8) : double ? 2 : 1;
    const groupWidth = columns * baseSize + (columns - 1) * gap;
    const groupHeight = rows * baseSize + (rows - 1) * gap;
    const groupLeft = width / 2 - groupWidth / 2;
    const groupTop = height / 2 - groupHeight / 2;
    const edge = minSide * 0.045;
    for (let index = 0; index < 8; index += 1) {
      let column =
        vertical && double
          ? Math.floor(index / 4)
          : index % columns;
      let row =
        vertical && double
          ? index % 4
          : Math.floor(index / columns);
      if (position === "right") column = columns - 1 - column;
      if (position === "bottom") row = rows - 1 - row;
      const cx = vertical
        ? position === "left"
          ? edge + baseSize / 2 + column * (baseSize + gap)
          : width - edge - groupWidth + baseSize / 2 +
            column * (baseSize + gap)
        : groupLeft + baseSize / 2 + column * (baseSize + gap);
      const cy = vertical
        ? groupTop + baseSize / 2 + row * (baseSize + gap)
        : position === "top"
          ? edge + baseSize / 2 + row * (baseSize + gap)
          : height - edge - groupHeight + baseSize / 2 +
            row * (baseSize + gap);
      const isCurrent = index === current && flash > 0;
      const hasPassed = current >= 0 && index < current;

      if (isCurrent) {
        const activeSize =
          baseSize * (1 + 0.14 * flash) * (accentBeat ? 1.28 : 1);
        if (accentBeat) {
          context.save();
          context.shadowColor = color(activeColor, 0.82);
          context.shadowBlur = minSide * (0.018 + flash * 0.02);
          context.lineWidth = Math.max(2, baseSize * 0.075);
          context.strokeStyle = color([255, 255, 255], 0.48 + 0.38 * flash);
          icon(
            context,
            cx,
            cy,
            activeSize * (1.25 + 0.1 * (1 - flash)),
          );
          context.stroke();
          context.restore();
        }
        if (!visualLead) {
          drawTexturedBeatPoint(
            context,
            icon,
            cx,
            cy,
            activeSize,
            textureKey,
            texturePalette,
            textureOpacity,
            flash,
          );
        } else {
          context.shadowColor = color(activeColor, 0.7);
          context.shadowBlur = minSide * (0.012 + flash * 0.016);
          context.fillStyle = color(activeColor, 0.58 + 0.32 * flash);
          icon(context, cx, cy, activeSize);
          context.fill();
        }
        icon(context, cx, cy, activeSize);
        if (accentBeat) {
          context.lineWidth = Math.max(2.5, baseSize * 0.11);
          context.strokeStyle = color([0, 0, 0], 0.72);
          context.stroke();
          icon(context, cx, cy, activeSize);
        }
        context.lineWidth = Math.max(
          accentBeat ? 1.5 : 0.9,
          baseSize * (accentBeat ? 0.055 : 0.035),
        );
        context.strokeStyle = color(
          [255, 255, 255],
          accentBeat ? 0.94 : 0.78,
        );
        context.stroke();
        context.shadowBlur = 0;
      } else if (hasPassed) {
        context.fillStyle = color([255, 255, 255], 0.075);
        context.strokeStyle = color([255, 255, 255], 0.38);
        context.lineWidth = Math.max(0.9, baseSize * 0.035);
        icon(context, cx, cy, baseSize);
        context.fill();
        context.stroke();
      } else {
        context.lineWidth = Math.max(0.9, baseSize * 0.035);
        context.strokeStyle = color([255, 255, 255], 0.34);
        context.fillStyle = color([255, 255, 255], 0.035);
        icon(context, cx, cy, baseSize);
        context.fill();
        context.stroke();
      }
    }
  }
  context.restore();
}

export function drawPerformerSignal(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  beats: number[],
  settings: PerformerSignalRenderSettings,
) {
  context.clearRect(0, 0, width, height);
  if (!settings.corner.enabled && !settings.beatPoints.enabled) return;

  const beatIndex =
    settings.beatOverride?.index ?? lastBeatIndex(beats, time);
  const visualLead = settings.beatOverride?.visualLead === true;
  const elapsed =
    settings.beatOverride?.elapsed ??
    (beatIndex >= 0
      ? Math.max(0, time - beats[beatIndex])
      : Number.POSITIVE_INFINITY);
  const downbeat = beatIndex >= 0 && beatIndex % 8 === 0;
  const secondary =
    !visualLead &&
    settings.secondaryAccentCount > 1 &&
    beatIndex >= 0 &&
    beatIndex % 8 === settings.secondaryAccentCount - 1;
  const accentBeat = downbeat || secondary;
  const flashDuration = accentBeat ? 0.3 : 0.22;
  const flash = Math.max(0, 1 - elapsed / flashDuration);

  if (settings.beatPoints.enabled) {
    const theme = {
      beat: hexToRgb(settings.beatPoints.beatColor, [124, 108, 255]),
      down: hexToRgb(settings.beatPoints.accentColor, [255, 92, 138]),
    };
    drawBeatPoints(
      context,
      width,
      height,
      beatIndex,
      flash,
      accentBeat,
      visualLead,
      theme,
      settings.beatPoints,
    );
  }

  if (settings.corner.enabled) {
    const theme = {
      beat: hexToRgb(settings.corner.beatColor, [124, 108, 255]),
      down: hexToRgb(settings.corner.accentColor, [255, 92, 138]),
    };
    const size = Math.max(0.6, Math.min(1.8, settings.corner.size));
    const activeColor = visualLead
      ? ([255, 255, 255] as RGB)
      : accentBeat
        ? theme.down
        : theme.beat;
    const color = visualLead
      ? ([255, 255, 255] as RGB)
      : mixColor([255, 255, 255], activeColor, flash);
    const rgba = (alpha: number) =>
      `rgba(${color[0]},${color[1]},${color[2]},${Math.max(0, alpha)})`;
    const radius =
      Math.min(width, height) * 0.24 * size * (accentBeat ? 1.5 : 1);
    const intensity = Math.max(0.045, flash);
    const ringDuration = accentBeat ? 0.5 : 0.34;
    context.save();
    context.globalAlpha = Math.max(
      0.2,
      Math.min(1, settings.corner.opacity),
    ) * (visualLead ? 0.48 : 1);
    context.globalCompositeOperation = "lighter";
    for (const corner of corners(width, height)) {
      if (settings.corner.shape === "bloom") {
        drawBloom(
          context,
          corner,
          radius,
          elapsed,
          accentBeat,
          intensity,
          ringDuration,
          (accentBeat ? 9 : 6) * size,
          rgba,
        );
      } else {
        drawBurst(
          context,
          corner,
          radius,
          elapsed,
          accentBeat,
          intensity,
          ringDuration,
          size,
          rgba,
        );
      }
    }
    context.restore();
  }
  context.globalAlpha = 1;
}
