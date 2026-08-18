import { drawStreetGraphic } from "@/components/PerformanceStageRenderer";
import type { GeneratedStageTemplate } from "./types";

export interface StageVisualSync {
  beatHit: number;
  beatStarted: boolean;
  beatIndex: number;
  beforeAudio: boolean;
  cuePressure: number;
  eightHit: number;
  playing?: boolean;
  preRollHit: number;
  progress: number;
  secondaryHit: number;
  sectionIndex: number;
}

interface StageParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
  hue: number;
}

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

function noise(seed: number) {
  const value = Math.sin(seed * 78.233 + 19.19) * 43758.5453;
  return value - Math.floor(value);
}

function streetNoise(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function drawPulseGraphic(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sync: StageVisualSync,
  pulseFlowPhase: number,
) {
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
      const radialWave = 4.2 * Math.log(fieldDistance);
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
        column < 5 ? 0.24 + (column / 4) * 0.76 : 1;
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
      const heartColor = pulsePalette[heartColorBand];
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
        if (whiteDotSeed > 0.014) continue;
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

function createParticles(count: number): StageParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    x: noise(index * 7 + 1),
    y: noise(index * 7 + 2),
    speed: 0.35 + noise(index * 7 + 3) * 1.2,
    size: 0.55 + noise(index * 7 + 4) * 1.35,
    phase: noise(index * 7 + 5) * Math.PI * 2,
    hue: index % PARTICLE_COLORS.length,
  }));
}

function resetContext(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.filter = "none";
  context.shadowBlur = 0;
  context.shadowColor = "transparent";
  context.lineCap = "butt";
  context.lineJoin = "miter";
  context.lineWidth = 1;
  context.clearRect(0, 0, width, height);
}

function drawStreetBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#010207");
  background.addColorStop(0.48, "#070a16");
  background.addColorStop(1, "#020104");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const centerGlow = context.createRadialGradient(
    width * 0.5,
    height * 0.54,
    0,
    width * 0.5,
    height * 0.54,
    Math.max(width, height) * 0.52,
  );
  centerGlow.addColorStop(0, "rgba(46,62,154,0.22)");
  centerGlow.addColorStop(0.24, "rgba(27,22,92,0.12)");
  centerGlow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = centerGlow;
  context.fillRect(0, 0, width, height);
}

function drawConstellationBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#020105");
  background.addColorStop(0.42, "#08050c");
  background.addColorStop(1, "#010102");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const center = context.createRadialGradient(
    width * 0.5,
    height * 0.5,
    0,
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.34,
  );
  center.addColorStop(0, "rgba(101,73,232,0.075)");
  center.addColorStop(1, "rgba(101,73,232,0)");
  context.fillStyle = center;
  context.fillRect(0, 0, width, height);

  const upper = context.createRadialGradient(
    width * 0.72,
    height * 0.22,
    0,
    width * 0.72,
    height * 0.22,
    Math.min(width, height) * 0.28,
  );
  upper.addColorStop(0, "rgba(235,76,97,0.07)");
  upper.addColorStop(1, "rgba(235,76,97,0)");
  context.fillStyle = upper;
  context.fillRect(0, 0, width, height);
}

function drawMinimalBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#020203");
  background.addColorStop(0.5, "#080808");
  background.addColorStop(1, "#010101");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
}

function drawPerspectiveGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  beatHit: number,
) {
  const horizon = height * (0.72 - beatHit * 0.02);
  context.save();
  context.globalAlpha = 0.1;
  context.strokeStyle = "rgba(72,96,160,0.32)";
  context.lineWidth = 1;
  for (let row = 0; row < 8; row += 1) {
    const progress = row / 7;
    const y = horizon + progress * progress * height * 0.38;
    context.beginPath();
    context.moveTo(-width * 0.1, y);
    context.lineTo(width * 1.1, y);
    context.stroke();
  }
  for (let column = -9; column <= 9; column += 1) {
    context.beginPath();
    context.moveTo(width * 0.5, horizon);
    context.lineTo(
      width * 0.5 + column * width * 0.085,
      height * 1.1,
    );
    context.stroke();
  }
  context.restore();
}

