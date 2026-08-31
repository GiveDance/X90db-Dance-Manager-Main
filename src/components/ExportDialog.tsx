"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  X,
  Download,
  FlipHorizontal2,
  CircleDot,
  MessageSquareText,
  Timer,
  Loader2,
  Check,
  Users,
} from "lucide-react";
import {
  canExport,
  exportVideoWithOverlays,
  ExportAbortedError,
  type ExportOverlayOptions,
  type FormationExportPlacement,
} from "@/lib/videoExport";
import type {
  BeatVizConfig,
  FormationAudiencePosition,
  FormationChange,
  Marker,
  RhythmBeat,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/i18n/LanguageProvider";

interface ExportDialogProps {
  src: string;
  name: string;
  bpm: number;
  offset: number;
  beats?: RhythmBeat[];
  musicStart: number | null;
  countInStart: number | null;
  markers: Marker[];
  formationChanges: FormationChange[];
  formationAudiencePosition: FormationAudiencePosition;
  vizConfig: BeatVizConfig;
  mirrorEnabled?: boolean;
  formationEnabled?: boolean;
  markersEnabled?: boolean;
  onClose: () => void;
}

type Status = "idle" | "exporting" | "done" | "error";

function baseName(name: string) {
  return name.replace(/\.[^/.]+$/, "") || "dance";
}

const FORMATION_PLACEMENTS: {
  value: FormationExportPlacement;
  label: string;
}[] = [
  { value: "top", label: "上方" },
  { value: "bottom", label: "下方" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
  { value: "overlay", label: "画中" },
];

function FormationPlacementPreview({
  placement,
  beatVizEnabled,
  vizConfig,
  onChange,
  disabled,
}: {
  placement: FormationExportPlacement;
  beatVizEnabled: boolean;
  vizConfig: BeatVizConfig;
  onChange: (placement: FormationExportPlacement) => void;
  disabled: boolean;
}) {
  const { t, translateText } = useLanguage();
  const videoClass = cn(
    "absolute flex items-center justify-center border border-white/15 bg-neutral-800 text-[9px] text-neutral-500",
    placement === "top" &&
      "bottom-0 left-0 h-3/4 w-full",
    placement === "bottom" &&
      "left-0 top-0 h-3/4 w-full",
    placement === "left" &&
      "right-0 top-0 h-full w-3/4",
    placement === "right" &&
      "left-0 top-0 h-full w-3/4",
    placement === "overlay" && "inset-0",
  );
  const showCountPoints = beatVizEnabled && vizConfig.countPoints;
  const verticalCountPoints =
    vizConfig.countPointPosition === "left" ||
    vizConfig.countPointPosition === "right";
  const contentClass = cn(
    "absolute",
    !showCountPoints
      ? "inset-0"
      : vizConfig.countPointPosition === "top"
        ? "inset-x-0 bottom-0 h-3/4"
        : vizConfig.countPointPosition === "bottom"
          ? "inset-x-0 top-0 h-3/4"
          : vizConfig.countPointPosition === "left"
            ? "inset-y-0 right-0 w-4/5"
            : "inset-y-0 left-0 w-4/5",
  );
  const countPointClass = cn(
    "absolute z-10 flex border-white/15 bg-neutral-950 p-1.5",
    verticalCountPoints
      ? "inset-y-0 w-1/5 flex-col"
      : "inset-x-0 h-1/4 flex-row px-5",
    vizConfig.countPointPosition === "top" && "top-0 border-b",
    vizConfig.countPointPosition === "bottom" && "bottom-0 border-t",
    vizConfig.countPointPosition === "left" &&
      "left-0 border-r",
    vizConfig.countPointPosition === "right" &&
      "right-0 border-l",
  );
  const countPointItems =
    vizConfig.countPointStyle === "tiles"
      ? [1, 2, 3, 4]
      : [1, 2, 3, 4, 5, 6, 7, 8];
  const formationClass = cn(
    "absolute flex items-center justify-center overflow-hidden border border-blue-400/60 bg-neutral-950",
    placement === "top" &&
      "left-0 top-0 h-1/4 w-full",
    placement === "bottom" &&
      "bottom-0 left-0 h-1/4 w-full",
    placement === "left" &&
      "left-0 top-0 h-full w-1/4",
    placement === "right" &&
      "right-0 top-0 h-full w-1/4",
    placement === "overlay" &&
      "bottom-[8%] right-[4%] h-[30%] w-[32%] rounded-md bg-neutral-950/80",
  );

  return (
    <div className="border-t border-white/10 bg-black px-3 pb-3 pt-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-300">{t("走位位置")}</span>
        <span className="text-[10px] text-neutral-600">{t("布局示意")}</span>
      </div>
      <div className="relative mx-auto h-32 w-full max-w-72 overflow-hidden rounded-lg border border-white/10 bg-black">
        <div className={contentClass}>
          <div className={videoClass}>{t("视频")}</div>
          <div className={formationClass}>
            <span className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20%_25%]" />
            <span className="relative h-2.5 w-2.5 rounded-full border border-white bg-teal-700" />
            <span className="relative ml-2 h-2.5 w-2.5 rounded-full border border-white bg-orange-700" />
            <span className="relative ml-2 h-2.5 w-2.5 rounded-full border border-white bg-violet-700" />
          </div>
        </div>
        {showCountPoints && (
          <div
            className={cn(
              countPointClass,
              verticalCountPoints ? "gap-0 py-1" : "gap-1.5",
            )}
          >
            {countPointItems.map((count) => (
              <span
                key={count}
                className={cn(
                  "flex min-h-0 flex-1 items-center justify-center text-[7px] font-semibold",
                  vizConfig.countPointStyle === "tiles"
                    ? "min-w-0 rounded border"
                    : "gap-1",
                  vizConfig.countPointStyle === "tiles" && count === 1
                    ? "border-pink-500/50 bg-pink-500/20 text-pink-200"
                    : vizConfig.countPointStyle === "tiles"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-200/60"
                      : count === 1
                        ? "text-pink-200"
                        : "text-blue-200/60",
                )}
              >
                {vizConfig.countPointStyle === "dots" && (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full border",
                      count === 1
                        ? "border-pink-400 bg-pink-500/30"
                        : "border-blue-400/60 bg-blue-500/20",
                    )}
                  />
                )}
                <span>{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {FORMATION_PLACEMENTS.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-md border px-1.5 py-1.5 text-[11px] transition-colors disabled:opacity-50",
              placement === item.value
                ? "border-blue-500/60 bg-blue-500/15 text-blue-300"
                : "border-white/10 text-neutral-500 hover:bg-white/5 hover:text-neutral-300",
            )}
          >
            {translateText(item.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExportDialog({
  src,
  name,
  bpm,
  offset,
  beats,
  musicStart,
  countInStart,
  markers,
  formationChanges,
  formationAudiencePosition,
  vizConfig,
  mirrorEnabled = false,
  formationEnabled,
  markersEnabled = true,
  onClose,
}: ExportDialogProps) {
  const { language, t, translateText } = useLanguage();
  const [options, setOptions] = useState<ExportOverlayOptions>({
    mirror: mirrorEnabled,
    beatViz: true,
    markers: markersEnabled,
    countIn: true,
    formation:
      formationChanges.length > 0 &&
      (formationEnabled ?? true),
    formationPlacement: "overlay",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultExt, setResultExt] = useState<"mp4" | "webm">("mp4");
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  const supported = canExport();

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const triggerDownload = (blob: Blob, ext: string) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName(name)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const startExport = async () => {
    setStatus("exporting");
    setProgress(0);
    setErrorMsg("");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const { blob, ext } = await exportVideoWithOverlays({
        src,
        bpm,
        offset,
        beats: beats?.map((beat) => beat.time),
        musicStart,
        countInStart,
        markers,
        formationChanges,
        formationAudiencePosition,
        options,
        vizConfig,
        onProgress: setProgress,
        signal: ac.signal,
        language,
      });
      setResultExt(ext);
      triggerDownload(blob, ext);
      setStatus("done");
    } catch (e) {
      if (e instanceof ExportAbortedError) {
        setStatus("idle");
        return;
      }
      setErrorMsg("导出失败，可能是当前浏览器不支持视频录制。建议使用最新版 Chrome / Edge。");
      setStatus("error");
    }
  };

  const cancel = () => abortRef.current?.abort();

  type ToggleOption = "beatViz" | "countIn" | "mirror" | "formation" | "markers";
  const enabledVizLabels = [
    ...(vizConfig.countPoints
      ? [vizConfig.countPointStyle === "tiles" ? "方块计数" : "圆点计数"]
      : []),
    ...(vizConfig.pulse ? ["边缘脉冲"] : []),
    ...(vizConfig.breath ? ["呼吸光效"] : []),
  ];
  const OPTION_ROWS: {
    key: ToggleOption;
    label: string;
    desc: string;
    icon: React.ReactNode;
    disabled?: boolean;
  }[] = [
    {
      key: "beatViz",
      label: "节拍视觉",
      desc: enabledVizLabels.length
        ? language === "en"
          ? enabledVizLabels.map(translateText).join(", ")
          : enabledVizLabels.join("、")
        : "当前未启用任何节拍视觉效果",
      icon: <CircleDot className="h-4 w-4" />,
    },
    {
      key: "countIn",
      label: "预拍",
      desc: "音乐开始前加入 5-6-7-8",
      icon: <Timer className="h-4 w-4" />,
    },
    {
      key: "mirror",
      label: "镜像跟练",
      desc: "水平翻转视频",
      icon: <FlipHorizontal2 className="h-4 w-4" />,
    },
    {
      key: "formation",
      label: "走位",
      desc:
        formationChanges.length > 0
          ? "在视频中加入走位"
          : "没有可导出的走位",
      icon: <Users className="h-4 w-4" />,
      disabled: formationChanges.length === 0,
    },
    {
      key: "markers",
      label: "动作提示",
      desc: "在视频中加入动作提示",
      icon: <MessageSquareText className="h-4 w-4" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-2rem)] w-[min(520px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{t("导出视频")}</h3>
          <button
            type="button"
            onClick={onClose}
            data-tooltip={t("关闭")}
            aria-label={t("关闭导出")}
            className="text-neutral-500 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!supported ? (
          <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            {t("当前浏览器不支持视频录制导出。请使用最新版 Chrome 或 Edge。")}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {OPTION_ROWS.map((row) => {
                const checked = options[row.key];
                const isFormation = row.key === "formation";
                return (
                  <div
                    key={row.key}
                    className={cn(
                      isFormation && "overflow-hidden rounded-xl border",
                      isFormation &&
                        (checked
                          ? "border-blue-500/50 bg-blue-500/10"
                          : "border-white/10 bg-neutral-800/40"),
                    )}
                  >
                    <button
                      type="button"
                      disabled={status === "exporting" || row.disabled}
                      onClick={() =>
                        setOptions((current) => ({
                          ...current,
                          [row.key]: !current[row.key],
                        }))
                      }
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        isFormation
                          ? "bg-transparent hover:bg-white/5"
                          : cn(
                              "rounded-xl border",
                              checked
                                ? "border-blue-500/50 bg-blue-500/10"
                                : "border-white/10 bg-neutral-800/40 hover:bg-neutral-800",
                            ),
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          checked
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-neutral-800 text-neutral-400",
                        )}
                      >
                        {row.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-white">
                          {translateText(row.label)}
                        </span>
                        <span className="block text-xs text-neutral-500">
                          {translateText(row.desc)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-md border",
                          checked
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-white/20",
                        )}
                      >
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    {isFormation && checked && !row.disabled && (
                      <FormationPlacementPreview
                        placement={options.formationPlacement}
                        beatVizEnabled={options.beatViz}
                        vizConfig={vizConfig}
                        disabled={status === "exporting"}
                        onChange={(formationPlacement) =>
                          setOptions((current) => ({
                            ...current,
                            formationPlacement,
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {status === "exporting" && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("导出中…（耗时约等于视频时长）")}
                  </span>
                  <span className="tabular-nums">{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-[width] duration-200"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {status === "done" && (
              <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
                <Check className="h-4 w-4" />
                {t("导出完成，{format} 下载已开始。", {
                  format: resultExt.toUpperCase(),
                })}
              </p>
            )}

            {status === "error" && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                {translateText(errorMsg)}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {status === "exporting" ? (
                <button
                  onClick={cancel}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/10"
                >
                  {t("取消")}
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-400 hover:text-white"
                >
                  {status === "done" ? t("关闭") : t("取消")}
                </button>
              )}
              <button
                onClick={startExport}
                disabled={status === "exporting"}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {status === "done" ? t("重新导出") : t("导出 MP4")}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
