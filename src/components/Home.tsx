"use client";

import { GraduationCap, Sparkles } from "lucide-react";
import { Uploader } from "./Uploader";
import { DanceLibrary } from "./DanceLibrary";
import { PerformingLibrary } from "./PerformingLibrary";
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
  openingId: string | null;
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
  openingId,
  libraryError,
  mode,
  onModeChange,
  performingProjects,
  performingLoading,
  performingOpeningId,
  onOpenPerformingProject,
  onDeletePerformingProject,
}: HomeProps) {
  return (
    <div className="relative h-full overflow-y-auto bg-black">
      <div className="absolute right-6 top-6 z-10">
        <DevToolsButton />
      </div>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {mode === "learning" ? "Dance Learning Player" : "Dance Manager"}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {mode === "learning"
              ? "上传练舞视频，自动切分八拍 · 单段循环 · 节拍可视化 · 镜像跟练"
              : "Compose video, stage visuals, and performer cues."}
          </p>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={mode === "learning"}
            onClick={() => onModeChange("learning")}
            className={cn(
              "flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all",
              mode === "learning"
                ? "border-blue-400/60 bg-blue-500/10"
                : "border-neutral-800 bg-neutral-900/45 hover:border-blue-400/40 hover:bg-blue-500/5",
            )}
          >
            <span className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              mode === "learning" ? "bg-blue-500/15 text-blue-300" : "bg-white/5 text-neutral-400",
            )}>
              <GraduationCap className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">Learning</span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                Loop, calibrate, mark, and rehearse
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "performing"}
            onClick={() => onModeChange("performing")}
            className={cn(
              "group flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all",
              mode === "performing"
                ? "border-violet-400/60 bg-violet-500/10"
                : "border-neutral-800 bg-neutral-900/45 hover:border-violet-400/40 hover:bg-violet-500/5",
            )}
          >
            <span className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
              mode === "performing"
                ? "bg-violet-500/15 text-violet-300"
                : "bg-white/5 text-neutral-400 group-hover:text-violet-300",
            )}>
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">Performing</span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                Compose, stage, and export
              </span>
            </span>
          </button>
        </div>

        <Uploader onFile={onFile} mode={mode} />

        {libraryError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {libraryError}
          </div>
        )}

        {mode === "learning" ? (
          <DanceLibrary
            dances={dances}
            loading={loading}
            onOpen={onOpen}
            onDelete={onDelete}
            onExport={onExport}
            openingId={openingId}
            className="mt-12"
          />
        ) : (
          <PerformingLibrary
            projects={performingProjects}
            loading={performingLoading}
            openingId={performingOpeningId}
            onOpen={onOpenPerformingProject}
            onDelete={onDeletePerformingProject}
          />
        )}
      </div>
    </div>
  );
}
