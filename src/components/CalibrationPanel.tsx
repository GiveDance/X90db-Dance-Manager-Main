"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Minus, Crosshair, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

interface CalibrationPanelProps {
  bpm: number;
  offset: number;
  currentCount: number; // 当前拍 1-8，0 表示无
  onSetBpm: (b: number) => void;
  onSetOffset: (offset: number) => void;
  onShiftOffset: (deltaSeconds: number) => void;
  onSetDownbeat: () => void;
  onReset: () => void;
  onClose: () => void;
}

const MIN_BPM = 40;
const MAX_BPM = 240;
const clampBpm = (b: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, b));

export function CalibrationPanel({
  bpm,
  offset,
  currentCount,
  onSetBpm,
  onSetOffset,
  onShiftOffset,
  onSetDownbeat,
  onReset,
  onClose,
}: CalibrationPanelProps) {
  const taps = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const spb = 60 / bpm;

  // BPM 可直接输入：聚焦时编辑文本，失焦/回车提交并钳制范围
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmText, setBpmText] = useState("");
  const [editingOffset, setEditingOffset] = useState(false);
  const [offsetText, setOffsetText] = useState("");
  const commitBpm = () => {
    const v = parseFloat(bpmText);
    if (!isNaN(v)) onSetBpm(clampBpm(Math.round(v * 10) / 10));
    setEditingBpm(false);
  };
  const commitOffset = () => {
    const value = parseFloat(offsetText);
    if (Number.isFinite(value)) onSetOffset(Math.round(value * 100) / 100);
    setEditingOffset(false);
  };

  const tap = () => {
    const now = performance.now();
    const arr = taps.current;
    // 间隔过长视为重新开始
    if (arr.length && now - arr[arr.length - 1] > 2000) arr.length = 0;
    arr.push(now);
    if (arr.length > 8) arr.shift();
    setTapCount(arr.length);
    if (arr.length >= 2) {
      let sum = 0;
      for (let i = 1; i < arr.length; i++) sum += arr[i] - arr[i - 1];
      const avg = sum / (arr.length - 1);
      const b = 60000 / avg;
      if (b >= MIN_BPM && b <= MAX_BPM) onSetBpm(Math.round(b * 10) / 10);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.18 }}
      className="max-h-[calc(100dvh-7rem)] w-full max-w-[480px] overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">节奏校准</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            title="恢复首次解析值"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </button>
          <button
            type="button"
            onClick={onClose}
            data-tooltip="关闭"
            aria-label="关闭节奏校准"
            className="rounded-md p-1 text-neutral-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 当前拍大字提示，便于对齐验证（听障也可视觉确认） */}
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-black/40 px-3 py-2">
        <span className="text-xs text-neutral-500">当前拍</span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold tabular-nums transition-colors",
            currentCount > 0 ? "bg-blue-500 text-white" : "bg-neutral-800 text-neutral-600",
          )}
        >
          {currentCount > 0 ? currentCount : "–"}
        </span>
        <span className="min-w-0 flex-1 text-xs text-neutral-500">
          播放并观察顶部节拍点 / 此数字是否与音乐、动作对齐
        </span>
      </div>

      <div className="flex flex-col">
      <div className="order-2 rounded-xl border border-white/5 bg-black/20 p-3">
        <h4 className="mb-2 text-xs font-medium text-neutral-300">BPM</h4>
        <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] gap-2">
          <button
            type="button"
            onClick={() => onSetBpm(clampBpm(Math.round((bpm - 1) * 10) / 10))}
            data-tooltip="BPM 减 1"
            aria-label="BPM 减 1"
            className="flex h-9 items-center justify-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/10"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            value={editingBpm ? bpmText : bpm.toFixed(1)}
            onFocus={() => {
              setEditingBpm(true);
              setBpmText(bpm.toFixed(1));
            }}
            onChange={(e) => setBpmText(e.target.value)}
            onBlur={commitBpm}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label="BPM"
            className="h-9 min-w-0 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-center text-base font-semibold tabular-nums text-white outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => onSetBpm(clampBpm(Math.round((bpm + 1) * 10) / 10))}
            data-tooltip="BPM 加 1"
            aria-label="BPM 加 1"
            className="flex h-9 items-center justify-center rounded-lg border border-white/10 text-neutral-300 hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={tap}
          className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-500/15 px-4 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/25 active:scale-[0.99]"
        >
          Tap 测速
          <span className="text-xs text-blue-400/70">
            {tapCount > 0 ? `已敲 ${tapCount}` : "跟着动作敲"}
          </span>
        </button>
      </div>

      <div className="order-1 mb-3 rounded-xl border border-white/5 bg-black/20 p-3">
        <h4 className="mb-2 text-xs font-medium text-neutral-300">第1拍</h4>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
          <button
            type="button"
            onClick={() => onShiftOffset(-spb)}
            className="h-9 rounded-lg border border-white/10 px-3 text-xs text-neutral-300 hover:bg-white/10"
          >
            −1拍
          </button>
          <div className="relative min-w-0">
            <input
              type="number"
              inputMode="decimal"
              step={0.01}
              value={editingOffset ? offsetText : offset.toFixed(2)}
              onFocus={() => {
                setEditingOffset(true);
                setOffsetText(offset.toFixed(2));
              }}
              onChange={(event) => setOffsetText(event.target.value)}
              onBlur={commitOffset}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              aria-label="第1拍时间点（秒）"
              className="h-9 min-w-0 w-full rounded-lg border border-white/10 bg-neutral-950 pl-3 pr-7 text-center text-sm font-semibold tabular-nums text-white outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
              s
            </span>
          </div>
          <button
            type="button"
            onClick={() => onShiftOffset(spb)}
            className="h-9 rounded-lg border border-white/10 px-3 text-xs text-neutral-300 hover:bg-white/10"
          >
            +1拍
          </button>
        </div>
        <button
          type="button"
          onClick={onSetDownbeat}
          className="mt-2 h-9 w-full rounded-lg bg-white/5 px-3 text-xs font-medium text-neutral-200 hover:bg-white/10"
        >
          设为当前画面
        </button>
      </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        建议流程：先暂停到动作「1」那一帧 →「设为当前画面」→ 再用 Tap 测速或 ± 调 BPM，让后面的拍跟上。
      </p>
    </motion.div>
  );
}
