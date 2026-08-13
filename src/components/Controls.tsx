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
  Sparkles,
  CircleDot,
  Radio,
  Waves,
  Grid2X2,
  Check,
  Ellipsis,
  Repeat,
  X,
  MessageSquareText,
  UsersRound,
} from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  BeatVizConfig,
  CountPointPosition,
  CountPointStyle,
  MarkerColor,
} from "@/lib/types";
import { MARKER_COLORS } from "@/lib/types";

const RATES = [0.5, 0.75, 0.8, 1, 1.25, 1.5, 2];
const MARKER_COLOR_OPTIONS: MarkerColor[] = [
  "yellow",
  "white",
  "pink",
  "blue",
  "green",
];

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
        data-tooltip="节拍视觉设置"
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
  formationOpen: boolean;
  danmakuOn: boolean;
  showProgress: boolean;
  vizConfig: BeatVizConfig;
  onVizConfigChange: (config: BeatVizConfig) => void;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onPrevBeat: () => void;
  onNextBeat: () => void;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
  onSetRate: (r: number) => void;
  onToggleMirror: () => void;
  onToggleFormation: () => void;
  onToggleDanmaku: () => void;
  onOpenHints: () => void;
  onAddMarker: (data: {
    time: number;
    label: string;
    text: string;
    color: MarkerColor;
  }) => void;
  beatLoopName: string | null;
  onStopLoop: () => void;
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
      data-tooltip={title}
      aria-label={title}
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

function parseTimeInput(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length === 1) {
    const seconds = Number(parts[0]);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (
      Number.isFinite(minutes) &&
      Number.isFinite(seconds) &&
      minutes >= 0 &&
      seconds >= 0 &&
      seconds < 60
    ) {
      return minutes * 60 + seconds;
    }
  }
  return null;
}

