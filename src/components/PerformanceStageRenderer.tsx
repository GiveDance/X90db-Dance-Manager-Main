"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { trackedBeatPreRoll } from "@/lib/countIn";
import type {
  GeneratedStageTemplate,
  StageSignalPosition,
} from "@/lib/types";
import "./PerformanceStageRenderer.css";

interface VisualSection {
  id: number;
  startBeat: number;
  endBeat: number;
  color: string;
}

interface PerformanceStageRendererProps {
  time: number;
  beats: number[];
  countdownBeats: number[];
  template: GeneratedStageTemplate;
  playing: boolean;
  showBeatCode: boolean;
  showSectionRail: boolean;
  beatCodePositions: StageSignalPosition[];
  railPositions: StageSignalPosition[];
  visualLeadMs: number;
  secondaryAccentCount: number;
  signalOnly?: boolean;
}

const SECTION_COLORS = [
  "#315ee8",
  "#4d66e8",
  "#6549e8",
  "#7650ed",
  "#8546dd",
  "#315ee8",
  "#554fe2",
  "#7146dc",
  "#8b43d6",
  "#9b3bb8",
  "#b43497",
  "#ca377e",
  "#de416b",
  "#eb4c61",
  "#f05d4b",
  "#f47043",
  "#f08945",
  "#4d66e8",
  "#7650ed",
  "#ef7053",
];

const PARTICLE_COLORS = [
  "36,70,176",
  "45,78,214",
  "49,94,232",
  "65,101,235",
  "77,102,232",
  "85,79,226",
  "101,73,232",
  "113,70,220",
  "132,67,214",
  "155,59,184",
  "180,52,151",
  "202,55,126",
  "222,65,107",
  "235,76,97",
  "240,93,75",
  "244,112,67",
  "240,137,69",
  "72,182,210",
  "229,184,79",
  "225,231,255",
];

const PULSE_PALETTES = [
  [[255, 205, 235], [92, 163, 255]],
  [[249, 171, 255], [255, 116, 95]],
  [[255, 120, 149], [125, 237, 197]],
  [[112, 139, 255], [251, 236, 144]],
] as const;

