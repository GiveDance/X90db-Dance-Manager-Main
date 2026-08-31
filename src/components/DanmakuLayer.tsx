"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { MARKER_COLORS, type Marker } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/i18n/LanguageProvider";

const DISPLAY = 4.5; // 每条标记的显示时长（秒）

interface DanmakuLayerProps {
  markers: Marker[];
  currentTime: number;
  enabled: boolean;
  onRemove: (id: string) => void;
}

/**
 * 动作标记层：在画面上方居中「出现 / 消失」，不横向滑动。
 * 由 currentTime 驱动：到点淡入，显示 DISPLAY 秒后淡出；暂停时保持可见，便于 hover 删除。
 * 该层不参与镜像翻转。
 */
export function DanmakuLayer({ markers, currentTime, enabled, onRemove }: DanmakuLayerProps) {
  const { t } = useLanguage();
  if (!enabled) return null;

  const active = markers.filter(
    (m) => currentTime >= m.time && currentTime < m.time + DISPLAY,
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[18%] flex flex-col items-center gap-2">
      <AnimatePresence>
        {active.map((m) => {
          const color = MARKER_COLORS[m.color];
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="group pointer-events-auto"
            >
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border bg-black/65 px-3 py-1.5 text-sm font-medium backdrop-blur-sm",
                  color.pill,
                )}
              >
                <span className={cn("tabular-nums", color.text)}>{formatTime(m.time)}</span>
                {m.label && <span className="font-semibold text-white">{m.label}</span>}
                {m.text && <span className="text-white/90">{m.text}</span>}
                <button
                  onClick={() => onRemove(m.id)}
                  data-tooltip={t("删除提示")}
                  aria-label={t("删除提示")}
                  className="ml-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-red-500/80 hover:text-white group-hover:flex"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
