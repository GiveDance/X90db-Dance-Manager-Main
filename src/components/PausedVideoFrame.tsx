"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/cn";

interface PausedVideoFrameProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  mirrored: boolean;
}

export function PausedVideoFrame({
  videoRef,
  src,
  mirrored,
}: PausedVideoFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const hide = () => setVisible(false);
    const draw = () => {
      if (!video.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        hide();
        return;
      }
      if (!video.videoWidth || !video.videoHeight) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setVisible(true);
    };

    video.addEventListener("loadeddata", draw);
    video.addEventListener("seeked", draw);
    video.addEventListener("pause", draw);
    video.addEventListener("play", hide);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) draw();

    return () => {
      video.removeEventListener("loadeddata", draw);
      video.removeEventListener("seeked", draw);
      video.removeEventListener("pause", draw);
      video.removeEventListener("play", hide);
    };
  }, [src, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full object-contain",
        mirrored && "-scale-x-100",
        visible ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
