"use client";

import {
  Activity,
  GraduationCap,
  Smartphone,
  Sparkles,
  Watch,
} from "lucide-react";
import { useCallback, useRef } from "react";
import { Uploader } from "./Uploader";
import { ProjectLibrary } from "./ProjectLibrary";
import { LandingExperience } from "./LandingExperience";
import { SharedHomeHeadline } from "./SharedHomeHeadline";
import { DevToolsButton } from "./DevToolsButton";
import type { PerformingProject, SavedDanceMeta } from "@/lib/types";
import { cn } from "@/lib/cn";

export type WorkspaceMode = "learning" | "performing";

interface HomeProps {
  dances: SavedDanceMeta[];
  loading: boolean;
  onFile: (file: File) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onCreatePerformance: (id: string) => void;
  onCreateLearning: (id: string) => void;
  openingId: string | null;
  creatingPerformanceId: string | null;
  creatingLearningId: string | null;
  libraryError: string | null;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  performingProjects: PerformingProject[];
  performingLoading: boolean;
  performingOpeningId: string | null;
  onOpenPerformingProject: (id: string) => void;
  onDeletePerformingProject: (id: string) => void;
}

export function Home({
  dances,
  loading,
  onFile,
  onOpen,
  onDelete,
  onExport,
  onCreatePerformance,
  onCreateLearning,
  openingId,
  creatingPerformanceId,
  creatingLearningId,
  libraryError,
  mode,
  onModeChange,
  performingProjects,
  performingLoading,
  performingOpeningId,
  onOpenPerformingProject,
  onDeletePerformingProject,
}: HomeProps) {
  const workspaceRef = useRef<HTMLElement>(null);
  const homeScrollRef = useRef<HTMLDivElement>(null);
  const enterWorkspace = useCallback(
    (nextMode: WorkspaceMode) => {
      onModeChange(nextMode);
      window.requestAnimationFrame(() => {
        const scroller = homeScrollRef.current;
        const workspace = workspaceRef.current;
        if (!scroller || !workspace) return;
        scroller.scrollTo({
          top: workspace.offsetTop,
          behavior: "smooth",
        });
      });
    },
    [onModeChange],
  );
  const modeFeatures =
    mode === "learning"
      ? ["节奏拆解", "节拍可视化", "分段练习", "团舞走位设计"]
      : ["节拍可视化", "生成素材", "自由合成"];
  const earlyAccessFeatures = [
    {
      title: "动作校准器",
      icon: Activity,
      iconClass: "bg-blue-400/10 text-blue-300",
    },
    {
      title: "随身节拍震动器",
      icon: Smartphone,
      iconClass: "bg-violet-400/10 text-violet-300",
      secondaryIcon: Watch,
    },
  ];

  return (
    <div
      ref={homeScrollRef}
      className="relative h-full overflow-y-auto bg-black text-white"
    >
      <SharedHomeHeadline scrollerRef={homeScrollRef} />
      <div className="absolute right-6 top-6 z-10">
        <DevToolsButton />
      </div>
      <LandingExperience onEnter={enterWorkspace} />
      <section
        ref={workspaceRef}
        aria-label="Dance Manager 功能区"
        className="relative z-[3] min-h-full"
      >
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-11">
        <div className="mb-8 h-[74px]" aria-hidden="true" />

        <section>
          <div className="mb-3 inline-flex rounded-xl border border-white/[0.08] bg-white/[0.035] p-1">
          <button
            type="button"
            aria-pressed={mode === "learning"}
            onClick={() => onModeChange("learning")}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
              mode === "learning"
                ? "bg-blue-500/20 text-blue-200"
                : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300",
            )}
          >
            <GraduationCap className="h-4 w-4" />
            练习
          </button>
          <button
            type="button"
            aria-pressed={mode === "performing"}
            onClick={() => onModeChange("performing")}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
              mode === "performing"
                ? "bg-violet-500/20 text-violet-200"
                : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300",
            )}
          >
            <Sparkles className="h-4 w-4" />
            演出
          </button>
          </div>

          <div className="mb-5 flex min-h-7 flex-wrap items-center gap-x-5 gap-y-2">
            {modeFeatures.map((feature, index) => (
              <span key={feature} className="flex items-center gap-5">
                {index > 0 && (
                  <span className="h-1 w-1 rounded-full bg-neutral-700" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    mode === "learning"
                      ? "text-blue-200/70"
                      : "text-violet-200/70",
                  )}
                >
                  {feature}
                </span>
              </span>
            ))}
          </div>

          <Uploader onFile={onFile} mode={mode} />
        </section>

        {libraryError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {libraryError}
          </div>
        )}

        <ProjectLibrary
          mode={mode}
          dances={dances}
          performingProjects={performingProjects}
          loading={loading || performingLoading}
          openingLearningId={openingId}
          openingPerformingId={performingOpeningId}
          creatingLearningId={creatingLearningId}
          creatingPerformanceId={creatingPerformanceId}
          onOpenLearning={onOpen}
          onOpenPerforming={onOpenPerformingProject}
          onCreateLearning={onCreateLearning}
          onCreatePerformance={onCreatePerformance}
          onExportLearning={onExport}
          onDeleteLearning={onDelete}
          onDeletePerforming={onDeletePerformingProject}
        />

        <section
          aria-labelledby="early-access-heading"
          className="mt-14 border-t border-white/[0.07] pt-8"
        >
          <div className="mb-4 flex items-center">
            <h2
              id="early-access-heading"
              className="text-sm font-semibold text-neutral-200"
            >
              抢先体验
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {earlyAccessFeatures.map(
              ({ title, icon: Icon, iconClass, secondaryIcon: SecondaryIcon }) => (
                <article
                  key={title}
                  className="flex min-h-16 items-center justify-between rounded-xl bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] px-4 py-3 ring-1 ring-inset ring-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        iconClass,
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4.5 w-4.5",
                          SecondaryIcon && "-translate-x-0.5",
                        )}
                      />
                      {SecondaryIcon && (
                        <SecondaryIcon className="absolute bottom-1.5 right-1.5 h-3 w-3" />
                      )}
                    </span>
                    <h3 className="truncate text-sm font-medium text-neutral-200">
                      {title}
                    </h3>
                  </div>
                  <span className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-medium text-neutral-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300/60" />
                    开发中
                  </span>
                </article>
              ),
            )}
          </div>
        </section>
      </div>
      </section>
    </div>
  );
}
