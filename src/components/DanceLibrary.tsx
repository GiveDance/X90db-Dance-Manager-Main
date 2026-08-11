"use client";

import { Play, Trash2, Music, Clock, Download, Loader2 } from "lucide-react";
import type { SavedDanceMeta } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

interface DanceLibraryProps {
  dances: SavedDanceMeta[];
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  openingId: string | null;
  className?: string;
}

function relativeDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function DanceLibrary({
  dances,
  loading,
  onOpen,
  onDelete,
  onExport,
  openingId,
  className,
}: DanceLibraryProps) {
  return (
    <section className={cn("", className)}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-300">
        <Music className="h-4 w-4" />
        我的舞蹈
        {dances.length > 0 && <span className="text-neutral-600">· {dances.length}</span>}
      </h2>

      {loading ? (
        <p className="text-sm text-neutral-600">加载中…</p>
      ) : dances.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-600">
          还没有保存的舞蹈。上传一个视频后会自动保存到这里，校准过的节奏也会一起记住。
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {dances.map((d) => (
            <div
              key={d.id}
              className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition-colors hover:border-neutral-700"
            >
              <button
                type="button"
                onClick={() => onOpen(d.id)}
                disabled={openingId === d.id}
                className="block w-full text-left disabled:cursor-wait"
              >
                <div className="relative aspect-video w-full bg-neutral-800">
                  {d.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.cover} alt={d.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-600">
                      <Music className="h-8 w-8" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center transition-all",
                      openingId === d.id
                        ? "bg-black/55 opacity-100"
                        : "bg-black/0 opacity-0 group-hover:bg-black/40 group-hover:opacity-100",
                    )}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black">
                      {openingId === d.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Play className="h-5 w-5 translate-x-0.5 fill-black" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-white" title={d.name}>
                    {d.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                    <span className="tabular-nums">
                      {Math.round(d.analysisBpm ?? d.bpm)} BPM
                    </span>
                    {d.duration > 0 && (
                      <>
                        <span>·</span>
                        <span className="tabular-nums">{formatTime(d.duration)}</span>
                      </>
                    )}
                    {d.markers.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{d.markers.length} 标记</span>
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-600">
                    <Clock className="h-3 w-3" />
                    {relativeDate(d.updatedAt)}
                  </div>
                </div>
              </button>

              <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => onExport(d.id)}
                  data-tooltip="导出视频"
                  aria-label="导出视频"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-neutral-300 hover:bg-blue-500/80 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`删除「${d.name}」？此操作不可恢复。`)) onDelete(d.id);
                  }}
                  data-tooltip="删除"
                  aria-label="删除"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-neutral-300 hover:bg-red-500/80 hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
