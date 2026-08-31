"use client";

import { useEffect, useRef, useState } from "react";
import type { ThumbnailGenerator } from "@/lib/thumbnailGenerator";
import { useLanguage } from "@/i18n/LanguageProvider";

interface SegmentThumbnailProps {
  generator: ThumbnailGenerator | null;
  time: number;
  num: number;
}

/** 懒加载缩略图：进入可视区域才向生成器请求截帧。 */
export function SegmentThumbnail({ generator, time, num }: SegmentThumbnailProps) {
  const { language } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !generator) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !requested.current) {
          requested.current = true;
          io.disconnect();
          generator.request(time).then((u) => {
            if (!cancelled && u) setUrl(u);
          });
        }
      },
      { root: el.closest("[data-seg-scroll]"), rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [generator, time]);

  return (
    <div
      ref={ref}
      className="relative h-12 w-[68px] shrink-0 overflow-hidden rounded-md bg-neutral-800"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={language === "en" ? `8-count ${num} preview` : `8拍 ${num}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">
          {num}
        </div>
      )}
    </div>
  );
}
