"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { MARKER_COLORS, type MarkerColor } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const COLORS: MarkerColor[] = ["yellow", "white", "pink", "blue", "green"];

interface MarkerDialogProps {
  time: number;
  onClose: () => void;
  onAdd: (data: { label: string; text: string; color: MarkerColor }) => void;
}

export function MarkerDialog({ time, onClose, onAdd }: MarkerDialogProps) {
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [color, setColor] = useState<MarkerColor>("yellow");

  const submit = () => {
    if (!label.trim() && !text.trim()) return;
    onAdd({ label: label.trim(), text: text.trim(), color });
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[380px] rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            添加动作标记
            <span className="ml-2 text-sm font-normal tabular-nums text-blue-400">
              {formatTime(time)}
            </span>
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-1 block text-xs text-neutral-400">标签（简短，如 Turn / Jump）</label>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Turn"
          className="mb-3 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
        />

        <label className="mb-1 block text-xs text-neutral-400">说明</label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="这里转身很关键！"
          className="mb-3 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
        />

        <label className="mb-1.5 block text-xs text-neutral-400">颜色</label>
        <div className="mb-5 flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform",
                MARKER_COLORS[c].dot,
                color === c ? "scale-110 border-white" : "border-transparent",
              )}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-neutral-400 hover:text-white"
          >
            取消
          </button>
          <button
            onClick={submit}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            添加
          </button>
        </div>
      </motion.div>
    </div>
  );
}
