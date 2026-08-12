"use client";

import { CalendarDays, Clapperboard, Loader2, Play, Trash2 } from "lucide-react";
import type { PerformingProject } from "@/lib/types";

interface PerformingLibraryProps {
  projects: PerformingProject[];
  loading: boolean;
  openingId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function projectDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

export function PerformingLibrary({
  projects,
  loading,
  openingId,
  onOpen,
  onDelete,
}: PerformingLibraryProps) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-300">
        <Clapperboard className="h-4 w-4" />
        Performing 项目
        {projects.length > 0 && <span className="text-neutral-600">· {projects.length}</span>}
      </h2>

      {loading ? (
        <p className="text-sm text-neutral-600">加载中…</p>
      ) : projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-600">
          还没有 Performing 项目。上传主视频后会自动创建并保存到这里。
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-violet-400/30"
            >
              <button
                type="button"
                onClick={() => onOpen(project.id)}
                disabled={openingId === project.id || !project.sourceName}
                className="block w-full text-left disabled:cursor-not-allowed"
              >
                <div className="relative aspect-video bg-[linear-gradient(145deg,#17131f,#09090b_62%)]">
                  {project.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.cover}
                      alt={project.name}
                      className="h-full w-full object-cover opacity-75"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-violet-300/60">
                      <Clapperboard className="h-8 w-8" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full border border-violet-300/15 bg-black/50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-300 backdrop-blur">
                    Performing
                  </span>
                  {project.sourceName && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black">
                        {openingId === project.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Play className="h-5 w-5 translate-x-0.5 fill-black" />
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-white" title={project.name}>
                    {project.name}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-600">
                    <CalendarDays className="h-3 w-3" />
                    {projectDate(project.updatedAt)}
                    {project.bpm != null && <span>· {Math.round(project.bpm)} BPM</span>}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`删除「${project.name}」？此操作不可恢复。`)) {
                    onDelete(project.id);
                  }
                }}
                aria-label={`删除 ${project.name}`}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-neutral-300 opacity-0 transition-opacity hover:bg-red-500/80 hover:text-white group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
