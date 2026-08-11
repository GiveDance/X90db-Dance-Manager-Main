"use client";

import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FlipHorizontal2,
  Volume2,
  VolumeX,
  Plus,
  Crosshair,
  Sparkles,
  CircleDot,
  Radio,
  Waves,
  Grid2X2,
  Check,
  Ellipsis,
  Repeat,
  X,
} from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  BeatVizConfig,
  CountPointPosition,
  CountPointStyle,
} from "@/lib/types";

const RATES = [0.5, 0.75, 0.8, 1, 1.25, 1.5, 2];

const AMBIENT_VIZ_MODES: {
  key: "pulse" | "breath";
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  { key: "pulse", label: "边缘脉冲", desc: "四边闪光，第1拍紫色更强", icon: <Radio className="h-4 w-4" /> },
  { key: "breath", label: "呼吸灯", desc: "边缘呼吸扩散，第1拍更重", icon: <Waves className="h-4 w-4" /> },
];

function VizModeButton({
  config,
  onChange,
}: {
  config: BeatVizConfig;
  onChange: (config: BeatVizConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const anyOn = config.countPoints || config.pulse || config.breath;
  const setCountPointStyle = (style: CountPointStyle) => {
    onChange({ ...config, countPointStyle: style });
  };
  const setCountPointPosition = (position: CountPointPosition) => {
    onChange({ ...config, countPointPosition: position });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="节拍视觉设置"
        aria-label="节拍视觉设置"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center justify-center rounded-lg px-2.5 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white",
          (open || anyOn) && "text-white",
          open && "bg-white/10",
        )}
      >
        <Sparkles className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-72 rounded-xl border border-white/10 bg-neutral-900 p-2 shadow-2xl">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium text-neutral-500">
            节拍视觉
          </div>

          <div
            className={cn(
              "overflow-hidden rounded-lg border transition-colors",
              config.countPoints
                ? "border-blue-500/25"
                : "border-transparent",
            )}
          >
            <button
              type="button"
              aria-pressed={config.countPoints}
              onClick={() =>
                onChange({ ...config, countPoints: !config.countPoints })
              }
              className={cn(
                "flex w-full items-center gap-2.5 px-2 py-2 text-left transition-colors",
                config.countPoints
                  ? "bg-blue-500/15 text-blue-300"
                  : "text-neutral-300 hover:bg-white/10",
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5">
                {config.countPointStyle === "tiles" ? (
                  <Grid2X2 className="h-4 w-4" />
                ) : (
                  <CircleDot className="h-4 w-4" />
                )}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">计数拍点</span>
                <span className="block text-[11px] text-neutral-500">
                  显示当前八拍和计数位置
                </span>
              </span>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md border",
                  config.countPoints
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-white/20",
                )}
              >
                {config.countPoints && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>

            {config.countPoints && (
              <div className="border-t border-blue-500/20 bg-black/25 p-2.5">
                <div className="mb-1.5 text-[11px] text-neutral-500">样式</div>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/25 p-1">
                  {(
                    [
                      ["dots", "圆点"],
                      ["tiles", "方块"],
                    ] as [CountPointStyle, string][]
                  ).map(([style, label]) => (
                    <button
                      type="button"
                      key={style}
                      aria-pressed={config.countPointStyle === style}
                      onClick={() => setCountPointStyle(style)}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        config.countPointStyle === style
                          ? "bg-neutral-700 text-white"
                          : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mb-1.5 mt-2.5 text-[11px] text-neutral-500">
                  位置
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/25 p-1">
                  {(
                    [
                      ["top", "顶部"],
                      ["bottom", "底部"],
                      ["left", "左侧"],
                      ["right", "右侧"],
                    ] as [CountPointPosition, string][]
                  ).map(([position, label]) => (
                    <button
                      type="button"
                      key={position}
                      aria-pressed={config.countPointPosition === position}
                      onClick={() => setCountPointPosition(position)}
                      className={cn(
                        "rounded-md px-1 py-1.5 text-[11px] font-medium transition-colors",
                        config.countPointPosition === position
                          ? "bg-neutral-700 text-white"
                          : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="my-1 h-px bg-white/5" />

          {AMBIENT_VIZ_MODES.map((mode) => {
            const on = config[mode.key];
            return (
              <button
                type="button"
                key={mode.key}
                onClick={() =>
                  onChange({ ...config, [mode.key]: !config[mode.key] })
                }
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                  on ? "bg-blue-500/15 text-blue-300" : "text-neutral-300 hover:bg-white/10",
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5">
                  {mode.icon}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{mode.label}</span>
                  <span className="block text-[11px] text-neutral-500">{mode.desc}</span>
                </span>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md border",
                    on ? "border-blue-500 bg-blue-500 text-white" : "border-white/20",
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  mirrored: boolean;
  danmakuOn: boolean;
  showProgress: boolean;
  vizConfig: BeatVizConfig;
  onVizConfigChange: (config: BeatVizConfig) => void;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onPrevSegment: () => void;
  onNextSegment: () => void;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
  onSetRate: (r: number) => void;
  onToggleMirror: () => void;
  onToggleDanmaku: () => void;
  onAddMarker: () => void;
  beatLoopName: string | null;
  onStopLoop: () => void;
  calibrating: boolean;
  onToggleCalibration: () => void;
}

/** B 站风格弹幕图标：电视形外框 +「弹」字，关闭时右下角带禁止圈。 */
function DanmakuIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 天线 */}
      <path d="M9.5 6 L7.5 3 M14.5 6 L16.5 3" />
      {/* 屏幕 */}
      <rect x="3.5" y="6" width="17" height="12" rx="3" />
      {/* 弹 */}
      <text x="12" y="13.7" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor" stroke="none">
        弹
      </text>
      {off && (
        <>
          <circle cx="18.5" cy="17.5" r="4.2" fill="#0a0a0a" />
          <circle cx="18.5" cy="17.5" r="3.1" />
          <path d="M16.3 15.3 L20.7 19.7" />
        </>
      )}
    </svg>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-center rounded-lg px-2.5 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white",
        active && "bg-blue-500/20 text-blue-400 hover:bg-blue-500/25 hover:text-blue-300",
        className,
      )}
    >
      {children}
    </button>
  );
}

function MoreMenu(props: {
  calibrating: boolean;
  mirrored: boolean;
  danmakuOn: boolean;
  onToggleCalibration: () => void;
  onToggleMirror: () => void;
  onToggleDanmaku: () => void;
  onAddMarker: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => {
    action();
    setOpen(false);
  };
  const itemClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-neutral-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";

  return (
    <div ref={ref} className="relative">
      <IconBtn
        title="更多工具"
        onClick={() => setOpen((current) => !current)}
        active={open}
      >
        <Ellipsis className="h-5 w-5" />
      </IconBtn>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-30 mb-2 w-48 rounded-xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(props.onToggleCalibration)}
            className={cn(itemClass, props.calibrating && "bg-blue-500/15 text-blue-300")}
          >
            <Crosshair className="h-4 w-4" />
            节拍校准
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(props.onToggleMirror)}
            className={cn(itemClass, props.mirrored && "bg-blue-500/15 text-blue-300")}
          >
            <FlipHorizontal2 className="h-4 w-4" />
            镜像跟练
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(props.onToggleDanmaku)}
            className={cn(itemClass, props.danmakuOn && "bg-blue-500/15 text-blue-300")}
          >
            <DanmakuIcon off={!props.danmakuOn} />
            {props.danmakuOn ? "关闭弹幕" : "开启弹幕"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(props.onAddMarker)}
            className={itemClass}
          >
            <Plus className="h-4 w-4" />
            添加动作标记
          </button>
        </div>
      )}
    </div>
  );
}

export function Controls(props: ControlsProps) {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    playbackRate,
    mirrored,
    danmakuOn,
  } = props;
  const rowRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = (width: number) => setCompact(width < 790);
    const observer = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width);
    });
    update(row.getBoundingClientRect().width);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="border-t border-white/5 bg-black">
      {/* 全宽进度条（置顶；段落 tab 时由底部段落时间轴替代，这里隐藏） */}
      {props.showProgress && (
        <div className="px-5 pt-3">
          {props.beatLoopName && (
            <div className="mb-1.5 flex items-center">
              <span className="flex items-center gap-1 rounded-md bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
                <Repeat className="h-3 w-3" />
                循环: {props.beatLoopName}
                <button
                  type="button"
                  title="取消循环"
                  aria-label="取消八拍循环"
                  onClick={props.onStopLoop}
                  className="ml-0.5 rounded-sm hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}
          <ProgressBar currentTime={currentTime} duration={duration} onSeek={props.onSeek} />
        </div>
      )}

      {/* 按钮行 */}
      <div ref={rowRef} className="flex min-w-0 items-center gap-1 px-3 py-2.5 sm:px-5">
        <IconBtn title="播放 / 暂停 (Space)" onClick={props.onTogglePlay}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </IconBtn>
        <IconBtn title="上一个八拍" onClick={props.onPrevSegment}>
          <SkipBack className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="下一个八拍" onClick={props.onNextSegment}>
          <SkipForward className="h-4 w-4" />
        </IconBtn>

        <span className="ml-2 whitespace-nowrap text-xs tabular-nums text-neutral-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="min-w-2 flex-1" />

        <div className="flex shrink-0 items-center gap-1">
          <VizModeButton
            config={props.vizConfig}
            onChange={props.onVizConfigChange}
          />

          {!compact && (
            <>
              <IconBtn title="节拍校准（八拍对不上时用）" onClick={props.onToggleCalibration} active={props.calibrating}>
                <Crosshair className="h-5 w-5" />
              </IconBtn>
              <IconBtn title="镜像跟练" onClick={props.onToggleMirror} active={mirrored}>
                <FlipHorizontal2 className="h-5 w-5" />
              </IconBtn>
              <IconBtn
                title={danmakuOn ? "关闭弹幕 (D)" : "开启弹幕 (D)"}
                onClick={props.onToggleDanmaku}
                active={danmakuOn}
              >
                <DanmakuIcon off={!danmakuOn} />
              </IconBtn>
              <IconBtn title="在当前时间添加动作标记" onClick={props.onAddMarker}>
                <span className="flex items-center gap-1 text-xs">
                  <Plus className="h-4 w-4" />标记
                </span>
              </IconBtn>
              <div className="mx-1 h-5 w-px bg-white/10" />
            </>
          )}

          <select
            title="播放速度"
            aria-label="播放速度"
            value={playbackRate}
            onChange={(e) => props.onSetRate(parseFloat(e.target.value))}
            className="h-9 cursor-pointer rounded-lg bg-white/5 px-2 text-xs text-neutral-200 outline-none transition-colors hover:bg-white/10 focus:ring-1 focus:ring-blue-500"
          >
            {RATES.map((r) => (
              <option key={r} value={r} className="bg-neutral-900">
                {r}×
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <IconBtn title="静音" onClick={props.onToggleMute}>
            {muted || volume === 0 ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
            </IconBtn>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => props.onSetVolume(parseFloat(e.target.value))}
              title="音量"
              aria-label="音量"
              className="h-1 w-14 cursor-pointer appearance-none rounded-full bg-white/15 accent-blue-500 xl:w-20"
            />
          </div>

          {compact && (
            <MoreMenu
              calibrating={props.calibrating}
              mirrored={mirrored}
              danmakuOn={danmakuOn}
              onToggleCalibration={props.onToggleCalibration}
              onToggleMirror={props.onToggleMirror}
              onToggleDanmaku={props.onToggleDanmaku}
              onAddMarker={props.onAddMarker}
            />
          )}
        </div>
      </div>
    </div>
  );
}
