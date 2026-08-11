"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Trash2, Crosshair } from "lucide-react";
import type { DanceSection } from "@/lib/types";

interface SectionDialogProps {
  section: DanceSection;
  isNew: boolean;
  segCount: number;
  /** 当前正在播放的八拍序号（0-based），用于「设为当前八拍」 */
  currentBeatIndex: number;
  onSave: (data: { name: string; startSeg: number; endSeg: number }) => void;
  onDelete: () => void;
  onClose: () => void;
}

function Row({
  label,
  value,
  set,
  clamp,
  setToNow,
}: {
  label: string;
  value: number;
  set: (v: number) => void;
  clamp: (v: number) => number;
  setToNow: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-neutral-400">{label}</span>
      <button
        onClick={() => set(clamp(value - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/10"
      >
        −
      </button>
      <span className="w-20 text-center text-sm tabular-nums text-white">第 {value + 1} 个八拍</span>
      <button
        onClick={() => set(clamp(value + 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/10"
      >
        +
      </button>
      <button
        onClick={setToNow}
        title="设为当前播放到的八拍"
        className="ml-auto flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-white/10"
      >
        <Crosshair className="h-3.5 w-3.5" />
        当前八拍
      </button>
    </div>
  );
}

export function SectionDialog({
  section,
  isNew,
  segCount,
  currentBeatIndex,
  onSave,
  onDelete,
  onClose,
}: SectionDialogProps) {
  const [name, setName] = useState(section.name);
  const [startSeg, setStartSeg] = useState(section.startSeg);
  const [endSeg, setEndSeg] = useState(section.endSeg);

  const last = Math.max(0, segCount - 1);
  const clampS = (v: number) => Math.max(0, Math.min(v, last));
  const len = Math.max(0, endSeg - startSeg + 1);
  const valid = startSeg >= 0 && endSeg <= last && startSeg <= endSeg;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{isNew ? "添加段落" : "编辑段落"}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-1 block text-xs text-neutral-400">段落名称</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：副歌 / 第一段"
          className="mb-4 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="space-y-2.5">
          <Row label="起点" value={startSeg} set={setStartSeg} clamp={clampS} setToNow={() => setStartSeg(clampS(currentBeatIndex))} />
          <Row label="终点" value={endSeg} set={setEndSeg} clamp={clampS} setToNow={() => setEndSeg(clampS(currentBeatIndex))} />
        </div>

        <p className="mt-3 text-xs text-neutral-500">
          {valid ? (
            <>共 <span className="font-medium text-neutral-300">{len}</span> 个八拍</>
          ) : (
            <span className="text-red-400">起点须不晚于终点</span>
          )}
        </p>

        <div className="mt-5 flex items-center justify-between">
          {!isNew ? (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              删除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-neutral-400 hover:text-white">
              取消
            </button>
            <button
              onClick={() => valid && onSave({ name: name.trim() || "未命名段落", startSeg, endSeg })}
              disabled={!valid}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
