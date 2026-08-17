"use client";

import { useEffect, useRef, useState } from "react";
import { trackedBeatPreRoll } from "@/lib/countIn";
import { drawPerformerSignal } from "@/lib/performerSignal";
import type { PerformingStageSettings } from "@/lib/types";

export function PerformerSignalRenderer({
  beats,
  countdownBeats,
  settings,
  time,
}: {
  beats: number[];
  countdownBeats: number[];
  settings: PerformingStageSettings;
  time: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = size.width || canvas.clientWidth;
    const height = size.height || canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (
      canvas.width !== Math.round(width * dpr) ||
      canvas.height !== Math.round(height * dpr)
    ) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const preRoll = settings.visualLeadEnabled
      ? trackedBeatPreRoll(time, countdownBeats)
      : null;
    drawPerformerSignal(
      context,
      width,
      height,
      time,
      beats,
      {
        corner: {
          enabled: settings.cornerSignalEnabled,
          shape: settings.cornerSignalShape,
          beatColor: settings.cornerSignalBeatColor,
          accentColor: settings.cornerSignalAccentColor,
          size: settings.cornerSignalSize,
          opacity: settings.cornerSignalOpacity,
        },
        beatPoints: {
          enabled: settings.showBeatCode,
          shape: settings.beatPointShape,
          theme: settings.beatPointTheme,
          beatColor: settings.beatPointBeatColor,
          accentColor: settings.beatPointAccentColor,
          size: settings.beatPointSize,
          opacity: settings.beatPointOpacity,
          spacing: settings.beatPointSpacing,
          rows: settings.beatPointRows,
          positions: settings.beatCodePositions,
        },
        secondaryAccentCount: settings.secondaryAccentCount,
        beatOverride: preRoll
          ? {
              count: preRoll.count,
              duration: preRoll.duration,
              index: preRoll.count - 1,
              elapsed: preRoll.phase * preRoll.duration,
              visualLead: true,
            }
          : undefined,
      },
    );
  }, [beats, countdownBeats, settings, size, time]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="八拍节拍信号。当前拍高亮，较大的双边框拍点表示重拍。"
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    />
  );
}
