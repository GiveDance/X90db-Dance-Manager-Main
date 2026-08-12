"use client";

import { type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BeatVisualizer } from "./BeatVisualizer";
import { CountPointDock } from "./CountPointDock";
import { DanmakuLayer } from "./DanmakuLayer";
import { FormationOverlay } from "./FormationOverlay";
import type {
  BeatVizConfig,
  FormationAudiencePosition,
  FormationChange,
  Marker,
} from "@/lib/types";
import { cn } from "@/lib/cn";

interface VideoStageProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  videoProps: React.VideoHTMLAttributes<HTMLVideoElement>;
  mirrored: boolean;
  activeBeat: number;
  activeSegmentNumber: number | null;
  markers: Marker[];
  currentTime: number;
  danmakuOn: boolean;
  countdown: number | null;
  vizConfig: BeatVizConfig;
  beatPhase: number;
  isDownbeat: boolean;
  beatActive: boolean;
  isPlaying: boolean;
  musicStarted: boolean;
  preRoll: boolean;
  secondsPerBeat: number;
  onTogglePlay: () => void;
  onRemoveMarker: (id: string) => void;
  formationOpen: boolean;
  formationChanges: FormationChange[];
  formationAudiencePosition: FormationAudiencePosition;
  onEditFormation: () => void;
  onDismissFormation: () => void;
}

export function VideoStage({
  src,
  videoRef,
  videoProps,
  mirrored,
  activeBeat,
  activeSegmentNumber,
  markers,
  currentTime,
  danmakuOn,
  countdown,
  vizConfig,
  beatPhase,
  isDownbeat,
  beatActive,
  isPlaying,
  musicStarted,
  preRoll,
  secondsPerBeat,
  onTogglePlay,
  onRemoveMarker,
  formationOpen,
  formationChanges,
  formationAudiencePosition,
  onEditFormation,
  onDismissFormation,
}: VideoStageProps) {
  const verticalLayout =
    vizConfig.countPoints &&
    (vizConfig.countPointPosition === "top" ||
      vizConfig.countPointPosition === "bottom");
  const dockBeforeVideo =
    vizConfig.countPointPosition === "top" ||
    vizConfig.countPointPosition === "left";

  const countPointDock = vizConfig.countPoints ? (
    <CountPointDock
      style={vizConfig.countPointStyle}
      position={vizConfig.countPointPosition}
      activeBeat={activeBeat}
      segmentNumber={activeSegmentNumber}
      phase={beatPhase}
      active={beatActive}
      isPlaying={isPlaying}
      musicStarted={musicStarted}
      preRoll={preRoll}
      secondsPerBeat={secondsPerBeat}
    />
  ) : null;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 bg-black",
        verticalLayout ? "flex-col" : "flex-row",
      )}
    >
      {dockBeforeVideo && countPointDock}

      <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <video
          {...videoProps}
          ref={videoRef}
          src={src}
          onLoadedMetadata={(event) => {
            videoProps.onLoadedMetadata?.(event);
            if (currentTime > 0) {
              event.currentTarget.currentTime = Math.min(
                currentTime,
                event.currentTarget.duration || currentTime,
              );
            }
          }}
          onClick={onTogglePlay}
          className={cn(
            "max-h-full max-w-full cursor-pointer object-contain",
            mirrored && "-scale-x-100",
          )}
        />

        {vizConfig.pulse && (
          <BeatVisualizer
            mode="pulse"
            phase={beatPhase}
            isDownbeat={isDownbeat}
            active={beatActive}
            musicStarted={musicStarted}
          />
        )}
        {vizConfig.breath && (
          <BeatVisualizer
            mode="breath"
            phase={beatPhase}
            isDownbeat={isDownbeat}
            active={beatActive}
            musicStarted={musicStarted}
          />
        )}

        <div className="pointer-events-none absolute inset-0">
          <DanmakuLayer
            markers={markers}
            currentTime={currentTime}
            enabled={danmakuOn}
            onRemove={onRemoveMarker}
          />
        </div>

        {formationOpen && (
          <FormationOverlay
            onEdit={onEditFormation}
            onDismiss={onDismissFormation}
            changes={formationChanges}
            audiencePosition={formationAudiencePosition}
            currentTime={currentTime}
          />
        )}

        <AnimatePresence>
          {countdown != null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            >
              <motion.div
                key={`edge-${countdown}`}
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 0.15 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className={cn(
                  "absolute inset-0",
                  musicStarted
                    ? "shadow-[inset_0_0_90px_24px_rgba(59,130,246,0.55)]"
                    : "shadow-[inset_0_0_90px_24px_rgba(115,115,115,0.5)]",
                )}
              />
              <div className="absolute h-56 w-56 rounded-full bg-black/30 blur-2xl" />
              <motion.span
                key={countdown}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="relative text-[140px] font-bold leading-none text-white tabular-nums [text-shadow:0_2px_24px_rgba(0,0,0,0.7)]"
              >
                {countdown}
              </motion.span>
              <span className="relative mt-4 text-lg text-white/75 [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">
                准备开始…
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!dockBeforeVideo && countPointDock}
    </div>
  );
}
