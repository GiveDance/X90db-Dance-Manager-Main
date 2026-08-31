"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages, Route, Wrench } from "lucide-react";
import { useLanguage, type AppLanguage } from "@/i18n/LanguageProvider";

const BUTTON_CLASS =
  "flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white";

const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: "简体中文" | "英语" }> = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "英语" },
];

export function DevToolsButton() {
  const [nativeToolsAvailable, setNativeToolsAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDevelopment = process.env.NODE_ENV === "development";
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    if (!isDevelopment) return;

    const connect = () => {
      const portal = document.querySelector("nextjs-portal");
      const root = portal?.shadowRoot;
      if (!root) return false;

      const nativeButton = root.querySelector<HTMLButtonElement>(
        'button[aria-label="Open Next.js Dev Tools"]',
      );
      if (!nativeButton) return false;

      setNativeToolsAvailable(true);

      const existingStyle = root.querySelector<HTMLStyleElement>(
        "#dance-manager-dev-tools-style",
      );
      const style = existingStyle ?? document.createElement("style");
      style.id = "dance-manager-dev-tools-style";
      style.textContent =
        '[data-next-badge-root]:has(button[aria-label="Open Next.js Dev Tools"]) { display: none !important; }';
      if (!existingStyle) root.appendChild(style);
      return true;
    };

    if (connect()) return;
    const observer = new MutationObserver(() => {
      if (connect()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isDevelopment]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const openDevTools = useCallback(() => {
    document
      .querySelector("nextjs-portal")
      ?.shadowRoot?.querySelector<HTMLButtonElement>(
        'button[aria-label="Open Next.js Dev Tools"]',
      )
      ?.click();
    setOpen(false);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title={t("打开开发工具")}
        aria-haspopup="menu"
        aria-expanded={open}
        className={BUTTON_CLASS}
      >
        <Route className="h-3.5 w-3.5" />
        {t("开发工具")}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[100] mt-2 w-56 rounded-xl border border-white/10 bg-neutral-950/95 p-2 text-xs text-neutral-200 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 px-2 py-1.5 font-medium text-neutral-400">
            <Languages className="h-3.5 w-3.5" />
            {t("语言")}
          </div>
          <div className="flex flex-col gap-1">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={language === option.value}
                onClick={() => setLanguage(option.value)}
                className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10"
              >
                <span className="min-w-0 flex-1">{t(option.label)}</span>
                {language === option.value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>

          {isDevelopment && nativeToolsAvailable && (
            <>
              <div className="my-2 h-px bg-white/10" />
              <button
                type="button"
                role="menuitem"
                onClick={openDevTools}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10"
              >
                <Wrench className="h-3.5 w-3.5" />
                {t("打开 Next.js 开发工具")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
