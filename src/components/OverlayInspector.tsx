"use client";

import type {
  PerformingStageSettings,
  StageSignalPosition,
} from "@/lib/types";

interface OverlayInspectorProps {
  settings: PerformingStageSettings;
  onChange: (patch: Partial<PerformingStageSettings>) => void;
}

const POSITIONS: Array<{ id: StageSignalPosition; label: string }> = [
  { id: "left", label: "左" },
  { id: "right", label: "右" },
  { id: "top", label: "上" },
  { id: "bottom", label: "下" },
];

function togglePosition(
  positions: StageSignalPosition[],
  position: StageSignalPosition,
): StageSignalPosition[] {
  return positions.includes(position)
    ? positions.filter((item) => item !== position)
    : [...positions, position];
}

function SignalControl({
  label,
  enabled,
  positions,
  onEnabledChange,
  onPositionsChange,
}: {
  label: string;
  enabled: boolean;
  positions: StageSignalPosition[];
  onEnabledChange: (enabled: boolean) => void;
  onPositionsChange: (positions: StageSignalPosition[]) => void;
}) {
  return (
    <div>
      <label className="flex items-center justify-between text-xs text-neutral-300">
        {label}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onEnabledChange(!enabled)}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            enabled ? "bg-violet-500" : "bg-neutral-800"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </label>
      <div className="mt-2 grid grid-cols-4 rounded-lg border border-white/[0.06] bg-black/40 p-1">
        {POSITIONS.map((position) => {
          const active = positions.includes(position.id);
          return (
            <button
              type="button"
              key={position.id}
              disabled={!enabled}
              onClick={() =>
                onPositionsChange(togglePosition(positions, position.id))
              }
              className={`rounded-md px-1 py-1.5 text-[11px] transition-colors disabled:opacity-30 ${
                active
                  ? "bg-violet-400/20 text-violet-200"
                  : "text-neutral-600 hover:text-neutral-300"
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

export function OverlayInspector({
  settings,
  onChange,
}: OverlayInspectorProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div>
        <p className="text-xs font-medium text-neutral-300">Performer signals</p>
        <p className="mt-1 text-[11px] leading-5 text-neutral-600">
          Rhythm and section cues overlay both generated and uploaded video.
        </p>
      </div>

      <div className="mt-5">
        <p className="flex justify-between text-xs text-neutral-300">
          Secondary accent
          <span className="text-violet-300">
            {settings.secondaryAccentCount === 0
              ? "Off"
              : `${settings.secondaryAccentCount}/8`}
          </span>
        </p>
        <div className="mt-2 grid grid-cols-4 rounded-lg border border-white/[0.06] bg-black/40 p-1">
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

      <div className="my-5 h-px bg-white/5" />

      <div className="space-y-5">
        <SignalControl
          label="节奏提示"
          enabled={settings.showBeatCode}
          positions={settings.beatCodePositions}
          onEnabledChange={(showBeatCode) => onChange({ showBeatCode })}
          onPositionsChange={(beatCodePositions) =>
            onChange({ beatCodePositions })
          }
        />
        <SignalControl
          label="章节提示"
          enabled={settings.showSectionRail}
          positions={settings.railPositions}
          onEnabledChange={(showSectionRail) => onChange({ showSectionRail })}
          onPositionsChange={(railPositions) => onChange({ railPositions })}
        />
      </div>

      <div className="my-5 h-px bg-white/5" />

      <label className="block">
        <span className="flex justify-between text-xs text-neutral-300">
          Visual lead
          <span className="tabular-nums text-violet-300">
            {settings.visualLeadMs} ms
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={300}
          step={20}
          value={settings.visualLeadMs}
          onChange={(event) =>
            onChange({ visualLeadMs: Number(event.target.value) })
          }
          className="mt-3 w-full accent-violet-400"
        />
        <span className="mt-2 block text-[11px] leading-5 text-neutral-700">
          Show visual cues slightly before the audible beat for stage readability.
        </span>
      </label>
    </div>
  );
}
