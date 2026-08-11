"use client";

import { useCallback, useEffect, useState } from "react";
import { Route } from "lucide-react";

const BUTTON_CLASS =
  "flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white";

export function DevToolsButton() {
  const [available, setAvailable] = useState(false);
  const isDevelopment = process.env.NODE_ENV === "development";

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

      setAvailable(true);

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

  const openDevTools = useCallback(() => {
    document
      .querySelector("nextjs-portal")
      ?.shadowRoot?.querySelector<HTMLButtonElement>(
        'button[aria-label="Open Next.js Dev Tools"]',
      )
      ?.click();
  }, []);

  if (!isDevelopment || !available) return null;

  return (
    <button
      type="button"
      onClick={openDevTools}
      title="打开开发工具"
      className={BUTTON_CLASS}
    >
      <Route className="h-3.5 w-3.5" />
      开发工具
    </button>
  );
}
