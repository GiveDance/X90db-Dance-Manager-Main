"use client";

import { Sparkles } from "lucide-react";
import { GENERATED_TEMPLATE_DRAG_TYPE } from "@/lib/composition";
import type { GeneratedStageTemplate } from "@/lib/types";

const TEMPLATES: Array<{
  id: GeneratedStageTemplate;
  name: string;
  description: string;
  preview: string;
}> = [
  {
    id: "street",
    name: "Street Signal",
    description: "街舞霓虹 / 8 拍可读",
    preview:
      "bg-[radial-gradient(circle_at_50%_100%,rgba(244,63,94,0.55),transparent_45%),linear-gradient(135deg,#09090b,#27112d)]",
  },
  {
    id: "pulse",
    name: "Aurora Pulse",
    description: "柔和氛围 / 光环呼吸",
    preview:
      "bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.5),transparent_35%),linear-gradient(135deg,#07101c,#201047)]",
  },
  {
    id: "constellation",
    name: "Coalesce Cue",
    description: "粒子聚合 / cue 爆发",
    preview:
      "bg-[radial-gradient(circle_at_35%_35%,#fff_0_1px,transparent_2px),radial-gradient(circle_at_70%_55%,#c4b5fd_0_1px,transparent_2px),linear-gradient(135deg,#080812,#17113a)]",
  },
  {
    id: "minimal",
    name: "Minimal Stage",
    description: "克制舞台 / 少干扰",
    preview:
      "bg-[linear-gradient(115deg,transparent_42%,rgba(255,255,255,0.18)_43%,transparent_44%),linear-gradient(135deg,#050505,#171717)]",
  },
];

export function StageInspector() {
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {TEMPLATES.map((template) => (
          <button
            type="button"
            key={template.id}
            draggable
            aria-label={`Drag ${template.name} to the composition timeline`}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData(
                GENERATED_TEMPLATE_DRAG_TYPE,
                template.id,
              );
            }}
            className="cursor-grab overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.025] text-left transition-colors hover:border-violet-300/40 active:cursor-grabbing"
          >
            <span
              className={`relative flex aspect-video items-center justify-center ${template.preview}`}
            >
              <Sparkles className="h-5 w-5 text-white/35" />
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider text-white/60">
                Generated
              </span>
            </span>
            <span className="block px-2.5 py-2">
              <strong className="block truncate text-[11px] font-medium text-neutral-200">
                {template.name}
              </strong>
              <span className="mt-0.5 block truncate text-[9px] text-neutral-600">
                {template.description}
              </span>
            </span>
          </button>
      ))}
      <div className="col-span-2 mt-1 text-[10px] leading-4 text-neutral-700">
        Drag a generated material onto an empty composition range.
      </div>
    </div>
  );
}
