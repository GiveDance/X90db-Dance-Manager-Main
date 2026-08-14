"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import {
  DEFAULT_GRADIENT_SETTINGS,
  type GradientSettings,
} from "./InteractiveGradient";

const STORAGE_KEY = "dance-manager-gradient-settings-v9";

interface GradientTunerProps {
  settings: GradientSettings;
  onChange: (settings: GradientSettings) => void;
}

interface SliderDefinition {
  key: keyof GradientSettings;
  label: string;
  min: number;
  max: number;
  step: number;
}

const groups: { title: string; sliders: SliderDefinition[] }[] = [
  {
    title: "构图",
    sliders: [
      { key: "topPosition", label: "顶部色带", min: -0.15, max: 0.18, step: 0.005 },
      { key: "mainPosition", label: "主色带高度", min: 0.25, max: 0.72, step: 0.005 },
      { key: "mainSlope", label: "主色带倾斜", min: -0.35, max: 0.45, step: 0.005 },
      { key: "lowerPosition", label: "底部色带", min: 0.82, max: 1.24, step: 0.005 },
    ],
  },
  {
    title: "质感",
    sliders: [
      { key: "coreWidth", label: "发光核心宽度", min: 0.35, max: 2.2, step: 0.01 },
      { key: "edgeWidth", label: "青蓝边缘宽度", min: 0.35, max: 2.2, step: 0.01 },
      { key: "brightness", label: "色带亮度", min: 0.35, max: 1.5, step: 0.01 },
      { key: "warp", label: "自然起伏", min: 0, max: 2.5, step: 0.01 },
      { key: "grain", label: "颗粒", min: 0, max: 0.16, step: 0.001 },
      { key: "speed", label: "流动速度", min: 0, max: 3, step: 0.01 },
    ],
  },
  {
    title: "节拍形变",
    sliders: [
      { key: "bpm", label: "BPM", min: 30, max: 180, step: 1 },
      { key: "beatWarp", label: "波形振动", min: 0, max: 3, step: 0.01 },
      { key: "beatExpansion", label: "边缘扩张", min: 0, max: 3, step: 0.01 },
    ],
  },
  {
    title: "鼠标透镜",
    sliders: [
      { key: "mouseFollow", label: "跟随速度", min: 0.05, max: 1, step: 0.01 },
      { key: "morphDiameter", label: "形变区域直径 px", min: 200, max: 1200, step: 10 },
      { key: "morphStrength", label: "形变强度", min: 0, max: 0.15, step: 0.001 },
      { key: "mouseTiltInfluence", label: "X · 倾斜控制", min: 0, max: 0.5, step: 0.01 },
      { key: "mouseWidthInfluence", label: "Y · 宽度控制", min: 0, max: 0.8, step: 0.01 },
    ],
  },
];

const colors: { key: "coreColor" | "edgeColor" | "falloffColor"; label: string }[] = [
  { key: "coreColor", label: "发光核心" },
  { key: "edgeColor", label: "青蓝边缘" },
  { key: "falloffColor", label: "外层衰减" },
];

function displayValue(value: number, step: number) {
  if (step >= 1) return Math.round(value).toString();
  if (step >= 0.01) return value.toFixed(2);
  return value.toFixed(3);
}

function normalizeHex(value: string) {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split("")
      .map((character) => character + character)
      .join("")
      .toLowerCase()}`;
  }
  return null;
}

interface HexColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function HexColorField({ label, value, onChange }: HexColorFieldProps) {
  const [draft, setDraft] = useState(value);

  const updateDraft = (nextValue: string) => {
    setDraft(nextValue);
    const normalized = normalizeHex(nextValue);
    if (normalized) onChange(normalized);
  };

  const commitDraft = () => {
    const normalized = normalizeHex(draft);
    if (normalized) {
      setDraft(normalized);
      onChange(normalized);
    } else {
      setDraft(value);
    }
  };

  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2">
      <span className="text-[11px] text-neutral-400">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(value);
              event.currentTarget.blur();
            }
          }}
          aria-label={`${label} Hex 色值`}
          spellCheck={false}
          className="h-7 w-[82px] rounded-md border border-white/10 bg-black/40 px-2 font-mono text-[11px] text-neutral-200 outline-none focus:border-orange-400/70"
        />
      </span>
    </label>
  );
}

export function GradientTuner({ settings, onChange }: GradientTunerProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!isDevelopment) return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      onChange({
        ...DEFAULT_GRADIENT_SETTINGS,
        ...(JSON.parse(saved) as Partial<GradientSettings>),
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [isDevelopment, onChange]);

  useEffect(() => {
    if (!isDevelopment) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [isDevelopment, settings]);

  if (!isDevelopment) return null;

  const update = <Key extends keyof GradientSettings>(
    key: Key,
    value: GradientSettings[Key],
  ) => {
    onChange({ ...settings, [key]: value });
  };

  const copySettings = async () => {
    await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const reset = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    onChange(DEFAULT_GRADIENT_SETTINGS);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        背景参数
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 flex max-h-[calc(100vh-6rem)] w-[340px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">背景参数</p>
              <p className="mt-0.5 text-[10px] text-neutral-500">调整会实时保存到本机</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="关闭背景参数"
              className="rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3">
            {groups.map((group) => (
              <section key={group.title} className="mb-5 last:mb-2">
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  {group.title}
                </h3>
                <div className="space-y-3">
                  {group.sliders.map((slider) => {
                    const value = settings[slider.key];
                    if (typeof value !== "number") return null;
                    return (
                      <label key={slider.key} className="block">
                        <span className="mb-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">{slider.label}</span>
                          <span className="font-mono text-neutral-500">
                            {displayValue(value, slider.step)}
                          </span>
                        </span>
                        <input
                          type="range"
                          min={slider.min}
                          max={slider.max}
                          step={slider.step}
                          value={value}
                          onChange={(event) =>
                            update(slider.key, Number(event.target.value))
                          }
                          className="h-1.5 w-full cursor-pointer accent-orange-500"
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}

            <section>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                色彩
              </h3>
              <div className="space-y-2">
                {colors.map(({ key, label }) => (
                  <HexColorField
                    key={`${key}:${settings[key]}`}
                    label={label}
                    value={settings[key]}
                    onChange={(value) => update(key, value)}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="flex gap-2 border-t border-white/8 p-3">
            <button
              type="button"
              onClick={reset}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 text-xs text-neutral-400 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重置
            </button>
            <button
              type="button"
              onClick={copySettings}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500 text-xs font-semibold text-black hover:bg-orange-400"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "已复制" : "复制最终参数"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
