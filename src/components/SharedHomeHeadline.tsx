"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  LANDING_BEAT_EVENT,
  LANDING_SLOGAN_CHARACTERS,
} from "@/lib/landingRhythm";

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

      title.style.left = `${mix(width / 2, contentLeft, progress)}px`;
      title.style.top = `${mix(height * 0.43, 44, progress) - afterLanding}px`;
      title.style.fontSize = `${mix(landingTitleSize, workspaceTitleSize, progress)}px`;
      title.style.letterSpacing = `${mix(-0.055, -0.025, progress)}em`;
      title.style.transform = `translate(${centeredOffset}%, ${centeredOffset}%)`;

      slogan.style.left = `${mix(width / 2, contentLeft, progress)}px`;
      slogan.style.top = `${mix(height * 0.5, 98, progress) - afterLanding}px`;
      slogan.style.fontSize = `${mix(width < 640 ? 18 : 24, 16, progress)}px`;
      slogan.style.transform = `translateX(${centeredOffset}%)`;
      slogan.style.color = `rgba(255,255,255,${mix(0.72, 0.5, progress)})`;
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
        aria-label={SLOGAN_LINES.join("，")}
        className="absolute flex whitespace-nowrap font-semibold tracking-[-0.015em]"
      >
        {SLOGAN_LINES.map((line, lineIndex) => {
          const lineOffset = lineIndex * line.length;
          return (
            <span
              key={line}
              aria-hidden="true"
              className={lineIndex === 0 ? "mr-[0.9em]" : undefined}
            >
              {[...line].map((character, characterIndex) => {
                const index = lineOffset + characterIndex;
                const isActive =
                  animateSlogan && index === activeCharacter;
                return (
                  <span
                    key={`${line}-${characterIndex}`}
                    className="inline-block"
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
                      {character}
                    </span>
                  </span>
                );
              })}
            </span>
          );
        })}
        {animateSlogan && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-[calc(100%+0.35em)] flex h-[1.25em] items-end"
          >
            {SLOGAN_LINES.map((line, lineIndex) => (
              <span
                key={`${line}-timeline`}
                className={`relative grid h-full w-[8em] grid-cols-8 border-b border-white/20 ${
                  lineIndex === 0 ? "mr-[0.9em]" : ""
                }`}
              >
                {[...line].map((_, beatIndex) => {
                  const index = lineIndex * line.length + beatIndex;
                  const isActive = index === activeCharacter;
                  const isDownbeat = beatIndex === 0;
                  const isQuarter = beatIndex % 4 === 0;
                  return (
                    <span
                      key={`${line}-beat-${beatIndex}`}
                      className="relative h-full"
                    >
                      <span
                        className={`absolute bottom-0 left-1/2 w-px -translate-x-1/2 ${
                          isActive
                            ? "h-full bg-white"
                            : isDownbeat
                              ? "h-full bg-blue-400/45"
                              : isQuarter
                                ? "h-3/4 bg-blue-400/25"
                                : "h-1/2 bg-white/[0.08]"
                        }`}
                      />
                      <span
                        className={`absolute bottom-0 left-1/2 h-[3px] w-1.5 -translate-x-1/2 rounded-t-full ${
                          isActive
                            ? "bg-white"
                            : isDownbeat
                              ? "bg-blue-300/75"
                              : isQuarter
                                ? "bg-blue-300/55"
                                : "bg-neutral-500/35"
                        }`}
                      />
                      {isActive && (
                        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                      )}
                    </span>
                  );
                })}
              </span>
            ))}
          </span>
        )}
      </p>
    </div>
  );
}