function beatIndexAtTime(beats: number[], time: number): number {
  let low = 0;
  let high = beats.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (beats[middle] <= time) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

function buildSections(beatCount: number): VisualSection[] {
  const sectionCount = Math.max(1, Math.ceil(beatCount / 32));
  return Array.from({ length: sectionCount }, (_, index) => ({
    id: index,
    startBeat: index * 32,
    endBeat: Math.min(beatCount, (index + 1) * 32),
    color: SECTION_COLORS[index % SECTION_COLORS.length],
  })).filter((section) => section.endBeat > section.startBeat);
}

type Point = { x: number; y: number };

function polygonPath(
  context: CanvasRenderingContext2D,
  points: Point[],
  offsetX = 0,
  offsetY = 0,
) {
  context.beginPath();
  points.forEach((point, index) => {
    const x = point.x + offsetX;
    const y = point.y + offsetY;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

function streetPolygonPoints(
  width: number,
  height: number,
  sideCount: number,
  vibration: number,
  clock: number,
  beatIndex: number,
  scale: number,
) {
  const centerX = width / 2;
  const centerY = height * 0.52;
  const radius = Math.min(width, height) * 0.29 * scale;
  return Array.from({ length: sideCount }, (_, index) => {
    const angle =
      -Math.PI / 2 +
      index * ((Math.PI * 2) / sideCount) +
      Math.sin(beatIndex * 1.31 + index * 2.47) * 0.13 +
      Math.sin(beatIndex * 0.43) * 0.09;
    const irregularity =
      1 +
      Math.sin(index * 2.17 + beatIndex * 1.63) * 0.15 +
      Math.cos(index * 3.11 - beatIndex * 0.79) * 0.055 +
      Math.sin(clock * 72 + index * 2.41) * vibration * 0.065;
    return {
      x:
        centerX +
        Math.sin(clock * 63) * vibration * radius * 0.025 +
        Math.cos(angle) * radius * irregularity,
      y:
        centerY +
        Math.cos(clock * 67) * vibration * radius * 0.022 +
        Math.sin(angle) * radius * irregularity,
    };
  });
}

function sharpBurstPoints(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  spikes: number,
  rotation: number,
) {
  return Array.from({ length: spikes * 2 }, (_, index) => {
    const angle = rotation + index * (Math.PI / spikes);
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });
}

type StreetMotifKind =
  | "burst"
  | "bolt"
  | "triangle"
  | "chevron"
  | "diamond"
  | "zigzag";

interface StreetMotif {
  kind: StreetMotifKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
}

const STREET_LAYOUTS: StreetMotif[][] = [
  [
    { kind: "burst", x: 0.1, y: 0.2, scale: 1.15, rotation: -0.2, color: "#ff258b" },
    { kind: "bolt", x: 0.9, y: 0.25, scale: 1.25, rotation: 0.12, color: "#00dce9" },
    { kind: "triangle", x: 0.16, y: 0.8, scale: 0.72, rotation: -0.65, color: "#ff7138" },
    { kind: "burst", x: 0.91, y: 0.8, scale: 0.78, rotation: 0.18, color: "#b7f20a" },
    { kind: "diamond", x: 0.38, y: 0.08, scale: 0.42, rotation: 0.45, color: "#1739dc" },
    { kind: "zigzag", x: 0.64, y: 0.92, scale: 0.55, rotation: 0.72, color: "#ff258b" },
  ],
  [
    { kind: "chevron", x: 0.91, y: 0.13, scale: 1.08, rotation: 0.32, color: "#ff7138" },
    { kind: "burst", x: 0.08, y: 0.7, scale: 1.18, rotation: -0.44, color: "#00dce9" },
    { kind: "bolt", x: 0.92, y: 0.68, scale: 0.86, rotation: 0.38, color: "#b7f20a" },
    { kind: "triangle", x: 0.13, y: 0.16, scale: 0.74, rotation: 0.54, color: "#ff258b" },
    { kind: "zigzag", x: 0.63, y: 0.07, scale: 0.62, rotation: -0.2, color: "#1739dc" },
    { kind: "diamond", x: 0.35, y: 0.93, scale: 0.52, rotation: -0.65, color: "#ff7138" },
  ],
  [
    { kind: "bolt", x: 0.07, y: 0.32, scale: 1.12, rotation: -0.36, color: "#b7f20a" },
    { kind: "chevron", x: 0.91, y: 0.8, scale: 1.18, rotation: 0.2, color: "#ff258b" },
    { kind: "burst", x: 0.82, y: 0.09, scale: 0.94, rotation: 0.72, color: "#00dce9" },
    { kind: "zigzag", x: 0.18, y: 0.9, scale: 0.78, rotation: -0.24, color: "#ff7138" },
    { kind: "triangle", x: 0.05, y: 0.59, scale: 0.48, rotation: 0.22, color: "#1739dc" },
    { kind: "diamond", x: 0.95, y: 0.44, scale: 0.5, rotation: 0.52, color: "#b7f20a" },
  ],
  [
    { kind: "burst", x: 0.93, y: 0.31, scale: 1.08, rotation: 0.22, color: "#1739dc" },
    { kind: "zigzag", x: 0.08, y: 0.13, scale: 1.08, rotation: -0.62, color: "#ff258b" },
    { kind: "chevron", x: 0.11, y: 0.82, scale: 0.94, rotation: -0.18, color: "#00dce9" },
    { kind: "bolt", x: 0.84, y: 0.9, scale: 0.9, rotation: 0.58, color: "#ff7138" },
    { kind: "triangle", x: 0.67, y: 0.06, scale: 0.46, rotation: -0.38, color: "#b7f20a" },
    { kind: "diamond", x: 0.04, y: 0.49, scale: 0.56, rotation: 0.78, color: "#1739dc" },
  ],
];

const STREET_POLYGON_PALETTES = [
  ["#1739dc", "#00c9dd", "#ff258b", "#ff7138"],
  ["#2416b8", "#5369ff", "#ff3b9d", "#ff7a32"],
  ["#082b8f", "#00bccc", "#f51f79", "#ff563d"],
  ["#3020c7", "#6d48ee", "#ff376f", "#f58b32"],
  ["#123ed0", "#00c8d4", "#dc287f", "#ff6438"],
  ["#1c168d", "#4965f2", "#ff258b", "#ff8a31"],
  ["#1739dc", "#8348e8", "#f22672", "#ff7138"],
  ["#0d2a9c", "#00b9ca", "#ff3b96", "#ff5b3c"],
] as const;

function streetNoise(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function motifPath(
  context: CanvasRenderingContext2D,
  kind: StreetMotifKind,
  radius: number,
) {
  if (kind === "burst") {
    polygonPath(
      context,
      sharpBurstPoints(0, 0, radius * 0.38, radius, 7, -Math.PI / 2),
    );
    return;
  }
  context.beginPath();
  if (kind === "bolt") {
    context.moveTo(-radius * 0.25, -radius);
    context.lineTo(radius * 0.42, -radius * 0.22);
    context.lineTo(radius * 0.06, -radius * 0.16);
    context.lineTo(radius * 0.32, radius);
    context.lineTo(-radius * 0.48, radius * 0.16);
    context.lineTo(-radius * 0.1, radius * 0.1);
  } else if (kind === "triangle") {
    context.moveTo(0, -radius);
    context.lineTo(radius * 0.92, radius * 0.72);
    context.lineTo(-radius * 0.78, radius * 0.54);
  } else if (kind === "chevron") {
    context.moveTo(-radius, -radius * 0.42);
    context.lineTo(radius * 0.1, -radius * 0.1);
    context.lineTo(radius * 0.86, -radius * 0.64);
    context.lineTo(radius * 0.35, radius * 0.12);
    context.lineTo(radius, radius * 0.54);
    context.lineTo(-radius * 0.08, radius * 0.24);
  } else if (kind === "diamond") {
    context.moveTo(0, -radius);
    context.lineTo(radius * 0.72, 0);
    context.lineTo(0, radius);
    context.lineTo(-radius * 0.72, 0);
  } else {
    context.moveTo(-radius, -radius * 0.55);
    context.lineTo(-radius * 0.28, -radius * 0.16);
    context.lineTo(-radius * 0.72, radius * 0.18);
    context.lineTo(0, radius * 0.55);
    context.lineTo(radius * 0.42, radius * 0.08);
    context.lineTo(radius, radius * 0.44);
    context.lineTo(radius * 0.18, -radius * 0.55);
  }
  context.closePath();
}

function drawStreetMotif(
  context: CanvasRenderingContext2D,
  motif: StreetMotif,
  minSide: number,
  beatHit: number,
  beforeAudio: boolean,
  clock: number,
  index: number,
) {
  const radius = minSide * 0.0825 * motif.scale;
  const vibration = beatHit * minSide * 0.006;
  context.save();
  context.translate(
    motif.x + Math.sin(clock * 61 + index) * vibration,
    motif.y + Math.cos(clock * 67 + index) * vibration,
  );
  context.rotate(
    motif.rotation + Math.sin(clock * 58 + index) * beatHit * 0.045,
  );
  if (beforeAudio) {
    const localBreath = 1 + Math.sin(clock * 1.7 + index * 0.72) * 0.032;
    context.scale(localBreath, localBreath);
  }

  context.save();
  context.translate(-minSide * 0.007, minSide * 0.004);
  motifPath(context, motif.kind, radius);
  context.fillStyle = "rgba(0,220,233,0.34)";
  context.fill();
  context.restore();

  context.save();
  context.translate(minSide * 0.007, -minSide * 0.004);
  motifPath(context, motif.kind, radius);
  context.fillStyle = "rgba(255,37,139,0.32)";
  context.fill();
  context.restore();

  motifPath(context, motif.kind, radius);
  context.fillStyle = motif.color;
  context.fill();
  context.lineJoin = "bevel";
  context.lineWidth = Math.max(2, minSide * 0.005);
  context.strokeStyle = "#050609";
  context.stroke();

  context.save();
  motifPath(context, motif.kind, radius);
  context.clip();
  context.globalAlpha = 0.24;
  context.fillStyle = "#050609";
  const step = Math.max(5, minSide * 0.012);
  for (let y = -radius; y <= radius; y += step) {
    for (let x = -radius; x <= radius; x += step) {
      if ((Math.round(x / step) + Math.round(y / step)) % 2 === 0) {
        context.beginPath();
        context.arc(x, y, Math.max(0.7, minSide * 0.0015), 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  context.restore();

  context.restore();
}

function drawStreetBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sync: {
    beatHit: number;
    beatStarted: boolean;
    beatIndex: number;
    eightHit: number;
    progress: number;
    secondaryHit: number;
  },
  clock: number,
) {
  const minSide = Math.min(width, height);
  const scene = sync.beatIndex % STREET_LAYOUTS.length;
  const palette = STREET_POLYGON_PALETTES[sync.beatIndex % 8];
  const shards = [
    [-0.06, 0.08, 0.34, 0.2, -0.24],
    [0.72, 0.04, 0.35, 0.18, 0.2],
    [0.04, 0.7, 0.28, 0.26, 0.16],
    [0.76, 0.68, 0.28, 0.25, -0.22],
    [0.12, 0.39, 0.2, 0.1, -0.42],
    [0.7, 0.45, 0.22, 0.1, 0.38],
  ] as const;

  context.save();
  context.globalCompositeOperation = "source-over";
  shards.forEach(([x, y, shardWidth, shardHeight, rotation], index) => {
    const scaledWidth = shardWidth * 2;
    const scaledHeight = shardHeight * 2;
    const positionShiftX =
      (streetNoise(sync.beatIndex * 43 + index * 17) - 0.5) * width * 0.24;
    const positionShiftY =
      (streetNoise(sync.beatIndex * 61 + index * 29) - 0.5) * height * 0.2;
    const centerX =
      width * x + width * shardWidth * 0.5 + positionShiftX;
    const centerY =
      height * y + height * shardHeight * 0.5 + positionShiftY;
    context.save();
    context.translate(centerX, centerY);
    context.rotate(
      rotation +
        scene * 0.09 +
        (streetNoise(sync.beatIndex * 79 + index * 31) - 0.5) * 0.42,
    );
    context.globalAlpha = 1;
    context.fillStyle =
      index % 3 === 0 ? "#080b17" : index % 3 === 1 ? "#101426" : "#060914";
    context.beginPath();
    context.moveTo(-width * scaledWidth * 0.55, -height * scaledHeight * 0.18);
    context.lineTo(width * scaledWidth * 0.46, -height * scaledHeight * 0.5);
    context.lineTo(width * scaledWidth * 0.3, height * scaledHeight * 0.44);
    context.lineTo(-width * scaledWidth * 0.42, height * scaledHeight * 0.2);
    context.closePath();
    context.fill();
    context.lineWidth = Math.max(2, minSide * 0.006);
    context.strokeStyle = index % 2 === 0 ? "#181d33" : "#20263d";
    context.stroke();
    context.restore();
  });

  const burstPositions = [
    [0.08, 0.56, 0.13],
    [0.92, 0.28, 0.11],
    [0.6, 0.08, 0.08],
    [0.43, 0.91, 0.09],
  ] as const;
  burstPositions.forEach(([, , size], index) => {
    const radius = minSide * size * 2;
    const positionIndex = (index + scene) % burstPositions.length;
    const [positionX, positionY] = burstPositions[positionIndex];
    const randomX =
      (streetNoise(sync.beatIndex * 97 + index * 41) - 0.5) * width * 0.22;
    const randomY =
      (streetNoise(sync.beatIndex * 83 + index * 53) - 0.5) * height * 0.2;
    polygonPath(
      context,
      sharpBurstPoints(
        width * positionX + randomX,
        height * positionY + randomY,
        radius * 0.28,
        radius,
        5 + ((index + scene) % 3),
        index * 0.7 +
          scene * 0.2 +
          streetNoise(sync.beatIndex * 71 + index * 37) * 0.5,
      ),
    );
    context.globalAlpha = 1;
    context.fillStyle =
      index % 2 === 0 ? "#090c18" : "#121628";
    context.fill();
    context.lineWidth = Math.max(2, minSide * 0.004);
    context.strokeStyle = "#20263b";
    context.stroke();
  });

  context.globalAlpha = 0.76;
  context.fillStyle = "rgba(12,15,28,0.94)";
  for (let index = 0; index < 7; index += 1) {
    const x =
      width * (0.08 + ((index * 0.173 + scene * 0.19) % 0.84));
    const y = height * (0.12 + ((index * 0.237 + scene * 0.07) % 0.74));
    const barWidth = minSide * (0.055 + (index % 3) * 0.025);
    const barHeight = minSide * (0.009 + (index % 2) * 0.006);
    context.save();
    context.translate(x, y);
    context.rotate((index % 2 === 0 ? -1 : 1) * (0.18 + index * 0.07));
    context.fillRect(-barWidth / 2, -barHeight / 2, barWidth, barHeight);
    context.restore();
  }

  if (sync.beatHit > 0.08) {
    const glitchAlpha = Math.min(1, 0.8 + sync.beatHit * 0.2);
    const glitchCount =
      sync.eightHit > 0 || sync.secondaryHit > 0 ? 12 : 4;
    const centerX = width * 0.5;
    const centerY = height * 0.52;
    context.globalCompositeOperation = "screen";
    for (let index = 0; index < glitchCount; index += 1) {
      const angle =
        streetNoise(
          sync.beatIndex * 101 + index * 37 + index * index * 11,
        ) *
        Math.PI *
        2;
      const radius =
        minSide *
        (0.17 +
          streetNoise(
            sync.beatIndex * 173 + index * 83 + index * index * 19,
          ) *
            0.34);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.82;
      const glitchWidth =
        minSide *
        (0.025 +
          streetNoise(sync.beatIndex * 67 + index * 47) * 0.064);
      const glitchHeight =
        minSide *
        (0.006 +
          streetNoise(sync.beatIndex * 79 + index * 31) * 0.008);
      const kick =
        Math.sin(clock * 64 + index * 2.3) * sync.beatHit * minSide * 0.025;
      context.globalAlpha = glitchAlpha * (index % 4 === 0 ? 0.76 : 0.96);
      context.fillStyle =
        index % 7 === 0
          ? "rgba(226,232,246,0.62)"
          : palette[(index + scene) % palette.length];
      context.fillRect(x + kick, y, glitchWidth, glitchHeight);
      context.globalAlpha = glitchAlpha * 0.62;
      context.fillStyle = "rgba(2,3,9,0.82)";
      context.fillRect(
        x + kick - minSide * 0.008,
        y + glitchHeight * 0.45,
        glitchWidth * 0.72,
        glitchHeight * 0.42,
      );
    }

  }

  if (sync.beatStarted) {
    context.globalCompositeOperation = "screen";
    context.globalAlpha = 0.88;
    context.fillStyle = "#ffffff";
    for (let index = 0; index < 27; index += 1) {
      const particleX =
        streetNoise(sync.beatIndex * 89 + index * 23) * width;
      const particleY =
        streetNoise(sync.beatIndex * 61 + index * 37) * height;
      const size =
        minSide *
        (0.0036 + streetNoise(sync.beatIndex * 47 + index * 29) * 0.004);
      const skew =
        (streetNoise(sync.beatIndex * 31 + index * 43) - 0.5) * size;
      context.beginPath();
      context.moveTo(particleX - size * 0.5 + skew, particleY - size * 0.5);
      context.lineTo(particleX + size * 0.5, particleY - size * 0.4 - skew);
      context.lineTo(particleX + size * 0.45 - skew, particleY + size * 0.5);
      context.lineTo(particleX - size * 0.5, particleY + size * 0.42 + skew);
      context.closePath();
      context.fill();
    }
  }
  context.restore();
}

function drawStreetComposition(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sync: {
    beatHit: number;
    beatStarted: boolean;
    beatIndex: number;
    beforeAudio: boolean;
    progress: number;
  },
  clock: number,
) {
  const minSide = Math.min(width, height);
  const scene = sync.beatIndex % STREET_LAYOUTS.length;

  STREET_LAYOUTS[scene].forEach((current, index) => {
    const randomX =
      (streetNoise(sync.beatIndex * 37 + index * 11) - 0.5) * width * 0.14;
    const randomY =
      (streetNoise(sync.beatIndex * 53 + index * 17) - 0.5) * height * 0.13;
    const motif: StreetMotif = {
      ...current,
      x: width * (0.5 + (current.x - 0.5) * 0.68) + randomX,
      y: height * (0.52 + (current.y - 0.52) * 0.7) + randomY,
    };
    drawStreetMotif(
      context,
      motif,
      minSide,
      sync.beatHit,
      sync.beforeAudio,
      clock,
      index,
    );
  });
}

function drawStreetGraphic(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sync: {
    beatHit: number;
    beatStarted: boolean;
    beatIndex: number;
    beforeAudio: boolean;
    cuePressure: number;
    eightHit: number;
    preRollHit: number;
    secondaryHit: number;
    sectionIndex: number;
    progress: number;
  },
  clock: number,
) {
  const sideSequence = [3, 4, 5, 6, 3, 4, 5, 6];
  const sideCount = sideSequence[sync.beatIndex % 8];
  const beatWeight =
    sync.eightHit > 0 ? 1.25 : sync.secondaryHit > 0 ? 0.92 : 0.48;
  const impactHit = Math.max(
    sync.beatHit * beatWeight,
    sync.preRollHit * 0.48,
  );
  const breathWave = sync.beforeAudio ? Math.sin(clock * 1.7) : 0;
  const polygonBreath = 1 + breathWave * 0.035;
  const points = streetPolygonPoints(
    width,
    height,
    sideCount,
    impactHit,
    clock,
    sync.beatIndex,
    polygonBreath,
  );
  const minSide = Math.min(width, height);
  const pulse =
    1 +
    breathWave * 0.018 +
    impactHit * 0.035 +
    sync.eightHit * 0.055;
  const centerX = width / 2;
  const centerY = height * 0.52;
  const fillPalette = STREET_POLYGON_PALETTES[sync.beatIndex % 8];
  const fillShift = (sync.beatIndex % 4) * 0.035;

  drawStreetBackdrop(context, width, height, sync, clock);

  context.save();
  context.translate(
    centerX + Math.sin(clock * 63) * impactHit * minSide * 0.0045,
    centerY + Math.cos(clock * 67) * impactHit * minSide * 0.004,
  );
  context.scale(pulse, pulse);
  context.translate(-centerX, -centerY);

  drawStreetComposition(
    context,
    width,
    height,
    { ...sync, beatHit: impactHit },
    clock,
  );

  context.save();
  context.globalCompositeOperation = "screen";
  context.filter = `blur(${minSide * 0.018}px)`;
  const breathGlow = sync.beforeAudio ? (breathWave + 1) * 0.035 : 0;
  context.fillStyle = `rgba(0,225,238,${0.2 + breathGlow})`;
  polygonPath(context, points, -minSide * 0.012, minSide * 0.006);
  context.fill();
  context.fillStyle = `rgba(255,30,134,${0.22 + breathGlow})`;
  polygonPath(context, points, minSide * 0.013, -minSide * 0.006);
  context.fill();
  context.restore();

  context.save();
  polygonPath(context, points);
  context.clip();
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);

  context.globalCompositeOperation = "lighter";
  context.fillStyle = fillPalette[0];
  context.fillRect(0, 0, width, height);

  context.fillStyle = fillPalette[1];
  context.beginPath();
  context.moveTo(width * (0.24 + fillShift), height * 0.2);
  context.lineTo(width * (0.54 + fillShift * 0.5), height * 0.18);
  context.lineTo(width * (0.44 - fillShift), height * 0.64);
  context.lineTo(width * 0.18, height * (0.7 + fillShift));
  context.closePath();
  context.fill();

  context.fillStyle = fillPalette[2];
  context.beginPath();
  context.moveTo(width * (0.46 - fillShift), height * 0.18);
  context.lineTo(width * 0.8, height * (0.29 + fillShift));
  context.lineTo(width * (0.72 - fillShift * 0.5), height * 0.68);
  context.lineTo(width * (0.42 + fillShift), height * 0.57);
  context.closePath();
  context.fill();

  context.fillStyle = fillPalette[3];
  context.beginPath();
  context.moveTo(width * (0.34 - fillShift), height * 0.57);
  context.lineTo(width * 0.74, height * (0.52 - fillShift));
  context.lineTo(width * (0.64 + fillShift), height * 0.83);
  context.lineTo(width * 0.28, height * (0.78 - fillShift));
  context.closePath();
  context.fill();

  context.fillStyle = sync.beatIndex % 3 === 0 ? "#b7f20a" : "#f4f7ff";
  context.globalAlpha = sync.beatIndex % 3 === 0 ? 0.82 : 0.68;
  context.beginPath();
  context.moveTo(width * (0.3 + fillShift), height * 0.33);
  context.lineTo(width * (0.4 + fillShift), height * 0.29);
  context.lineTo(width * (0.37 + fillShift), height * 0.42);
  context.closePath();
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = "rgba(3,4,8,0.76)";
  context.beginPath();
  context.moveTo(width * 0.34, height * (0.46 + fillShift));
  context.lineTo(width * 0.72, height * (0.36 + fillShift));
  context.lineTo(width * 0.68, height * (0.43 + fillShift));
  context.lineTo(width * 0.3, height * (0.54 + fillShift));
  context.closePath();
  context.fill();

  context.globalAlpha = 0.22;
  context.fillStyle = "#050609";
  const dotStep = Math.max(7, minSide * 0.015);
  const dotRadius = Math.max(0.8, minSide * 0.0018);
  for (let y = height * 0.27; y < height * 0.78; y += dotStep) {
    for (let x = width * 0.25; x < width * 0.76; x += dotStep) {
      if ((Math.round(x / dotStep) + Math.round(y / dotStep)) % 3 !== 0) {
        continue;
      }
      context.beginPath();
      context.arc(x, y, dotRadius, 0, Math.PI * 2);
      context.fill();
    }
  }

  const grainAlpha = 0.035 + sync.beatHit * 0.025;
  for (let index = 0; index < 80; index += 1) {
    const x =
      width * 0.24 +
      ((index * 73 + sync.beatIndex * 17) % 503) / 503 * width * 0.52;
    const y =
      height * 0.24 +
      ((index * 47 + sync.sectionIndex * 29) % 397) / 397 * height * 0.56;
    context.fillStyle =
      index % 5 === 0
        ? `rgba(245,247,255,${grainAlpha * 1.8})`
        : `rgba(0,0,0,${grainAlpha})`;
    context.fillRect(x, y, 1.2, 1.2);
  }
  context.restore();

  context.save();
  context.lineJoin = "bevel";
  context.lineWidth = Math.max(2, minSide * 0.007);
  context.strokeStyle = "rgba(4,5,9,0.92)";
  polygonPath(context, points);
  context.stroke();
  context.lineWidth = Math.max(1, minSide * 0.0024);
  context.strokeStyle = "rgba(244,247,255,0.9)";
  polygonPath(context, points, -minSide * 0.004, 0);
  context.stroke();
  context.strokeStyle = "rgba(0,225,238,0.82)";
  polygonPath(context, points, minSide * 0.005, minSide * 0.002);
  context.stroke();
  context.restore();

  context.restore();
}

export function PerformanceStageRenderer({
  time,
  beats,
  countdownBeats,
  template,
  playing,
  showBeatCode,
  showSectionRail,
  beatCodePositions,
  railPositions,
  visualLeadMs,
  secondaryAccentCount,
  signalOnly = false,
}: PerformanceStageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualTime = time + visualLeadMs / 1000;
  const beatIndex = beats.length ? beatIndexAtTime(beats, visualTime) : 0;
  const currentBeatTime = beats[beatIndex] ?? 0;
  const nextBeatTime = beats[beatIndex + 1];
  const progress =
    nextBeatTime != null && nextBeatTime > currentBeatTime
      ? Math.max(
          0,
          Math.min(
            1,
            (visualTime - currentBeatTime) / (nextBeatTime - currentBeatTime),
          ),
        )
      : 0;
  const countIndex = beatIndex % 8;
  const beatHasStarted = beats.length > 0 && visualTime >= beats[0];
  const beforeAudio = beats.length > 0 && visualTime < beats[0];
  const preRoll = trackedBeatPreRoll(visualTime, countdownBeats);
  const preRollHit =
    playing && preRoll ? Math.max(0, 1 - preRoll.phase * 4) : 0;
  const beatHit =
    playing && beatHasStarted ? Math.max(0, 1 - progress * 4) : 0;
  const eightHit = countIndex === 0 ? beatHit : 0;
  const secondaryHit =
    secondaryAccentCount > 1 && countIndex === secondaryAccentCount - 1
      ? beatHit
      : 0;
  const sections = useMemo(() => buildSections(beats.length), [beats.length]);
  const sectionIndex = Math.max(
    0,
    Math.min(
      Math.max(0, sections.length - 1),
      Math.max(0, Math.floor(beatIndex / 32)),
    ),
  );
  const sectionColor =
    sections[sectionIndex]?.color ?? SECTION_COLORS[sectionIndex % SECTION_COLORS.length];
  const sectionEnd = sections[sectionIndex]?.endBeat ?? (sectionIndex + 1) * 32;
  const cuePressure = Math.max(0, Math.min(1, 1 - (sectionEnd - beatIndex) / 16));
  const syncRef = useRef({
    beatHit,
    beatStarted: beatHasStarted,
    beatIndex,
    beforeAudio,
    cuePressure,
    eightHit,
    playing,
    preRollHit,
    progress,
    secondaryHit,
    sectionIndex,
  });

  useEffect(() => {
    syncRef.current = {
      beatHit,
      beatStarted: beatHasStarted,
      beatIndex,
      beforeAudio,
      cuePressure,
      eightHit,
      playing,
      preRollHit,
      progress,
      secondaryHit,
      sectionIndex,
    };
  }, [
    beatHit,
    beatHasStarted,
    beatIndex,
    beforeAudio,
    cuePressure,
    eightHit,
    playing,
    preRollHit,
    progress,
    secondaryHit,
    sectionIndex,
  ]);

  useEffect(() => {
    if (signalOnly) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    let previousFrameTime = performance.now() / 1000;
    let pulseFlowPhase = 0;
    const particleCount =
      template === "minimal" ? 28 : template === "pulse" ? 0 : 96;
    const particles = Array.from({ length: particleCount }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.35 + Math.random() * 1.2,
      size: 0.55 + Math.random() * 1.35,
      phase: Math.random() * Math.PI * 2,
      hue: index % PARTICLE_COLORS.length,
    }));

    const draw = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (
        canvas.width !== Math.round(width * dpr) ||
        canvas.height !== Math.round(height * dpr)
      ) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      context.filter = "none";
      context.shadowBlur = 0;
      context.shadowColor = "transparent";
      context.lineCap = "butt";
      context.lineJoin = "miter";
      context.lineWidth = 1;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      const sync = syncRef.current;
      const energy = sync.playing ? 1 : 0.38;
      const cue = sync.cuePressure * sync.cuePressure;
      const constellationCuePressure =
        sync.beatStarted && Math.floor(sync.beatIndex / 8) % 2 === 0
          ? (8 + (sync.beatIndex % 8)) / 16
          : 0;
      const constellationCue =
        constellationCuePressure * constellationCuePressure;
      const constellationRelease =
        sync.beatStarted &&
        Math.floor(sync.beatIndex / 8) % 2 === 1 &&
        sync.beatIndex % 8 === 0;
      const constellationBurstProgress = constellationRelease
        ? Math.min(1, sync.progress * 1.05)
        : 0;
      const constellationBurstTravel =
        constellationBurstProgress *
        constellationBurstProgress *
        (3 - 2 * constellationBurstProgress);
      const constellationBurstFadeProgress = Math.max(
        0,
        Math.min(1, (constellationBurstTravel - 0.72) / 0.28),
      );
      const constellationBurstFade =
        1 -
        constellationBurstFadeProgress *
          constellationBurstFadeProgress *
          (3 - 2 * constellationBurstFadeProgress);
      const clock = now / 1000;
      const frameDelta = Math.min(1 / 30, Math.max(0, clock - previousFrameTime));
      previousFrameTime = clock;
      const preAudioBreath = sync.beforeAudio
        ? 0.5 + Math.sin(clock * 1.45) * 0.5
        : 0;
      if (template === "street") {
        drawStreetGraphic(context, width, height, sync, clock);
      } else if (template === "pulse") {
        const beatFlow = Math.max(
          sync.beatHit * 0.93,
          sync.secondaryHit * 4.96,
          sync.eightHit * 4.96,
          sync.preRollHit * 0.55,
        );
        const flowSpeed = sync.playing ? 0.11 + beatFlow * 5.2 : 0.035;
        pulseFlowPhase += frameDelta * flowSpeed;

        context.save();
        context.globalCompositeOperation = "source-over";
        context.filter = "none";
        context.shadowBlur = 0;
        context.shadowColor = "transparent";
        context.fillStyle = "#000000";
        context.fillRect(0, 0, width, height);

        const columns = Math.max(48, Math.ceil(width / 14));
        const rows = Math.max(27, Math.ceil(height / 14));
        const cellWidth = width / columns;
        const cellHeight = height / rows;
        const dotDiameter = Math.min(cellWidth, cellHeight) * 0.96;
        const centerColumn = (columns - 1) / 2;
        const centerRow = (rows - 1) / 2;
        const pulsePalette =
          PULSE_PALETTES[
            Math.floor(sync.beatIndex / 16) % PULSE_PALETTES.length
          ];

        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const gridX = column - centerColumn;
            const gridY = centerRow - row;
            const distance = Math.hypot(gridX, gridY);
            const fieldDistance = Math.max(distance, 2.4);
            const radialWave =
              4.2 * Math.log(fieldDistance);
            const angularWave =
              distance > 0 ? 4 * Math.atan2(gridY, gridX) : 0;
            const field = Math.cos(
              Math.cos(radialWave - pulseFlowPhase) +
                2 *
                  Math.cos(
                    angularWave -
                      pulseFlowPhase -
                      Math.abs(Math.sin(radialWave - pulseFlowPhase)),
                  ),
            );
            const centerScale =
              distance < 1.8
                ? 0.42
                : distance < 3.2
                  ? 0.58
                  : distance < 4.8
                    ? 0.76
                    : 1;
            const leftEdgeScale =
              column < 5
                ? 0.24 + (column / 4) * 0.76
                : 1;
            const radius =
              (dotDiameter *
                Math.abs(2 / (1 + Math.exp(-5 * field)) - 1) *
                centerScale *
                leftEdgeScale) /
              2;
            const heartColorPhase =
              radialWave * 0.24 +
              angularWave * 0.18 -
              pulseFlowPhase * 0.3 +
              sync.sectionIndex * 0.7;
            const heartColorBand =
              ((Math.floor(heartColorPhase / Math.PI) % 2) + 2) % 2;
            const heartColor = (
              pulsePalette
            )[heartColorBand];
            const normalizedDistance = Math.min(
              1,
              Math.hypot(
                gridX / Math.max(1, centerColumn),
                gridY / Math.max(1, centerRow),
              ),
            );
            const edgeProgress = Math.max(
              0,
              Math.min(1, (normalizedDistance - 0.52) / 0.48),
            );
            const edgeGradient =
              edgeProgress * edgeProgress * (3 - 2 * edgeProgress);
            const colorStrength = edgeGradient * 0.96;
            const color = `rgb(${Math.round(
              255 + (heartColor[0] - 255) * colorStrength,
            )},${Math.round(
              255 + (heartColor[1] - 255) * colorStrength,
            )},${Math.round(
              255 + (heartColor[2] - 255) * colorStrength,
            )})`;

            if (field >= 0) {
              const whiteDotSeed = streetNoise(
                column * 19.37 +
                  row * row * 7.13 +
                  column * row * 3.71 +
                  sync.beatIndex * 101.9,
              );
              if (whiteDotSeed > 0.014) {
                continue;
              }
              context.beginPath();
              context.fillStyle = "#ffffff";
              context.arc(
                (column + 0.5) * cellWidth,
                (row + 0.5) * cellHeight,
                dotDiameter * (0.07 + whiteDotSeed * 1.8),
                0,
                Math.PI * 2,
              );
              context.fill();
              continue;
            }
            context.beginPath();
            context.fillStyle = color;
            context.arc(
              (column + 0.5) * cellWidth,
              (row + 0.5) * cellHeight,
              Math.max(0.45, radius),
              0,
              Math.PI * 2,
            );
            context.fill();
          }
        }
        context.restore();
      }

      if (template !== "street" && template !== "pulse") particles.forEach((particle, index) => {
        const color =
          template === "minimal"
            ? "241,244,255"
            : PARTICLE_COLORS[
                (particle.hue + sync.sectionIndex) % PARTICLE_COLORS.length
              ];
        const luminousHighlight =
          template === "minimal" || color === "225,231,255";
        const angle =
          particle.phase + clock * particle.speed + sync.beatIndex * 0.07;
        let x = particle.x * width;
        let y = particle.y * height;
        let size = particle.size;
        let alpha = 0.18 + cue * 0.24;
        let particleCue = cue;

        if (template === "constellation") {
          particleCue = constellationCue;
          const targetAngle =
            (index / particles.length) * Math.PI * 2 + clock * 0.4;
          const radius =
            Math.min(width, height) * (0.12 + (index % 8) * 0.015);
          const pull = Math.max(0.18, constellationCue);
          x += (width / 2 + Math.cos(targetAngle) * radius - x) * pull;
          y += (height / 2 + Math.sin(targetAngle) * radius - y) * pull;
          size *=
            1.6 +
            constellationCue * 3.8 +
            sync.eightHit +
            preAudioBreath * 0.26 +
            sync.preRollHit * 0.82;
          alpha =
            0.16 +
            constellationCue * 0.52 +
            preAudioBreath * 0.06 +
            sync.preRollHit * 0.12;
          if (constellationRelease) {
            const burstAngle = Math.atan2(
              particle.y - 0.5,
              particle.x - 0.5,
            );
            const startRadius =
              Math.min(width, height) * (0.12 + (index % 8) * 0.015);
            const directionX = Math.cos(burstAngle);
            const directionY = Math.sin(burstAngle);
            const horizontalEdgeRadius =
              directionX >= 0
                ? width / 2 / Math.max(directionX, 0.001)
                : -width / 2 / Math.min(directionX, -0.001);
            const verticalEdgeRadius =
              directionY >= 0
                ? height / 2 / Math.max(directionY, 0.001)
                : -height / 2 / Math.min(directionY, -0.001);
            const burstRadius =
              Math.min(horizontalEdgeRadius, verticalEdgeRadius) +
              90 +
              ((index * 17) % 9) * 12;
            const releaseRadius =
              startRadius +
              (burstRadius - startRadius) * constellationBurstTravel;
            x = width / 2 + directionX * releaseRadius;
            y = height / 2 + directionY * releaseRadius;
            size *= 4.8 - constellationBurstTravel * 2.3;
            alpha = 0.62 * constellationBurstFade;
          }
        } else if (template === "minimal") {
          x =
            width * 0.5 +
            Math.cos(angle + index) * (80 + (index % 8) * 18);
          y =
            height * 0.52 +
            Math.sin(angle + index) * (80 + (index % 8) * 18);
          size =
            1.2 +
            sync.eightHit * (index % 8 === 0 ? 2.4 : 0.7) +
            sync.preRollHit * (index % 4 === 0 ? 1.4 : 0.4);
          alpha = 0.1 + cue * 0.12 + sync.preRollHit * 0.16;
        } else {
          y = height * (0.45 + Math.sin(angle) * 0.18);
          x += Math.cos(angle * 0.3) * 28;
          size *= 0.8 + cue + sync.eightHit;
          alpha = 0.08 + cue * 0.16;
        }

        context.beginPath();
        context.fillStyle = `rgba(${color},${
          luminousHighlight
            ? Math.max(0.58, alpha * energy)
            : alpha * energy
        })`;
        context.shadowBlur =
          (luminousHighlight ? 16 : 10) +
          particleCue * 24 +
          sync.eightHit * 12 +
          (template === "constellation"
            ? preAudioBreath * 4 + sync.preRollHit * 10
            : 0);
        context.shadowColor = `rgba(${color},.72)`;
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();

      });

      context.globalCompositeOperation = "source-over";
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [signalOnly, template]);

  const visualBeatHit =
    beforeAudio && (template === "constellation" || template === "minimal")
      ? preRollHit * (template === "minimal" ? 0.48 : 0.65)
      : beatHit;
  const minimalImpact = Math.max(
    beatHit * 0.72,
    secondaryHit * 1.5,
    eightHit * 2.35,
    beforeAudio ? preRollHit * 0.65 : 0,
  );
  const minimalHeavyHit = Math.max(secondaryHit, eightHit);
  const style = {
    "--section-color": sectionColor,
    "--cue-pressure": cuePressure,
    "--beat-hit": visualBeatHit,
    "--eight-hit": eightHit,
    "--secondary-hit": secondaryHit,
    "--minimal-heavy-hit": minimalHeavyHit,
    "--minimal-impact": minimalImpact,
    "--ring-impact": minimalImpact,
    "--count-angle": `${((countIndex + progress) / 8) * 360}deg`,
  } as CSSProperties;

  return (
    <div
      className={`performance-stage performance-stage-${template} ${
        signalOnly ? "performance-stage-signal-only" : ""
      } ${beforeAudio ? "performance-stage-pre-audio" : ""}`}
      style={style}
    >
      {!signalOnly && (
        <>
          <canvas ref={canvasRef} className="performance-stage-canvas" />
          <div className="performance-stage-grid" />
          <div className="performance-stage-aura" />
          <div className="performance-stage-disc" />
          <div className="performance-stage-downbeat" />
          <div className="performance-stage-cue">
            <span />
            <span />
          </div>
        </>
      )}

      {showBeatCode &&
        beatCodePositions.map((position) => (
          <div
            key={position}
            className={`performance-beat-code performance-pos-${position}`}
          >
            {Array.from({ length: 8 }, (_, index) => (
              <span
                key={index}
                className={`${index === countIndex ? "active" : ""} ${
                  index === 0 && countIndex === 0 ? "downbeat" : ""
                } ${
                  secondaryAccentCount > 1 &&
                  index === secondaryAccentCount - 1
                    ? "secondary"
                    : ""
                }`}
              />
            ))}
          </div>
        ))}

      {showSectionRail &&
        railPositions.map((position) => (
          <div
            key={position}
            className={`performance-section-rail performance-pos-${position}`}
            style={{ "--rail-count": Math.max(1, Math.ceil(beats.length / 8)) } as CSSProperties}
          >
            {Array.from(
              { length: Math.max(1, Math.ceil(beats.length / 8)) },
              (_, index) => {
                const currentEight = Math.floor(beatIndex / 8);
                const markerSection = Math.floor(index / 4);
                return (
                  <i
                    key={index}
                    className={`${index < currentEight ? "completed" : ""} ${
                      index === currentEight ? "current" : ""
                    } ${index % 4 === 0 ? "section-start" : ""}`}
                    style={{
                      "--rail-color":
                        SECTION_COLORS[markerSection % SECTION_COLORS.length],
                    } as CSSProperties}
                  />
                );
              },
            )}
          </div>
        ))}
    </div>
  );
}
