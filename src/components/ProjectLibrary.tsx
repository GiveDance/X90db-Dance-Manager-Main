"use client";

import { useMemo } from "react";
import {
  Clock,
  Download,
  GraduationCap,
  Loader2,
  Music,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { PerformingProject, SavedDanceMeta } from "@/lib/types";
import { formatTime } from "@/lib/format";
import type { WorkspaceMode } from "./Home";
import { useLanguage } from "@/i18n/LanguageProvider";

interface ProjectLibraryProps {
  mode: WorkspaceMode;
  dances: SavedDanceMeta[];
  performingProjects: PerformingProject[];
  loading: boolean;
  openingLearningId: string | null;
  openingPerformingId: string | null;
  creatingLearningId: string | null;
  creatingPerformanceId: string | null;
  onOpenLearning: (id: string) => void;
  onOpenPerforming: (id: string) => void;
  onCreateLearning: (id: string) => void;
  onCreatePerformance: (id: string) => void;
  onExportLearning: (id: string) => void;
  onDeleteLearning: (id: string) => void;
  onDeletePerforming: (id: string) => void;
}

interface ProjectPair {
  id: string;
  learning?: SavedDanceMeta;
  performing?: PerformingProject;
  updatedAt: number;
}

function mediaKey(
  name: string,
  size: number | undefined,
  duration: number | undefined,
) {
  const normalizedName = name.toLocaleLowerCase().replace(/\.[^.]+$/, "");
  return `${normalizedName}:${size ?? 0}:${Math.round((duration ?? 0) * 10)}`;
}

function pairProjects(
  dances: SavedDanceMeta[],
  performingProjects: PerformingProject[],
): ProjectPair[] {
  const unusedPerforming = new Map(
    performingProjects.map((project) => [project.id, project]),
  );
  const pairs: ProjectPair[] = dances.map((learning) => {
    const linked =
      performingProjects.find(
        (project) =>
          unusedPerforming.has(project.id) &&
          project.learningProjectId === learning.id,
      ) ??
      performingProjects.find(
        (project) =>
          unusedPerforming.has(project.id) &&
          mediaKey(
            project.sourceName ?? project.name,
            project.size,
            project.duration,
          ) === mediaKey(learning.name, learning.size, learning.duration),
      );
    if (linked) unusedPerforming.delete(linked.id);
    return {
      id: learning.id,
      learning,
      performing: linked,
      updatedAt: Math.max(learning.updatedAt, linked?.updatedAt ?? 0),
    };
  });

  for (const performing of unusedPerforming.values()) {
    pairs.push({
      id: performing.id,
      performing,
      updatedAt: performing.updatedAt,
    });
  }
  return pairs.sort((first, second) => second.updatedAt - first.updatedAt);
}

function projectDate(timestamp: number, locale: string) {
  return new Date(timestamp).toLocaleDateString(locale, {
    month: "numeric",
    day: "numeric",
  });
}

export function ProjectLibrary({
  mode,
  dances,
  performingProjects,
  loading,
  openingLearningId,
  openingPerformingId,
  creatingLearningId,
  creatingPerformanceId,
  onOpenLearning,
  onOpenPerforming,
  onCreateLearning,
  onCreatePerformance,
  onExportLearning,
  onDeleteLearning,
  onDeletePerforming,
}: ProjectLibraryProps) {
  const { language, t } = useLanguage();
  const projects = useMemo(
    () => pairProjects(dances, performingProjects),
    [dances, performingProjects],
  );

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        <Music className="h-4 w-4" />
        {t("我的项目")}
        {projects.length > 0 && (
          <span className="text-ui-secondary">· {projects.length}</span>
        )}
      </h2>

      {loading ? (
        <p className="text-ui-secondary text-sm">{t("加载中…")}</p>
      ) : projects.length === 0 ? (
        <p className="text-ui-secondary rounded-xl border border-dashed border-neutral-800 px-4 py-8 text-center text-sm">
          {t("还没有项目。上传视频后会自动保存在这里。")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {projects.map(({ id, learning, performing, updatedAt }) => {
            const preferred =
              mode === "learning"
                ? learning
                  ? "learning"
                  : "performing"
                : performing
                  ? "performing"
                  : "learning";
            const busy =
              openingLearningId === learning?.id ||
              openingPerformingId === performing?.id ||
              creatingLearningId === performing?.id ||
              creatingPerformanceId === learning?.id;
            const name =
              learning?.name ??
              performing?.sourceName ??
              performing?.name ??
              t("未命名项目");
            const cover = learning?.cover ?? performing?.cover;
            const bpm = learning?.bpm ?? performing?.bpm;
            const duration = learning?.duration ?? performing?.duration ?? 0;

            const openPreferred = () => {
              if (preferred === "learning" && learning) {
                onOpenLearning(learning.id);
              } else if (performing) {
                onOpenPerforming(performing.id);
              }
            };
            const deletePreferred = () => {
              if (preferred === "learning" && learning) {
                if (
                  confirm(
                    language === "en"
                      ? `Delete the practice project “${name}”?`
                      : `删除「${name}」的练习项目？`,
                  )
                ) {
                  onDeleteLearning(learning.id);
                }
              } else if (performing) {
                if (
                  confirm(
                    language === "en"
                      ? `Delete the performance project “${name}”?`
                      : `删除「${name}」的演出项目？`,
                  )
                ) {
                  onDeletePerforming(performing.id);
                }
              }
            };

            return (
              <article
                key={id}
                className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-neutral-700 active:border-neutral-600"
              >
                <button
                  type="button"
                  onClick={openPreferred}
                  disabled={busy}
                  className="block w-full text-left disabled:cursor-wait"
                >
                  <div className="relative aspect-video bg-[linear-gradient(145deg,#17131f,#09090b_62%)]">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={name}
                        className="h-full w-full object-cover opacity-80"
                      />
                    ) : (
                      <div className="text-ui-secondary flex h-full items-center justify-center">
                        <Music className="h-8 w-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black">
                        {busy ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Play className="h-5 w-5 translate-x-px fill-black" />
                        )}
                      </span>
                    </div>
                  </div>
                </button>

                <div className="p-3">
                  <p className="truncate text-sm font-medium text-white" title={name}>
                    {name}
                  </p>
                  <div className="text-ui-secondary mt-1 flex items-center gap-1.5 text-xs">
                    <Clock className="h-3 w-3" />
                    <span>{projectDate(updatedAt, language)}</span>
                    {bpm != null && <span>· {Math.round(bpm)} BPM</span>}
                    {duration > 0 && <span>· {formatTime(duration)}</span>}
                  </div>
                  <div className="mt-3 flex items-center justify-start gap-1.5">
                    <button
                      type="button"
                      disabled={busy || (!learning && !performing)}
                      data-tooltip={
                        learning
                          ? undefined
                          : t("复用当前视频和节拍数据创建练习项目")
                      }
                      onClick={() =>
                        learning
                          ? onOpenLearning(learning.id)
                          : performing && onCreateLearning(performing.id)
                      }
                      className={
                        learning
                          ? "flex h-8 min-w-16 items-center justify-center gap-1.5 rounded-lg bg-blue-500/20 px-2.5 text-xs font-medium text-blue-200 hover:bg-blue-500/30"
                          : "text-ui-disabled flex h-8 min-w-16 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-2.5 text-xs font-medium hover:bg-blue-500/10 hover:text-blue-300 disabled:cursor-not-allowed"
                      }
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      {creatingLearningId === performing?.id ? t("创建中…") : t("练习")}
                    </button>
                    <button
                      type="button"
                      disabled={busy || (!performing && !learning)}
                      data-tooltip={
                        performing
                          ? undefined
                          : t("复用当前视频和节拍数据创建演出项目")
                      }
                      onClick={() =>
                        performing
                          ? onOpenPerforming(performing.id)
                          : learning && onCreatePerformance(learning.id)
                      }
                      className={
                        performing
                          ? "flex h-8 min-w-16 items-center justify-center gap-1.5 rounded-lg bg-violet-500/20 px-2.5 text-xs font-medium text-violet-200 hover:bg-violet-500/30"
                          : "text-ui-disabled flex h-8 min-w-16 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-2.5 text-xs font-medium hover:bg-violet-500/10 hover:text-violet-300 disabled:cursor-not-allowed"
                      }
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {creatingPerformanceId === learning?.id
                        ? t("创建中…")
                        : language === "en"
                          ? t("演出操作")
                          : t("演出")}
                    </button>
                  </div>
                </div>

                <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {learning && (
                    <button
                      type="button"
                      onClick={() => onExportLearning(learning.id)}
                      aria-label={language === "en" ? `Export ${name}` : `导出 ${name}`}
                      className="text-ui-secondary flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 hover:bg-blue-500/80 hover:text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={deletePreferred}
                    aria-label={language === "en" ? `Delete ${name}` : `删除 ${name}`}
                    className="text-ui-secondary flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 hover:bg-red-500/80 hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
