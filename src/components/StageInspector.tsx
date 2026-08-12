"use client";

import { Clapperboard, Sparkles } from "lucide-react";
import type {
  GeneratedStageTemplate,
  PerformingStageSettings,
} from "@/lib/types";

interface StageInspectorProps {
  settings: PerformingStageSettings;
  onChange: (patch: Partial<PerformingStageSettings>) => void;
}

const TEMPLATES: Array<{
  id: GeneratedStageTemplate;
  name: string;
  description: string;
}> = [
  { id: "street", name: "Street Signal", description: "街舞霓虹 / 8 拍可读" },
  { id: "pulse", name: "Aurora Pulse", description: "柔和氛围 / 光环呼吸" },
  {
    id: "constellation",
    name: "Coalesce Cue",
    description: "粒子聚合 / cue 爆发",
  },
  { id: "minimal", name: "Minimal Stage", description: "克制舞台 / 少干扰" },
];

export function StageInspector({
  settings,
  onChange,
}: StageInspectorProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div>
        <p className="text-xs font-medium text-neutral-300">Background source</p>
        <p className="mt-1 text-[11px] leading-5 text-neutral-600">
          Choose generated visuals or the uploaded clip composition.
        </p>
        <div className="mt-3 grid grid-cols-2 rounded-xl border border-white/[0.07] bg-black/50 p-1">
          <button
            type="button"
            onClick={() => onChange({ backgroundMode: "generated" })}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-[11px] transition-colors ${
              settings.backgroundMode === "generated"
                ? "bg-violet-400/15 text-violet-200"
                : "text-neutral-600 hover:text-neutral-300"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generated
          </button>
          <button
            type="button"
            onClick={() => onChange({ backgroundMode: "video" })}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-[11px] transition-colors ${
              settings.backgroundMode === "video"
                ? "bg-violet-400/15 text-violet-200"
                : "text-neutral-600 hover:text-neutral-300"
            }`}
          >
            <Clapperboard className="h-3.5 w-3.5" />
            Video
          </button>
        </div>
      </div>

      <div className="my-5 h-px bg-white/5" />

      <div>
        <p className="text-xs font-medium text-neutral-300">
          Local generated templates
        </p>
        <p className="mt-1 text-[11px] leading-5 text-neutral-600">
          Driven by the shared beat and eight-count timeline.
        </p>
        <div className="mt-3 space-y-2">
          {TEMPLATES.map((template) => (
            <button
              type="button"
              key={template.id}
              onClick={() =>
                onChange({
                  template: template.id,
                  backgroundMode: "generated",
                })
              }
              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                settings.template === template.id &&
                settings.backgroundMode === "generated"
                  ? "border-violet-300/50 bg-violet-400/10"
                  : "border-white/[0.07] bg-white/[0.025] hover:border-white/15"
              }`}
            >
              <strong className="block text-xs font-medium text-neutral-200">
                {template.name}
              </strong>
              <span className="mt-1 block text-[11px] text-neutral-600">
                {template.description}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-neutral-700">
          Templates control the background only. Performer signals are configured
          separately in Overlay.
        </p>
      </div>
    </div>
  );
}