function RateButton({
  value,
  onChange,
}: {
  value: number;
  onChange: (rate: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        title="播放速度"
        aria-label={`播放速度 ${value}倍`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 min-w-12 items-center justify-center rounded-lg px-2.5 text-xs font-medium tabular-nums text-neutral-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
          open && "bg-white/10 text-white",
        )}
      >
        {value}×
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-30 pb-2">
          <div
            role="menu"
            className="w-24 rounded-xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl"
          >
            {RATES.map((rate) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={rate === value}
                key={rate}
                onClick={() => {
                  onChange(rate);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs tabular-nums transition-colors hover:bg-white/10",
                  rate === value
                    ? "bg-blue-500/15 text-blue-300"
                    : "text-neutral-300",
                )}
              >
                {rate}×
                {rate === value && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VolumeControl(props: {
  volume: number;
  muted: boolean;
  onToggleMute: () => void;
  onChange: (volume: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const displayedVolume = props.muted ? 0 : props.volume;
  const muteLabel = props.muted || props.volume === 0 ? "取消静音" : "静音";

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={props.onToggleMute}
        data-tooltip={open ? undefined : muteLabel}
        aria-label={muteLabel}
        aria-expanded={open}
        className="flex h-9 items-center justify-center rounded-lg px-2.5 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {props.muted || props.volume === 0 ? (
          <VolumeX className="h-5 w-5" />
        ) : (
          <Volume2 className="h-5 w-5" />
        )}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-30 pb-2">
          <div className="flex w-14 flex-col items-center rounded-xl border border-white/10 bg-neutral-900 px-2 py-3 shadow-2xl">
            <span className="mb-2 text-xs font-medium tabular-nums text-neutral-300">
              {Math.round(displayedVolume * 100)}
            </span>
            <div className="relative flex h-24 w-8 items-center justify-center">
              <span className="absolute bottom-2 top-2 w-1 rounded-full bg-white/15" />
              <span
                className="absolute bottom-2 w-1 rounded-full bg-blue-500"
                style={{ height: `${displayedVolume * 80}px` }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={displayedVolume}
                onChange={(event) =>
                  props.onChange(parseFloat(event.target.value))
                }
                aria-label="音量"
                className="peer absolute h-8 w-20 -rotate-90 cursor-pointer opacity-0"
              />
              <span
                className="pointer-events-none absolute left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-900 bg-blue-400 shadow-md transition-[top] peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300"
                style={{ top: `${8 + (1 - displayedVolume) * 80}px` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HintMenu(props: {
  currentTime: number;
  duration: number;
  enabled: boolean;
  showTrigger: boolean;
  showToggle: boolean;
  initiallyOpen: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onAdd: ControlsProps["onAddMarker"];
}) {
  const [open, setOpen] = useState(props.initiallyOpen);
  const [time, setTime] = useState(() => formatTime(props.currentTime));
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [color, setColor] = useState<MarkerColor>("yellow");
  const ref = useRef<HTMLDivElement>(null);
  const parsedTime = parseTimeInput(time);
  const validTime = parsedTime != null && parsedTime <= props.duration;
  const canAdd = validTime && Boolean(label.trim() || text.trim());

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setTime(formatTime(props.currentTime));
    props.onOpen();
    setOpen(true);
  };

  const addHint = () => {
    if (!canAdd || parsedTime == null) return;
    props.onAdd({
      time: parsedTime,
      label: label.trim(),
      text: text.trim(),
      color,
    });
    setLabel("");
    setText("");
    setOpen(false);
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40";

  return (
    <div ref={ref} className="relative">
      {props.showTrigger && (
        <IconBtn
          title="动作提示"
          onClick={toggleOpen}
          active={open || props.enabled}
        >
          <MessageSquareText className="h-5 w-5" />
        </IconBtn>
      )}
      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-2 max-h-[calc(100dvh-5rem)] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 p-3 shadow-2xl">
          <h3 className="mb-3 text-sm font-semibold text-white">
            {props.showToggle ? "动作提示" : "添加提示"}
          </h3>

          {props.showToggle && (
            <>
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5">
                <div>
                  <div className="text-sm text-neutral-200">显示提示</div>
                  <div className="text-[11px] text-neutral-500">
                    在视频上显示已添加的动作提示
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={props.enabled}
                  aria-label="显示动作提示"
                  onClick={props.onToggle}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                    props.enabled ? "bg-blue-500" : "bg-neutral-600",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform",
                      props.enabled ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
              <div className="my-3 h-px bg-white/10" />
              <div className="mb-2 text-xs font-medium text-neutral-300">
                添加提示
              </div>
            </>
          )}
          <div className="space-y-2.5">
            <label className="block">
              <span className="mb-1 block text-[11px] text-neutral-500">时间点</span>
              <input
                value={time}
                onChange={(event) => setTime(event.target.value)}
                aria-invalid={!validTime}
                className={cn(inputClass, !validTime && "border-red-500/60")}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-neutral-500">提示</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="转身"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-neutral-500">说明</span>
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addHint()}
                placeholder="注意走位"
                className={inputClass}
              />
            </label>
            <fieldset>
              <legend className="mb-1.5 text-[11px] text-neutral-500">颜色</legend>
              <div className="flex gap-2">
                {MARKER_COLOR_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option}
                    data-tooltip={`选择${option}颜色`}
                    aria-label={`提示颜色 ${option}`}
                    aria-pressed={color === option}
                    onClick={() => setColor(option)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                      MARKER_COLORS[option].dot,
                      color === option
                        ? "scale-110 border-white"
                        : "border-transparent",
                    )}
                  />
                ))}
              </div>
            </fieldset>
          </div>
          <button
            type="button"
            disabled={!canAdd}
            onClick={addHint}
            className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-neutral-600 disabled:text-white"
          >
            <Plus className="h-4 w-4" />
            添加提示
          </button>
        </div>
      )}
    </div>
  );
}

function MoreMenu(props: {
  mirrored: boolean;
  formationOpen: boolean;
  hintsEnabled: boolean;
  onToggleMirror: () => void;
  onToggleFormation: () => void;
  onToggleHints: () => void;
  onAddHint: () => void;
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
  const checkbox = (checked: boolean) => (
    <span
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded border",
        checked
          ? "border-blue-500 bg-blue-500 text-white"
          : "border-white/25 text-transparent",
      )}
    >
      <Check className="h-3 w-3" />
    </span>
  );

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
            role="menuitemcheckbox"
            aria-checked={props.mirrored}
            onClick={props.onToggleMirror}
            className={cn(itemClass, props.mirrored && "text-blue-300")}
          >
            <FlipHorizontal2 className="h-4 w-4" />
            <span className="flex-1">镜像跟练</span>
            {checkbox(props.mirrored)}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={props.formationOpen}
            onClick={props.onToggleFormation}
            className={cn(itemClass, props.formationOpen && "text-blue-300")}
          >
            <UsersRound className="h-4 w-4" />
            <span className="flex-1">走位</span>
            {checkbox(props.formationOpen)}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={props.hintsEnabled}
            onClick={props.onToggleHints}
            className={cn(itemClass, props.hintsEnabled && "text-blue-300")}
          >
            <MessageSquareText className="h-4 w-4" />
            <span className="flex-1">显示提示</span>
            {checkbox(props.hintsEnabled)}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(props.onAddHint)}
            className={itemClass}
          >
            <Plus className="h-4 w-4" />
            添加提示
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
    formationOpen,
    danmakuOn,
  } = props;
  const rowRef = useRef<HTMLDivElement>(null);
  const [hintOpenRequest, setHintOpenRequest] = useState(0);
  const [rowWidth, setRowWidth] = useState(Number.POSITIVE_INFINITY);
  const compact = rowWidth < 790;
  const narrow = rowWidth < 480;
  const tiny = rowWidth < 420;

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = (width: number) => setRowWidth(width);
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
                  data-tooltip="取消循环"
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
      <div
        ref={rowRef}
        className={cn(
          "flex min-w-0 items-center py-2.5",
          compact ? "gap-0.5 px-2" : "gap-1 px-3 sm:px-5",
        )}
      >
        <IconBtn title="播放 / 暂停 (Space)" onClick={props.onTogglePlay}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </IconBtn>
        <IconBtn title="上一拍 (←)" onClick={props.onPrevBeat}>
          <SkipBack className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="下一拍 (→)" onClick={props.onNextBeat}>
          <SkipForward className="h-4 w-4" />
        </IconBtn>

        {!tiny && (
          <span
            className={cn(
              "whitespace-nowrap text-xs tabular-nums text-neutral-400",
              narrow ? "ml-1" : "ml-2",
            )}
          >
            {formatTime(currentTime)}
            {!narrow && ` / ${formatTime(duration)}`}
          </span>
        )}

        <div className="min-w-2 flex-1" />

        <div className={cn("flex shrink-0 items-center", compact ? "gap-0.5" : "gap-1")}>
          <VizModeButton
            config={props.vizConfig}
            onChange={props.onVizConfigChange}
          />

          {!compact && (
            <IconBtn title="镜像跟练" onClick={props.onToggleMirror} active={mirrored}>
              <FlipHorizontal2 className="h-5 w-5" />
            </IconBtn>
          )}

          {!compact && (
            <IconBtn
              title="走位"
              onClick={props.onToggleFormation}
              active={formationOpen}
            >
              <UsersRound className="h-5 w-5" />
            </IconBtn>
          )}

          {!compact && (
            <HintMenu
              currentTime={currentTime}
              duration={duration}
              enabled={danmakuOn}
              showTrigger
              showToggle
              initiallyOpen={false}
              onToggle={props.onToggleDanmaku}
              onOpen={props.onOpenHints}
              onAdd={props.onAddMarker}
            />
          )}

          <RateButton value={playbackRate} onChange={props.onSetRate} />

          <VolumeControl
            volume={volume}
            muted={muted}
            onToggleMute={props.onToggleMute}
            onChange={props.onSetVolume}
          />

          {compact && (
            <>
              <MoreMenu
                mirrored={mirrored}
                formationOpen={formationOpen}
                hintsEnabled={danmakuOn}
                onToggleMirror={props.onToggleMirror}
                onToggleFormation={props.onToggleFormation}
                onToggleHints={props.onToggleDanmaku}
                onAddHint={() => {
                  props.onOpenHints();
                  setHintOpenRequest((request) => request + 1);
                }}
              />
              <HintMenu
                key={hintOpenRequest}
                currentTime={currentTime}
                duration={duration}
                enabled={danmakuOn}
                showTrigger={false}
                showToggle={false}
                initiallyOpen={hintOpenRequest > 0}
                onToggle={props.onToggleDanmaku}
                onOpen={props.onOpenHints}
                onAdd={props.onAddMarker}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface FormationControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  mirrored: boolean;
  showMirror?: boolean;
  showProgress?: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onPrevBeat: () => void;
  onNextBeat: () => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onSetRate: (rate: number) => void;
  onToggleMirror: () => void;
}

export function FormationControls(props: FormationControlsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowWidth, setRowWidth] = useState(Number.POSITIVE_INFINITY);
  const narrow = rowWidth < 480;
  const tiny = rowWidth < 420;

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(([entry]) => {
      setRowWidth(entry.contentRect.width);
    });
    setRowWidth(row.getBoundingClientRect().width);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="shrink-0 border-t border-white/5 bg-black">
      {props.showProgress !== false && (
        <div className="px-5 pt-3">
          <ProgressBar
            currentTime={props.currentTime}
            duration={props.duration}
            onSeek={props.onSeek}
          />
        </div>
      )}
      <div
        ref={rowRef}
        className={cn(
          "flex min-w-0 items-center py-2.5",
          narrow ? "gap-0.5 px-2" : "gap-1 px-3 sm:px-5",
        )}
      >
        <IconBtn title="播放 / 暂停 (Space)" onClick={props.onTogglePlay}>
          {props.isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </IconBtn>
        <IconBtn title="上一个小拍" onClick={props.onPrevBeat}>
          <SkipBack className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="下一个小拍" onClick={props.onNextBeat}>
          <SkipForward className="h-4 w-4" />
        </IconBtn>

        {!tiny && (
          <span
            className={cn(
              "whitespace-nowrap text-xs tabular-nums text-neutral-400",
              narrow ? "ml-1" : "ml-2",
            )}
          >
            {formatTime(props.currentTime)}
            {!narrow && ` / ${formatTime(props.duration)}`}
          </span>
        )}

        <div className="min-w-2 flex-1" />

        <div className="flex shrink-0 items-center gap-0.5">
          {props.showMirror !== false && (
            <IconBtn
              title="镜像跟练"
              onClick={props.onToggleMirror}
              active={props.mirrored}
            >
              <FlipHorizontal2 className="h-5 w-5" />
            </IconBtn>
          )}
          <RateButton value={props.playbackRate} onChange={props.onSetRate} />
          <VolumeControl
            volume={props.volume}
            muted={props.muted}
            onToggleMute={props.onToggleMute}
            onChange={props.onSetVolume}
          />
        </div>
      </div>
    </div>
  );
}
