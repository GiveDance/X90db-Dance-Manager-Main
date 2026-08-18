"use client";

import {
  Activity,
  Smartphone,
  Watch,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Uploader } from "./Uploader";
import { ProjectLibrary } from "./ProjectLibrary";
import { LandingExperience } from "./LandingExperience";
import { SharedHomeHeadline } from "./SharedHomeHeadline";
import { SharedModeSelector } from "./SharedModeSelector";
import { DevToolsButton } from "./DevToolsButton";
import type { PerformingProject, SavedDanceMeta } from "@/lib/types";
import { cn } from "@/lib/cn";

export type WorkspaceMode = "learning" | "performing";
type HomeSnapTarget = "landing" | "workspace";

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
  onOpenMotionAnalyzer: () => void;
  initialTarget?: HomeSnapTarget;
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
  onOpenMotionAnalyzer,
  initialTarget = "landing",
}: HomeProps) {
  const workspaceRef = useRef<HTMLElement>(null);
  const homeScrollRef = useRef<HTMLDivElement>(null);
  const snapTargetRef = useRef<HomeSnapTarget | null>(null);
  const snapFrameRef = useRef<number | null>(null);
  const workspaceTopRef = useRef(0);
  useLayoutEffect(() => {
    const scroller = homeScrollRef.current;
    const workspace = workspaceRef.current;
    if (!scroller || !workspace) return;
    const workspaceTop = workspace.offsetTop;
    workspaceTopRef.current = workspaceTop;
    scroller.scrollTop = initialTarget === "workspace" ? workspaceTop : 0;
  }, [initialTarget]);

  const snapTo = useCallback((target: HomeSnapTarget) => {
    const scroller = homeScrollRef.current;
    if (!scroller) return;
    const resolveTop = () =>
      target === "workspace" ? (workspaceRef.current?.offsetTop ?? 0) : 0;
    if (snapFrameRef.current != null) {
      window.cancelAnimationFrame(snapFrameRef.current);
    }
    const start = scroller.scrollTop;
    const initialTop = resolveTop();
    const distance = initialTop - start;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    snapTargetRef.current = target;
    if (reduceMotion || Math.abs(distance) < 1) {
      scroller.scrollTop = initialTop;
      snapTargetRef.current = null;
      snapFrameRef.current = null;
      return;
    }
    const startedAt = performance.now();
    const viewportDistance =
      Math.abs(distance) / Math.max(1, scroller.clientHeight);
    const duration = Math.min(520, Math.max(340, 340 + viewportDistance * 100));
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentTop = resolveTop();
      scroller.scrollTop = start + (currentTop - start) * eased;
      if (progress < 1) {
        snapFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        scroller.scrollTop = currentTop;
        snapTargetRef.current = null;
        snapFrameRef.current = null;
      }
    };
    snapFrameRef.current = window.requestAnimationFrame(animate);
  }, []);
  const enterWorkspace = useCallback(
    (nextMode: WorkspaceMode) => {
      onModeChange(nextMode);
      window.requestAnimationFrame(() => {
        snapTo("workspace");
      });
    },
    [onModeChange, snapTo],
  );
  const selectMode = useCallback(
    (nextMode: WorkspaceMode) => {
      const scroller = homeScrollRef.current;
      const workspaceTop = workspaceRef.current?.offsetTop ?? 0;
      if (scroller && scroller.scrollTop < workspaceTop * 0.9) {
        enterWorkspace(nextMode);
        return;
      }
      onModeChange(nextMode);
    },
    [enterWorkspace, onModeChange],
  );

  useEffect(() => {
    const scroller = homeScrollRef.current;
    const workspace = workspaceRef.current;
    if (!scroller || !workspace) return;

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 1) return;
      const workspaceTop = workspace.offsetTop;
      const scrollTop = scroller.scrollTop;
      const activeTarget = snapTargetRef.current;

      if (activeTarget != null) {
        event.preventDefault();
        return;
      }
      if (event.deltaY > 0 && scrollTop < workspaceTop - 1) {
        event.preventDefault();
        snapTo("workspace");
      } else if (
        event.deltaY < 0 &&
        scrollTop > 1 &&
        scrollTop <= workspaceTop + 2
      ) {
        event.preventDefault();
        snapTo("landing");
      }
    };

    workspaceTopRef.current = workspace.offsetTop;
    const resizeObserver = new ResizeObserver(() => {
      const previousTop = workspaceTopRef.current;
      const nextTop = workspace.offsetTop;
      workspaceTopRef.current = nextTop;
      if (
        snapTargetRef.current === "workspace" ||
        Math.abs(scroller.scrollTop - previousTop) <= 2
      ) {
        scroller.scrollTop = nextTop;
      }
    });
    resizeObserver.observe(scroller);
    resizeObserver.observe(workspace);
    scroller.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      resizeObserver.disconnect();
      scroller.removeEventListener("wheel", handleWheel);
      if (snapFrameRef.current != null) {
        window.cancelAnimationFrame(snapFrameRef.current);
      }
    };
  }, [snapTo]);
  const modeFeatures =
    mode === "learning"
      ? ["节奏拆解", "节拍可视化", "分段练习", "团舞走位设计"]
      : ["节拍可视化", "生成素材", "自由合成"];
  const earlyAccessFeatures = [
    {
      title: "动作校准器",
      icon: Activity,
      iconClass: "bg-blue-400/10 text-blue-300",
      available: true,
      href: null,
    },
    {
      title: "随身节拍震动器",
      icon: Smartphone,
      iconClass: "bg-violet-400/10 text-violet-300",
      secondaryIcon: Watch,
      available: true,
      href: "https://github.com/GiveDance/Yating-VibeBeat-App",
    },
  ];

  return (
    <div
      ref={homeScrollRef}
      className="relative h-full overflow-y-auto overscroll-y-contain bg-black text-white"
    >
      <SharedHomeHeadline scrollerRef={homeScrollRef} />
      <SharedModeSelector
        scrollerRef={homeScrollRef}
        mode={mode}
        onSelect={selectMode}
      />
      <div className="absolute right-6 top-6 z-10">
        <DevToolsButton />
      </div>
      <LandingExperience />
      <section
        ref={workspaceRef}
        aria-label="Dance Manager 功能区"
        className="relative z-[3] min-h-full text-sm"
      >
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-11">
        <div className="mb-8 h-[74px]" aria-hidden="true" />

        <section>
          <div
            className="h-[46px]"
            style={{
              marginBottom: "var(--workspace-heading-gap, 18px)",
            }}
            aria-hidden="true"
          />

          <div className="mb-4 flex min-h-7 flex-wrap items-center gap-x-5 gap-y-2">
            {modeFeatures.map((feature, index) => (
              <span key={feature} className="flex items-center gap-5">
                {index > 0 && (
                  <span className="h-1 w-1 rounded-full bg-neutral-700" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
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
              className="text-sm font-semibold text-white"
            >
              抢先体验
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {earlyAccessFeatures.map(
              ({
                title,
                icon: Icon,
                iconClass,
                secondaryIcon: SecondaryIcon,
                available,
                href,
              }) => {
                const content = (
                  <>
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
                  <span
                   className="text-ui-secondary ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium"
                  >
                   <span className="h-1.5 w-1.5 rounded-full bg-amber-300/60" />
                   开发中
                  </span>
                  </>
                );
                const cardClass =
                  "flex min-h-16 w-full items-center justify-between rounded-xl border border-neutral-800 bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] px-4 py-3 text-left transition-colors hover:border-neutral-700";

                return href ? (
                  <a
                   key={title}
                   href={href}
                   target="_blank"
                   rel="noreferrer"
                   className={cn(
                     cardClass,
                     "cursor-pointer transition hover:bg-white/[0.06] hover:ring-violet-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60",
                   )}
                  >
                   {content}
                  </a>
                ) : available ? (
                  <button
                   key={title}
                   type="button"
                   onClick={onOpenMotionAnalyzer}
                   className={cn(
                     cardClass,
                     "cursor-pointer transition hover:bg-white/[0.06] hover:ring-blue-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60",
                   )}
                  >
                   {content}
                  </button>
                ) : (
                  <article key={title} className={cardClass}>
                   {content}
                  </article>
                );
              },
            )}
          </div>
        </section>
      </div>
      </section>
    </div>
  );
}
