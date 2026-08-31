"use client";

import { Loader2, Check } from "lucide-react";
import type { AnalyzeStage } from "@/lib/beatDetection";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/i18n/LanguageProvider";
import { DevToolsButton } from "./DevToolsButton";

const STAGES: { key: AnalyzeStage; label: string }[] = [
  { key: "decode", label: "解码音频" },
  { key: "detect", label: "AI 检测节拍（本地）" },
  { key: "segment", label: "切分八拍" },
];

const ORDER: AnalyzeStage[] = ["decode", "detect", "segment"];

interface AnalyzingScreenProps {
  stage: AnalyzeStage;
  fileName: string;
}

export function AnalyzingScreen({ stage, fileName }: AnalyzingScreenProps) {
  const current = ORDER.indexOf(stage);
  const { t, translateText } = useLanguage();

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black px-6">
      <div className="absolute right-4 top-4">
        <DevToolsButton />
      </div>
      <div className="w-full max-w-md" role="status" aria-live="polite">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-white">{t("正在分析音频…")}</h2>
          <p className="mt-1 truncate text-sm text-neutral-500" title={fileName}>
            {fileName}
          </p>
        </div>

        <div className="space-y-3">
          {STAGES.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <div
                key={s.key}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
                  active
                    ? "border-blue-500/40 bg-blue-500/10"
                    : done
                      ? "border-neutral-800 bg-neutral-900/40"
                      : "border-neutral-800/60 bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    done
                      ? "bg-emerald-500/20 text-emerald-400"
                      : active
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-neutral-800 text-neutral-500",
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    active ? "text-white" : done ? "text-neutral-400" : "text-neutral-600",
                  )}
                >
                  {translateText(s.label)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-neutral-600">
          {t("节拍检测完全在本地完成，音频不会上传到任何服务器。")}
        </p>
      </div>
    </div>
  );
}
