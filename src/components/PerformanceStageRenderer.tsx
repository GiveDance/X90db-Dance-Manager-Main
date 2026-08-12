"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
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
  "#00eaff",
  "#b6ff00",
  "#ffd000",
  "#8e39ff",
  "#ff245f",
];

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

export function PerformanceStageRenderer({
  time,
  beats,
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
  const beatHit = Math.max(0, 1 - progress * 4);
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
    beatIndex,
    cuePressure,
    eightHit,
    playing,
    secondaryHit,
    sectionIndex,
  });

  useEffect(() => {
    syncRef.current = {
      beatHit,
      beatIndex,
      cuePressure,
      eightHit,
      playing,
      secondaryHit,
      sectionIndex,
    };
  }, [
    beatHit,
    beatIndex,
    cuePressure,
    eightHit,
    playing,
    secondaryHit,
    sectionIndex,
  ]);

  useEffect(() => {
    if (signalOnly) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    const particleCount =
      template === "minimal" ? 28 : template === "pulse" ? 42 : 96;
    const particles = Array.from({ length: particleCount }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.35 + Math.random() * 1.2,
      size: 1 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
      hue: index % 5,
    }));
    const palette = [
      "0,234,255",
      "182,255,0",
      "255,208,0",
      "142,57,255",
      "255,36,95",
    ];

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
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      const sync = syncRef.current;
      const energy = sync.playing ? 1 : 0.38;
      const cue = sync.cuePressure * sync.cuePressure;
      const clock = now / 1000;

      if (template === "pulse") {
        for (let index = 0; index < 26; index += 1) {
          const x = (index / 25) * width;
          const drift =
            Math.sin(clock * 0.42 + index * 0.7 + sync.sectionIndex) * 90;
          const gradient = context.createLinearGradient(
            x,
            height * 0.7 + drift,
            x,
            height * 0.16 + drift * 0.34,
          );
          const hue = 180 + sync.sectionIndex * 32 + index * 2;
          gradient.addColorStop(0, `hsla(${hue},100%,65%,0)`);
          gradient.addColorStop(
            0.5,
            `hsla(${hue},100%,68%,${
              (0.2 + cue * 0.28 + sync.eightHit * 0.18) * energy
            })`,
          );
          gradient.addColorStop(1, `hsla(${hue},100%,65%,0)`);
          context.strokeStyle = gradient;
          context.lineWidth = 10 + cue * 20 + sync.eightHit * 8;
          context.beginPath();
          context.moveTo(x, height * 0.7 + drift);
          context.lineTo(
            x + Math.sin(clock + index) * 80,
            height * 0.16 + drift * 0.34,
          );
          context.stroke();
        }
      }

      particles.forEach((particle, index) => {
        const color =
          palette[(particle.hue + sync.sectionIndex) % palette.length];
        const angle =
          particle.phase + clock * particle.speed + sync.beatIndex * 0.07;
        let x = particle.x * width;
        let y = particle.y * height;
        let size = particle.size;
        let alpha = 0.18 + cue * 0.24;

        if (template === "street") {
          const wave = Math.sin(angle) * 86;
          x += Math.cos(angle * 0.6) * wave;
          y += Math.sin(angle * 0.8) * wave - cue * 80;
          size *=
            1 +
            cue * 2.2 +
            sync.eightHit * 0.9 +
            sync.secondaryHit * 0.45 +
            sync.beatHit * 0.35;
        } else if (template === "constellation") {
          const targetAngle =
            (index / particles.length) * Math.PI * 2 + clock * 0.4;
          const radius =
            Math.min(width, height) * (0.12 + (index % 8) * 0.015);
          const pull = Math.max(0.18, cue);
          x += (width / 2 + Math.cos(targetAngle) * radius - x) * pull;
          y += (height / 2 + Math.sin(targetAngle) * radius - y) * pull;
          size *= 1.6 + cue * 3.8 + sync.eightHit;
          alpha = 0.16 + cue * 0.52;
        } else if (template === "minimal") {
          x =
            width * 0.5 +
            Math.cos(angle + index) * (80 + (index % 8) * 18);
          y =
            height * 0.52 +
            Math.sin(angle + index) * (80 + (index % 8) * 18);
          size = 1.2 + sync.eightHit * (index % 8 === 0 ? 2.4 : 0.7);
          alpha = 0.1 + cue * 0.12;
        } else {
          y = height * (0.45 + Math.sin(angle) * 0.18);
          x += Math.cos(angle * 0.3) * 28;
          size *= 0.8 + cue + sync.eightHit;
          alpha = 0.08 + cue * 0.16;
        }

        context.beginPath();
        context.fillStyle = `rgba(${color},${alpha * energy})`;
        context.shadowBlur = 20 + cue * 34 + sync.eightHit * 18;
        context.shadowColor = `rgba(${color},.72)`;
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();

        if (template === "street" && index % 3 === 0) {
          context.beginPath();
          context.strokeStyle = `rgba(${color},${
            (0.08 + cue * 0.18 + sync.eightHit * 0.12) * energy
          })`;
          context.lineWidth = 2 + cue * 3 + sync.eightHit * 2;
          context.moveTo(x - 80, y + Math.sin(angle) * 20);
          context.lineTo(x + 220, y - Math.cos(angle) * 42);
          context.stroke();
        }
      });

      context.globalCompositeOperation = "source-over";
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [signalOnly, template]);

  const style = {
    "--section-color": sectionColor,
    "--cue-pressure": cuePressure,
    "--beat-hit": beatHit,
    "--eight-hit": eightHit,
    "--secondary-hit": secondaryHit,
    "--count-angle": `${((countIndex + progress) / 8) * 360}deg`,
  } as CSSProperties;

  return (
    <div
      className={`performance-stage performance-stage-${template} ${
        signalOnly ? "performance-stage-signal-only" : ""
      }`}
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