function drawAura(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sync: StageVisualSync,
  sectionColor: string,
) {
  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const radius = Math.min(width * 0.32, 380);
  const glow = context.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    radius,
  );
  glow.addColorStop(0, "rgba(255,255,255,0.055)");
  glow.addColorStop(0.24, "rgba(101,73,232,0.15)");
  glow.addColorStop(
    0.52,
    `rgba(180,52,151,${0.04 + sync.cuePressure * 0.14})`,
  );
  glow.addColorStop(0.72, `rgba(235,76,97,${sync.secondaryHit * 0.17})`);
  glow.addColorStop(0.86, `rgba(240,137,69,${sync.eightHit * 0.13})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = 0.34;
  context.filter = `blur(${Math.max(12, radius * 0.06)}px) saturate(1.7)`;
  context.fillStyle = glow;
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    radius * (0.9 + sync.beatHit * 0.05),
    radius * (0.84 + sync.beatHit * 0.05),
    ((sync.beatIndex + sync.progress) / 8) * Math.PI * 2,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.filter = "none";
  context.shadowBlur = radius * 0.16;
  context.shadowColor = sectionColor;
  context.strokeStyle = sectionColor;
  context.globalAlpha = 0.12;
  context.stroke();
  context.restore();
}

function createLayerCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function drawMaskedDisc(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: "constellation" | "minimal",
  sync: StageVisualSync,
  clock: number,
) {
  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const impact = Math.max(
    sync.beatHit * 0.72,
    sync.secondaryHit * 1.5,
    sync.eightHit * 2.35,
    sync.beforeAudio ? sync.preRollHit * 0.65 : 0,
  );
  const baseSize =
    template === "minimal"
      ? Math.min(width * 0.34, 420)
      : Math.min(width * 0.46, 560);
  const preAudioBreath =
    sync.beforeAudio && template === "constellation"
      ? 0.9 + (0.5 + Math.sin(clock * 1.45) * 0.5) * 0.025
      : 1;
  const scale = (0.88 + impact * 0.16) * preAudioBreath;
  const size = baseSize * scale;
  const layer = createLayerCanvas(size, size);
  const layerContext = layer.getContext("2d");
  if (!layerContext) return;
  const center = size / 2;
  layerContext.beginPath();
  layerContext.arc(center, center, Math.max(0, center - 1), 0, Math.PI * 2);
  layerContext.clip();

  if (template === "constellation") {
    const angle =
      (((sync.beatIndex % 8) + sync.progress) / 8) * Math.PI * 2 -
      Math.PI / 2;
    const gradient = layerContext.createConicGradient(angle, center, center);
    [
      [0, "rgba(38,70,176,0.42)"],
      [0.16, "rgba(49,94,232,0.72)"],
      [0.28, "rgba(77,102,232,0.82)"],
      [0.4, "rgba(101,73,232,0.8)"],
      [0.49, "rgba(132,67,214,0.76)"],
      [0.59, "rgba(180,52,151,0.78)"],
      [0.68, "rgba(222,65,107,0.82)"],
      [0.76, "rgba(240,93,75,0.86)"],
      [0.82, "rgba(244,137,69,0.8)"],
      [0.87, `rgba(255,210,180,${0.72 + sync.eightHit * 0.16})`],
      [0.9, `rgba(241,244,255,${0.84 + sync.eightHit * 0.12})`],
      [0.94, "rgba(137,139,242,0.7)"],
      [1, "rgba(38,70,176,0.42)"],
    ].forEach(([stop, color]) =>
      gradient.addColorStop(stop as number, color as string),
    );
    layerContext.fillStyle = gradient;
  } else {
    const gradient = layerContext.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      Math.hypot(center, center),
    );
    gradient.addColorStop(0, "rgba(255,255,255,0.02)");
    gradient.addColorStop(0.42, "rgba(255,255,255,0.07)");
    gradient.addColorStop(0.68, "rgba(255,255,255,0.5)");
    gradient.addColorStop(0.78, "rgba(255,255,255,0.92)");
    gradient.addColorStop(0.91, "rgba(255,255,255,0.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    layerContext.fillStyle = gradient;
  }
  layerContext.fillRect(0, 0, size, size);

  layerContext.globalCompositeOperation = "destination-in";
  const mask = layerContext.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    Math.hypot(center, center),
  );
  mask.addColorStop(0, "rgba(0,0,0,0)");
  mask.addColorStop(0.38, "rgba(0,0,0,0)");
  mask.addColorStop(0.45, "rgba(0,0,0,0.08)");
  mask.addColorStop(0.57, "rgba(0,0,0,0.72)");
  mask.addColorStop(0.64, "rgba(0,0,0,1)");
  mask.addColorStop(0.7, "rgba(0,0,0,1)");
  mask.addColorStop(0.77, "rgba(0,0,0,0.76)");
  mask.addColorStop(0.88, "rgba(0,0,0,0.12)");
  mask.addColorStop(0.96, "rgba(0,0,0,0)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  layerContext.fillStyle = mask;
  layerContext.fillRect(0, 0, size, size);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = 0.96;
  context.shadowBlur = template === "minimal" ? 34 : 64;
  context.shadowColor =
    template === "minimal"
      ? "rgba(255,255,255,0.2)"
      : "rgba(101,73,232,0.34)";
  context.drawImage(layer, centerX - size / 2, centerY - size / 2);
  context.restore();

  context.save();
  context.globalAlpha = 0.96;
  const borderWidth = 2 * scale;
  context.strokeStyle =
    template === "minimal"
      ? "rgba(255,255,255,0.92)"
      : `rgba(235,239,255,${0.3 + sync.beatHit * 0.12 + sync.eightHit * 0.12})`;
  context.lineWidth = borderWidth;
  context.beginPath();
  context.arc(
    centerX,
    centerY,
    size / 2 - borderWidth / 2,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.restore();
}

function drawDownbeat(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: "constellation" | "minimal",
  sync: StageVisualSync,
) {
  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const heavyHit = Math.max(sync.secondaryHit, sync.eightHit);
  const hit = template === "minimal" ? heavyHit : sync.eightHit;
  if (hit <= 0.001) return;
  const lineWidth = 1 + hit * (template === "minimal" ? 2 : 3);
  const contentRadius =
    template === "minimal"
      ? width * (0.21 + heavyHit * 0.04)
      : width * (0.1 + sync.eightHit * 0.23);
  const radius = contentRadius - lineWidth / 2;
  const borderAlpha =
    template === "minimal"
      ? heavyHit * (0.34 + heavyHit * 0.5)
      : sync.eightHit * sync.eightHit * 0.75 * 0.46;
  context.save();
  context.strokeStyle = `rgba(241,244,255,${borderAlpha})`;
  context.lineWidth = lineWidth;
  if (template === "minimal") {
    context.shadowBlur = 24;
    context.shadowColor = `rgba(255,255,255,${heavyHit * 0.15})`;
  }
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();
  if (template === "minimal") {
    context.globalAlpha = heavyHit * (0.2 + heavyHit * 0.42);
    context.strokeStyle = "rgba(241,244,255,1)";
    context.lineWidth = 1;
    context.shadowBlur = 0;
    context.beginPath();
    context.arc(centerX, centerY, radius * 1.22, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawParticles(
  context: CanvasRenderingContext2D,
  template: "constellation" | "minimal",
  particles: StageParticle[],
  width: number,
  height: number,
  sync: StageVisualSync,
  clock: number,
) {
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
  const burstProgress = constellationRelease
    ? Math.min(1, sync.progress * 1.05)
    : 0;
  const burstTravel =
    burstProgress * burstProgress * (3 - 2 * burstProgress);
  const fadeProgress = Math.max(
    0,
    Math.min(1, (burstTravel - 0.72) / 0.28),
  );
  const burstFade =
    1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
  const preAudioBreath = sync.beforeAudio
    ? 0.5 + Math.sin(clock * 1.45) * 0.5
    : 0;

  context.save();
  context.globalCompositeOperation = "lighter";
  particles.forEach((particle, index) => {
    const color =
      template === "minimal"
        ? "241,244,255"
        : PARTICLE_COLORS[
            (particle.hue + sync.sectionIndex) % PARTICLE_COLORS.length
          ];
    const luminous = template === "minimal" || color === "225,231,255";
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
        const burstAngle = Math.atan2(particle.y - 0.5, particle.x - 0.5);
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
          startRadius + (burstRadius - startRadius) * burstTravel;
        x = width / 2 + directionX * releaseRadius;
        y = height / 2 + directionY * releaseRadius;
        size *= 4.8 - burstTravel * 2.3;
        alpha = 0.62 * burstFade;
      }
    } else {
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
    }

    context.beginPath();
    context.fillStyle = `rgba(${color},${
      luminous ? Math.max(0.58, alpha * energy) : alpha * energy
    })`;
    context.shadowBlur =
      (luminous ? 16 : 10) +
      particleCue * 24 +
      sync.eightHit * 12 +
      (template === "constellation"
        ? preAudioBreath * 4 + sync.preRollHit * 10
        : 0);
    context.shadowColor = `rgba(${color},.72)`;
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

export interface SharedStageRenderer {
  template: GeneratedStageTemplate;
  draw(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    sync: StageVisualSync,
    clock: number,
  ): void;
}

export function createSharedStageRenderer(
  template: GeneratedStageTemplate,
): SharedStageRenderer {
  const particles = createParticles(template === "minimal" ? 28 : 96);
  let previousClock: number | null = null;
  let pulseFlowPhase = 0;

  return {
    template,
    draw(context, width, height, sync, clock) {
      const frameDelta =
        previousClock == null
          ? 0
          : Math.min(1 / 30, Math.max(0, clock - previousClock));
      previousClock = clock;
      resetContext(context, width, height);

      if (template === "street") {
        drawStreetBackground(context, width, height);
        drawStreetGraphic(context, width, height, sync, clock);
        return;
      }

      if (template === "pulse") {
        const beatFlow = Math.max(
          sync.beatHit * 0.93,
          sync.secondaryHit * 4.96,
          sync.eightHit * 4.96,
          sync.preRollHit * 0.55,
        );
        const flowSpeed = sync.playing ? 0.11 + beatFlow * 5.2 : 0.035;
        pulseFlowPhase += frameDelta * flowSpeed;
        drawPulseGraphic(
          context,
          width,
          height,
          sync,
          pulseFlowPhase,
        );
        return;
      }

      if (template === "constellation") {
        drawConstellationBackground(context, width, height);
      } else {
        drawMinimalBackground(context, width, height);
      }
      drawPerspectiveGrid(context, width, height, sync.beatHit);
      drawParticles(
        context,
        template,
        particles,
        width,
        height,
        sync,
        clock,
      );
      drawAura(
        context,
        width,
        height,
        sync,
        PARTICLE_COLORS[sync.sectionIndex % PARTICLE_COLORS.length],
      );
      drawMaskedDisc(context, width, height, template, sync, clock);
      drawDownbeat(context, width, height, template, sync);
    },
  };
}
