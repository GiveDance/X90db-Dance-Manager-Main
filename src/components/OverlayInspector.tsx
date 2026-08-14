"use client";

import { useState } from "react";
import {
  ChevronDown,
  Eye,
  Grid2X2,
  Sparkles,
} from "lucide-react";
import {
  BEAT_POINT_SHAPES,
  CORNER_SIGNAL_SHAPES,
  PERFORMER_SIGNAL_THEMES,
} from "@/lib/performerSignal";
import type {
  PerformingStageSettings,
  StageSignalPosition,
} from "@/lib/types";
import { Toggle } from "./Toggle";

interface OverlayInspectorProps {
  settings: PerformingStageSettings;
  onChange: (patch: Partial<PerformingStageSettings>) => void;
}

const POSITIONS: Array<{ id: StageSignalPosition; label: string }> = [
  { id: "top", label: "顶部" },
  { id: "bottom", label: "底部" },
  { id: "left", label: "左侧" },
  { id: "right", label: "右侧" },
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-neutral-500">{label}</span>
      <span className="flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/30 px-1.5">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
          onChange={(event) => onChange(event.target.value)}
          className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent font-mono text-[10px] uppercase text-neutral-300 outline-none"
        />
      </span>
    </label>
  );
}

function ThemePicker({
  value,
  beatColor,
  accentColor,
  onPresetChange,
  onBeatColorChange,
  onAccentColorChange,
}: {
  value: PerformingStageSettings["cornerSignalTheme"];
  beatColor: string;
  accentColor: string;
  onPresetChange: (
    value: PerformingStageSettings["cornerSignalTheme"],
    beatColor: string,
    accentColor: string,
  ) => void;
  onBeatColorChange: (value: string) => void;
  onAccentColorChange: (value: string) => void;
}) {
  const rgbToHex = (rgb: [number, number, number]) =>
    `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  return (
    <div>
      <p className="mb-1.5 text-[11px] text-neutral-500">配色</p>
      <div className="grid grid-cols-2 gap-1">
        {PERFORMER_SIGNAL_THEMES.map((theme) => (
          (() => {
            const themeBeat = rgbToHex(theme.beat);
            const themeAccent = rgbToHex(theme.down);
            const selected =
              value === theme.id &&
              beatColor.toLowerCase() === themeBeat &&
              accentColor.toLowerCase() === themeAccent;
            return (
              <button
                type="button"
                key={theme.id}
                onClick={() =>
                  onPresetChange(theme.id, themeBeat, themeAccent)
                }
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  selected
                    ? "bg-neutral-700 text-white"
                    : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                  style={{
                    background: `linear-gradient(135deg, rgb(${theme.beat.join(",")}) 50%, rgb(${theme.down.join(",")}) 50%)`,
                  }}
                />
                {theme.label}
              </button>
            );
          })()
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <ColorField
          label="轻拍色"
          value={beatColor}
          onChange={onBeatColorChange}
        />
        <ColorField
          label="重拍色"
          value={accentColor}
          onChange={onAccentColorChange}
        />
      </div>
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] text-neutral-500">
        {label}
        <span className="tabular-nums text-neutral-300">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-violet-400"
      />
    </label>
  );
}

function PositionPicker({
  value,
  onChange,
}: {
  value: StageSignalPosition[];
  onChange: (value: StageSignalPosition[]) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] text-neutral-500">位置 · 可多选</p>
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/25 p-1">
        {POSITIONS.map((position) => {
          const active = value.includes(position.id);
          return (
            <button
              type="button"
              key={position.id}
              aria-pressed={active}
              onClick={() =>
                onChange(
                  active
                    ? value.filter((item) => item !== position.id)
                    : [...value, position.id],
                )
              }
              className={`rounded-md px-1 py-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
              }`}
            >
              {position.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SignalCard({
  title,
  description,
  enabled,
  icon,
  expanded,
  order,
  onExpandedChange,
  onEnabledChange,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  icon: React.ReactNode;
  expanded: boolean;
  order: string;
  onExpandedChange: (expanded: boolean) => void;
  onEnabledChange: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`${order} overflow-hidden rounded-lg border transition-colors ${
        enabled ? "border-violet-500/25" : "border-white/[0.06]"
      }`}
    >
      <div
        className={`flex items-center gap-2.5 px-3 py-2.5 ${
          enabled ? "bg-violet-500/10" : "bg-white/[0.025]"
        }`}
      >
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-violet-300">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-neutral-200">
              {title}
            </span>
            <span className="block truncate text-[11px] text-neutral-500">
              {description}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label={`${expanded ? "收起" : "展开"}${title}`}
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-white/5 hover:text-neutral-300"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>
        <Toggle
          checked={enabled}
          onChange={onEnabledChange}
          label={title}
          accent="violet"
        />
      </div>
      {expanded && (
        <div
          className={`space-y-4 border-t border-violet-500/15 bg-black/25 p-3 ${
            enabled ? "" : "pointer-events-none opacity-35"
          }`}
        >
          {children}
        </div>
      )}
    </section>
  );
}

export function OverlayInspector({
  settings,
  onChange,
}: OverlayInspectorProps) {
  const [beatPointsExpanded, setBeatPointsExpanded] = useState(true);
  const [cornerExpanded, setCornerExpanded] = useState(false);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div>
        <p className="text-sm font-semibold text-white">节拍信号</p>
      </div>

      <section className="mt-4">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-neutral-300">节拍设定</p>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-neutral-300">次重拍</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                选择使用重拍色的拍点
              </p>
            </div>
            <span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-[10px] tabular-nums text-violet-300">
              {settings.secondaryAccentCount === 0
                ? "关闭"
                : `${settings.secondaryAccentCount}/8`}
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-4 rounded-lg border border-white/[0.06] bg-black/40 p-1">
            {[0, 2, 3, 4, 5, 6, 7, 8].map((count) => (
              <button
                type="button"
                key={count}
                onClick={() => onChange({ secondaryAccentCount: count })}
                className={`rounded-md px-1 py-1.5 text-[11px] transition-colors ${
                  settings.secondaryAccentCount === count
                    ? "bg-violet-400/20 text-violet-200"
                    : "text-neutral-600 hover:text-neutral-300"
                }`}
              >
                {count === 0 ? "关" : count}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-neutral-300">信号视觉</p>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <SignalCard
          title="四角闪烁"
          description="在四角随每拍闪烁"
          enabled={settings.cornerSignalEnabled}
          icon={<Sparkles className="h-4 w-4" />}
          expanded={cornerExpanded}
          order="order-2"
          onExpandedChange={setCornerExpanded}
          onEnabledChange={(cornerSignalEnabled) =>
            onChange({ cornerSignalEnabled })
          }
        >
          <div>
            <p className="mb-1.5 text-[11px] text-neutral-500">样式</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/25 p-1">
              {CORNER_SIGNAL_SHAPES.map((shape) => (
                <button
                  type="button"
                  key={shape.id}
                  onClick={() => onChange({ cornerSignalShape: shape.id })}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    settings.cornerSignalShape === shape.id
                      ? "bg-neutral-700 text-white"
                      : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                  }`}
                >
                  {shape.label}
                </button>
              ))}
            </div>
          </div>
          <ThemePicker
            value={settings.cornerSignalTheme}
            beatColor={settings.cornerSignalBeatColor}
            accentColor={settings.cornerSignalAccentColor}
            onPresetChange={(
              cornerSignalTheme,
              cornerSignalBeatColor,
              cornerSignalAccentColor,
            ) =>
              onChange({
                cornerSignalTheme,
                cornerSignalBeatColor,
                cornerSignalAccentColor,
              })
            }
            onBeatColorChange={(cornerSignalBeatColor) =>
              onChange({ cornerSignalBeatColor })
            }
            onAccentColorChange={(cornerSignalAccentColor) =>
              onChange({ cornerSignalAccentColor })
            }
          />
          <RangeControl
            label="大小"
            value={settings.cornerSignalSize}
            min={0.6}
            max={1.8}
            step={0.05}
            display={`${Math.round(settings.cornerSignalSize * 100)}%`}
            onChange={(cornerSignalSize) => onChange({ cornerSignalSize })}
          />
          <RangeControl
            label="透明度"
            value={settings.cornerSignalOpacity}
            min={0.2}
            max={1}
            step={0.05}
            display={`${Math.round(settings.cornerSignalOpacity * 100)}%`}
            onChange={(cornerSignalOpacity) =>
              onChange({ cornerSignalOpacity })
            }
          />
          </SignalCard>

          <SignalCard
          title="拍点视觉"
          description="显示当前八拍和计数位置"
          enabled={settings.showBeatCode}
          icon={<Grid2X2 className="h-4 w-4" />}
          expanded={beatPointsExpanded}
          order="order-1"
          onExpandedChange={setBeatPointsExpanded}
          onEnabledChange={(showBeatCode) => onChange({ showBeatCode })}
        >
          <div>
            <p className="mb-1.5 text-[11px] text-neutral-500">样式</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/25 p-1">
              {BEAT_POINT_SHAPES.map((shape) => (
                <button
                  type="button"
                  key={shape.id}
                  onClick={() => onChange({ beatPointShape: shape.id })}
                  className={`rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${
                    settings.beatPointShape === shape.id
                      ? "bg-neutral-700 text-white"
                      : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                  }`}
                >
                  {shape.label}
                </button>
              ))}
            </div>
          </div>
          <ThemePicker
            value={settings.beatPointTheme}
            beatColor={settings.beatPointBeatColor}
            accentColor={settings.beatPointAccentColor}
            onPresetChange={(
              beatPointTheme,
              beatPointBeatColor,
              beatPointAccentColor,
            ) =>
              onChange({
                beatPointTheme,
                beatPointBeatColor,
                beatPointAccentColor,
              })
            }
            onBeatColorChange={(beatPointBeatColor) =>
              onChange({ beatPointBeatColor })
            }
            onAccentColorChange={(beatPointAccentColor) =>
              onChange({ beatPointAccentColor })
            }
          />
          <PositionPicker
            value={settings.beatCodePositions}
            onChange={(beatCodePositions) => onChange({ beatCodePositions })}
          />
          <div>
            <p className="mb-1.5 text-[11px] text-neutral-500">排列</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/25 p-1">
              {([1, 2] as const).map((rows) => (
                <button
                  type="button"
                  key={rows}
                  onClick={() => onChange({ beatPointRows: rows })}
                  className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    settings.beatPointRows === rows
                      ? "bg-neutral-700 text-white"
                      : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                  }`}
                >
                  {rows === 1 ? "单行" : "双行"}
                </button>
              ))}
            </div>
          </div>
          <RangeControl
            label="大小"
            value={settings.beatPointSize}
            min={0.6}
            max={1.8}
            step={0.05}
            display={`${Math.round(settings.beatPointSize * 100)}%`}
            onChange={(beatPointSize) => onChange({ beatPointSize })}
          />
          <RangeControl
            label="拍点间距"
            value={settings.beatPointSpacing}
            min={0.5}
            max={1.5}
            step={0.05}
            display={`${Math.round(settings.beatPointSpacing * 100)}%`}
            onChange={(beatPointSpacing) => onChange({ beatPointSpacing })}
          />
          <RangeControl
            label="透明度"
            value={settings.beatPointOpacity}
            min={0.2}
            max={1}
            step={0.05}
            display={`${Math.round(settings.beatPointOpacity * 100)}%`}
            onChange={(beatPointOpacity) => onChange({ beatPointOpacity })}
          />
          </SignalCard>

          {(settings.showBeatCode || settings.cornerSignalEnabled) && (
            <section
              className={`order-3 overflow-hidden rounded-lg border transition-colors ${
                settings.visualLeadEnabled
                  ? "border-violet-500/25"
                  : "border-white/[0.06]"
              }`}
            >
              <div
                className={`flex items-center gap-2.5 px-3 py-2.5 ${
              settings.visualLeadEnabled
                ? "bg-violet-500/10"
                : "bg-white/[0.025]"
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-violet-300">
                  <Eye className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-200">
                    视觉预告
                  </span>
                  <span className="block truncate text-[11px] text-neutral-500">
                    显示开头预数拍
                  </span>
                </span>
                <Toggle
                  checked={settings.visualLeadEnabled}
                  onChange={(visualLeadEnabled) =>
                    onChange({ visualLeadEnabled })
                  }
                  label="视觉预告"
                  accent="violet"
                />
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
