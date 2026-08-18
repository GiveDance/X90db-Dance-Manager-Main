"use client";

import { Sparkles } from "lucide-react";
import { GENERATED_TEMPLATE_DRAG_TYPE } from "@/lib/composition";
import type { GeneratedStageTemplate } from "@/lib/types";

const TEMPLATES: Array<{
  id: GeneratedStageTemplate;
  name: string;
  description: string;
  preview: string;
  thumbnail?: string;
}> = [
  {
    id: "street",
    name: "棱彩波谱",
    description: "高饱和棱彩 / 几何拼贴",
    preview: "bg-[#050713]",
    thumbnail: "/media/chromatic-impact-thumbnail.png",
  },
  {
    id: "pulse",
    name: "霓虹万花筒",
    description: "渐变霓虹 / 放射爱心",
    preview:
      "bg-[radial-gradient(circle,#f4f4ef_0_34%,transparent_38%),radial-gradient(circle,#f10d19_0_34%,transparent_38%),#000] bg-[size:14px_14px,18px_18px] bg-[position:0_0,7px_8px]",
    thumbnail: "/media/heart-marquee-thumbnail.png",
  },
  {
    id: "constellation",
    name: "粒子爆发",
    description: "光谱粒子 / 聚散爆发",
    preview:
      "bg-[radial-gradient(circle_at_35%_35%,#e1e7ff_0_1px,transparent_2px),radial-gradient(circle_at_70%_55%,#ef7053_0_1px,transparent_2px),radial-gradient(circle_at_50%_50%,rgba(101,73,232,0.24),transparent_27%),linear-gradient(135deg,#040208,#0d0812)]",
    thumbnail: "/media/coalesce-cue-thumbnail.png",
  },
  {
    id: "minimal",
    name: "极简舞台",
    description: "克制舞台 / 少干扰",
    preview:
      "bg-[linear-gradient(115deg,transparent_42%,rgba(225,231,255,0.15)_43%,transparent_44%),radial-gradient(circle_at_65%_45%,rgba(77,102,232,0.08),transparent_24%),linear-gradient(135deg,#030407,#0a0b12)]",
    thumbnail: "/media/minimal-stage-thumbnail.png",
  },
];

export function StageInspector() {
  return (
    <div className="grid grid-cols-2 gap-2 p-4">
      {TEMPLATES.map((template) => (
          <button
            type="button"
            key={template.id}
            draggable
            aria-label={`拖拽 ${template.name} 到合成时间线`}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData(
                GENERATED_TEMPLATE_DRAG_TYPE,
                template.id,
              );
            }}
            className="cursor-grab overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.025] text-left transition-colors hover:border-[#c4b5fd66] active:cursor-grabbing active:border-[#c4b5fd8c]"
          >
            <span
              className={`relative flex aspect-video items-center justify-center overflow-hidden ${template.preview}`}
            >
              {template.thumbnail ? (
                <img
                  src={template.thumbnail}
                  alt={`${template.name} 模板预览`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Sparkles className="h-5 w-5 text-white/35" />
              )}
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
        将生成素材拖拽到合成时间线的空白区域。
      </div>
    </div>
  );
}
