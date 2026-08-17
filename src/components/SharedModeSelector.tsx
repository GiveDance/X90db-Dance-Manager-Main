"use client";

import { GraduationCap, Sparkles } from "lucide-react";
import {
  useEffect,
  useRef,
  type RefObject,
} from "react";
import type { WorkspaceMode } from "./Home";

interface SharedModeSelectorProps {
  scrollerRef: RefObject<HTMLDivElement | null>;
  mode: WorkspaceMode;
  onSelect: (mode: WorkspaceMode) => void;
}

function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function SharedModeSelector({
  scrollerRef,
  mode,
  onSelect,
}: SharedModeSelectorProps) {
  const selectorRef = useRef<HTMLDivElement>(null);
  const learningRef = useRef<HTMLButtonElement>(null);
  const performingRef = useRef<HTMLButtonElement>(null);
  const learningPrefixRef = useRef<HTMLSpanElement>(null);
  const performingPrefixRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const selector = selectorRef.current;
    const learning = learningRef.current;
    const performing = performingRef.current;
    const learningPrefix = learningPrefixRef.current;
    const performingPrefix = performingPrefixRef.current;
    if (
      !scroller ||
      !selector ||
      !learning ||
      !performing ||
      !learningPrefix ||
      !performingPrefix
    ) {
      return;
    }

    let animationFrame = 0;
    const update = () => {
      animationFrame = 0;
      const width = scroller.clientWidth;
      const height = scroller.clientHeight;
      const scrollTop = scroller.scrollTop;
      const progress = Math.min(1, Math.max(0, scrollTop / Math.max(1, height)));
      const afterLanding = Math.max(0, scrollTop - height);
      const contentLeft = Math.max(24, (width - 1024) / 2 + 24);
      const landingWidth = Math.min(448, width - 48);
      const centeredOffset = -50 * (1 - progress);
      const inactiveOpacity = mix(0.1, 0, progress);

      selector.style.left = `${mix(width / 2, contentLeft, progress)}px`;
      selector.style.top = `${mix(height - 122, 150, progress) - afterLanding}px`;
      selector.style.width = `${mix(landingWidth, 190, progress)}px`;
      selector.style.height = `${mix(56, 46, progress)}px`;
      selector.style.padding = `${mix(0, 4, progress)}px`;
      selector.style.gap = `${mix(12, 4, progress)}px`;
      selector.style.borderRadius = "999px";
      selector.style.borderColor = `rgba(${mix(255, 64, progress)},${mix(255, 64, progress)},${mix(255, 64, progress)},${progress})`;
      selector.style.backgroundColor = `rgba(23,23,23,${progress})`;
      selector.style.transform = `translateX(${centeredOffset}%)`;

      const prefixWidth = mix(2.1, 0, progress);
      const prefixOpacity = 1 - progress;
      for (const prefix of [learningPrefix, performingPrefix]) {
        prefix.style.maxWidth = `${prefixWidth}em`;
        prefix.style.opacity = `${prefixOpacity}`;
      }

      const learningBackground =
        mode === "learning"
          ? `rgba(${mix(255, 37, progress)},${mix(255, 99, progress)},${mix(255, 235, progress)},${mix(0.1, 1, progress)})`
          : `rgba(255,255,255,${inactiveOpacity})`;
      const performingBackground =
        mode === "performing"
          ? `rgba(${mix(255, 124, progress)},${mix(255, 58, progress)},${mix(255, 237, progress)},${mix(0.1, 1, progress)})`
          : `rgba(255,255,255,${inactiveOpacity})`;
      learning.style.setProperty("--mode-bg", learningBackground);
      performing.style.setProperty("--mode-bg", performingBackground);
      learning.style.setProperty(
        "--mode-hover-bg",
        `rgb(${mix(255, 37, progress)} ${mix(255, 99, progress)} ${mix(255, 235, progress)})`,
      );
      performing.style.setProperty(
        "--mode-hover-bg",
        `rgb(${mix(255, 124, progress)} ${mix(255, 58, progress)} ${mix(255, 237, progress)})`,
      );
      learning.style.setProperty(
        "--mode-hover-color",
        `rgb(${mix(0, 255, progress)} ${mix(0, 255, progress)} ${mix(0, 255, progress)})`,
      );
      performing.style.setProperty(
        "--mode-hover-color",
        `rgb(${mix(0, 255, progress)} ${mix(0, 255, progress)} ${mix(0, 255, progress)})`,
      );
      learning.style.setProperty(
        "--mode-color",
        "rgb(255 255 255)",
      );
      performing.style.setProperty(
        "--mode-color",
        "rgb(255 255 255)",
      );
    };
    const requestUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      scroller.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [mode, scrollerRef]);

  return (
    <div
      ref={selectorRef}
      aria-label="选择 Dance Manager 模式"
      className="fixed left-1/2 top-[calc(100%-122px)] z-10 flex h-14 w-[min(448px,calc(100%-48px))] gap-3 rounded-full border border-transparent backdrop-blur-md [transform:translateX(-50%)] will-change-[left,top,width,height,transform]"
    >
      <button
        ref={learningRef}
        type="button"
        aria-pressed={mode === "learning"}
        onClick={() => onSelect("learning")}
        className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-[var(--mode-bg,rgba(255,255,255,0.1))] text-sm font-semibold text-[var(--mode-color,white)] transition-colors hover:!bg-[var(--mode-hover-bg,white)] hover:!text-[var(--mode-hover-color,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <GraduationCap className="h-4 w-4 shrink-0" />
        <span>
          <span
            ref={learningPrefixRef}
            className="inline-block overflow-hidden align-bottom"
          >
            扒舞
          </span>
          练习
        </span>
      </button>
      <button
        ref={performingRef}
        type="button"
        aria-pressed={mode === "performing"}
        onClick={() => onSelect("performing")}
        className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-[var(--mode-bg,rgba(255,255,255,0.1))] text-sm font-semibold text-[var(--mode-color,white)] transition-colors hover:!bg-[var(--mode-hover-bg,white)] hover:!text-[var(--mode-hover-color,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>
          <span
            ref={performingPrefixRef}
            className="inline-block overflow-hidden align-bottom"
          >
            舞台
          </span>
          演出
        </span>
      </button>
    </div>
  );
}
