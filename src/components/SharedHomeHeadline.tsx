"use client";

import { useEffect, useRef, type RefObject } from "react";

interface SharedHomeHeadlineProps {
  scrollerRef: RefObject<HTMLDivElement | null>;
}

function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function SharedHomeHeadline({
  scrollerRef,
}: SharedHomeHeadlineProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sloganRef = useRef<HTMLParagraphElement>(null);

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
      slogan.style.top = `${mix(height * 0.54, 98, progress) - afterLanding}px`;
      slogan.style.fontSize = `${mix(width < 640 ? 18 : 24, 16, progress)}px`;
      slogan.style.transform = `translateX(${centeredOffset}%)`;
      slogan.style.color = `rgba(255,255,255,${mix(0.72, 0.5, progress)})`;
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
        className="absolute whitespace-nowrap font-medium tracking-tight"
      >
        让节拍看得见，让每一步都合拍。
      </p>
    </div>
  );
}
