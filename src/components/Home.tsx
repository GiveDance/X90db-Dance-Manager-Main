"use client";

import { Uploader } from "./Uploader";
import { DanceLibrary } from "./DanceLibrary";
import { DevToolsButton } from "./DevToolsButton";
import type { SavedDanceMeta } from "@/lib/types";

interface HomeProps {
  dances: SavedDanceMeta[];
  loading: boolean;
  onFile: (file: File) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  openingId: string | null;
  libraryError: string | null;
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
}: HomeProps) {
  return (
    <div className="relative h-full overflow-y-auto bg-black">
      <div className="absolute right-6 top-6 z-10">
        <DevToolsButton />
      </div>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Dance Learning Player
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            上传练舞视频，自动切分八拍 · 单段循环 · 节拍可视化 · 镜像跟练
          </p>
        </header>

        <Uploader onFile={onFile} />

        {libraryError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {libraryError}
          </div>
        )}

        <DanceLibrary
          dances={dances}
          loading={loading}
          onOpen={onOpen}
          onDelete={onDelete}
          onExport={onExport}
          openingId={openingId}
          className="mt-12"
        />
      </div>
    </div>
  );
}
