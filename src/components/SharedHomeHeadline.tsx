"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  LANDING_BEAT_EVENT,
  LANDING_SLOGAN_CHARACTERS,
} from "@/lib/landingRhythm";
import { useLanguage } from "@/i18n/LanguageProvider";

interface SharedHomeHeadlineProps {
  scrollerRef: RefObject<HTMLDivElement | null>;
}

const SLOGAN_LINES = ["让每一拍清晰可见", "让每一步准确合拍"] as const;

function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function SharedHomeHeadline({
  scrollerRef,
}: SharedHomeHeadlineProps) {
  const { language, t } = useLanguage();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sloganRef = useRef<HTMLParagraphElement>(null);
  const [animateSlogan, setAnimateSlogan] = useState(true);
  const [activeCharacter, setActiveCharacter] = useState(0);

  useEffect(() => {
    if (!animateSlogan) return;
    const updateCharacter = (event: Event) => {
      const character = (event as CustomEvent<number>).detail;
      if (
        Number.isInteger(character) &&
        character >= -1 &&
        character < LANDING_SLOGAN_CHARACTERS
      ) {
        setActiveCharacter(character);
      }
    };
    window.addEventListener(LANDING_BEAT_EVENT, updateCharacter);
    return () => window.removeEventListener(LANDING_BEAT_EVENT, updateCharacter);
  }, [animateSlogan]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const title = titleRef.current;
    const slogan = sloganRef.current;
    if (!scroller || !title || !slogan) return;

    let animationFrame = 0;
    const update = () => {
      animationFrame = 0;
      const width = scroller.clientWidth;
      const height = scroller.clientHeight;
      const scrollTop = scroller.scrollTop;
      const progress = Math.min(1, Math.max(0, scrollTop / Math.max(1, height)));
      const contentLeft = Math.max(24, (width - 1024) / 2 + 24);
      const afterLanding = Math.max(0, scrollTop - height);
      const centeredOffset = -50 * (1 - progress);
      const landingTitleSize = Math.min(120, Math.max(60, width * 0.075));
      const workspaceTitleSize = width < 640 ? 30 : 36;
      const workspaceHeadingGap = 12;
      const workspaceSloganTop =
        44 + workspaceTitleSize + workspaceHeadingGap;
      scroller.style.setProperty(
        "--workspace-heading-gap",
        `${workspaceHeadingGap}px`,
      );

      title.style.left = `${mix(width / 2, contentLeft, progress)}px`;
      title.style.top = `${mix(height * 0.43, 44, progress) - afterLanding}px`;
      title.style.fontSize = `${mix(landingTitleSize, workspaceTitleSize, progress)}px`;
      title.style.letterSpacing = `${mix(-0.055, -0.025, progress)}em`;
      title.style.transform = `translate(${centeredOffset}%, ${centeredOffset}%)`;

      slogan.style.left = `${mix(width / 2, contentLeft, progress)}px`;
      slogan.style.top = `${mix(height * 0.49, workspaceSloganTop, progress) - afterLanding}px`;
      slogan.style.fontSize = `${mix(width < 640 ? 18 : 24, 14, progress)}px`;
      slogan.style.transform = `translateX(${centeredOffset}%)`;
      slogan.style.color = `rgba(255,255,255,${mix(0.72, 0.64, progress)})`;
      setAnimateSlogan(scrollTop < height * 0.9);
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
  }, [scrollerRef]);

  const localizedSloganLines = SLOGAN_LINES.map((line) => t(line));
  const sloganUnits = localizedSloganLines.map((line) =>
    language === "en" ? line.split(" ") : [...line],
  );
  const totalSloganUnits = sloganUnits.reduce(
    (total, units) => total + units.length,
    0,
  );
  const activeSloganUnit =
    language === "en" && activeCharacter >= 0
      ? activeCharacter % totalSloganUnits
      : activeCharacter;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9]" aria-live="off">
      <h1
        ref={titleRef}
        className="absolute whitespace-nowrap font-semibold leading-none text-white"
      >
        Dance Manager
      </h1>
      <p
        ref={sloganRef}
        aria-label={localizedSloganLines.join(language === "en" ? ". " : "，")}
        className="absolute flex whitespace-nowrap font-semibold tracking-[-0.015em]"
      >
        {sloganUnits.map((units, lineIndex) => {
          const lineOffset = sloganUnits
            .slice(0, lineIndex)
            .reduce((total, previousUnits) => total + previousUnits.length, 0);
          return (
            <span
              key={localizedSloganLines[lineIndex]}
              aria-hidden="true"
              className={lineIndex === 0 ? "mr-[0.9em]" : undefined}
            >
              {units.map((unit, unitIndex) => {
                const index = lineOffset + unitIndex;
                const isActive =
                  animateSlogan && index === activeSloganUnit;
                return (
                  <span
                    key={`${localizedSloganLines[lineIndex]}-${unitIndex}`}
                    className={`relative inline-block ${
                      language === "en" && unitIndex < units.length - 1
                        ? "mr-[0.28em]"
                        : ""
                    }`}
                  >
                    <span
                      className={
                        animateSlogan
                          ? isActive
                            ? "font-bold text-white transition-colors duration-100 motion-reduce:font-inherit motion-reduce:text-inherit"
                            : "text-white/70 transition-colors duration-100 contrast-more:text-white/90 motion-reduce:text-inherit"
                          : "text-inherit"
                      }
                    >
                      {unit}
                    </span>
                    {animateSlogan && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-1/2 top-[calc(100%+0.2em)] w-px -translate-x-1/2 transition-all duration-100 ${
                          isActive
                            ? "h-2.5 bg-white"
                            : index === 0
                              ? "h-2 bg-blue-300/65"
                              : "h-1.5 bg-white/25"
                        }`}
                      />
                    )}
                  </span>
                );
              })}
            </span>
          );
        })}
      </p>
    </div>
  );
}
