"use client";

import { useEffect, useRef, useState } from "react";

interface TooltipState {
  label: string;
  left: number;
  top: number;
  below: boolean;
}

export function TooltipProvider() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const hide = () => {
      clearTimer();
      activeButtonRef.current = null;
      setTooltip(null);
    };
    const show = (button: HTMLButtonElement, immediate = false) => {
      clearTimer();
      activeButtonRef.current = button;
      const reveal = () => {
        if (
          !button.isConnected ||
          (!button.matches(":hover") && !button.matches(":focus-visible"))
        ) {
          hide();
          return;
        }
        const label = button.dataset.tooltip;
        if (!label) {
          hide();
          return;
        }
        const rect = button.getBoundingClientRect();
        setTooltip({
          label,
          left: rect.left + rect.width / 2,
          top: rect.top < 48 ? rect.bottom + 8 : rect.top - 8,
          below: rect.top < 48,
        });
      };
      if (immediate) reveal();
      else timerRef.current = setTimeout(reveal, 350);
    };
    const buttonFrom = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLButtonElement>("button[data-tooltip]")
        : null;
    const onPointerOver = (event: PointerEvent) => {
      const button = buttonFrom(event.target);
      if (button && !button.contains(event.relatedTarget as Node | null)) {
        show(button);
      }
    };
    const onPointerOut = (event: PointerEvent) => {
      const button = buttonFrom(event.target);
      if (button && !button.contains(event.relatedTarget as Node | null)) hide();
    };
    const onPointerMove = (event: PointerEvent) => {
      const activeButton = activeButtonRef.current;
      if (!activeButton || activeButton.matches(":focus-visible")) return;
      const pointedButton = buttonFrom(
        document.elementFromPoint(event.clientX, event.clientY),
      );
      if (pointedButton !== activeButton) hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      const button = buttonFrom(event.target);
      if (button?.matches(":focus-visible")) show(button, true);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (buttonFrom(event.target)) hide();
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", hide);
    document.addEventListener("keydown", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("blur", hide);
    window.addEventListener("pagehide", hide);
    const observer = new MutationObserver(() => {
      if (activeButtonRef.current && !activeButtonRef.current.isConnected) {
        hide();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimer();
      observer.disconnect();
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", hide);
      document.removeEventListener("keydown", hide);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("blur", hide);
      window.removeEventListener("pagehide", hide);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      role="tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
      className={`pointer-events-none fixed z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-neutral-800 px-2 py-1 text-[11px] font-medium text-neutral-200 shadow-xl ${
        tooltip.below ? "" : "-translate-y-full"
      }`}
    >
      {tooltip.label}
    </div>
  );
}
