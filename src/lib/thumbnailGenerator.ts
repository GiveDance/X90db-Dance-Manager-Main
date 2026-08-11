/**
 * Generates thumbnails serially with one reusable hidden video element.
 * Callers can request frames lazily without decoding many videos in parallel.
 */
export class ThumbnailGenerator {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private queue: Array<{ time: number; resolve: (v: string | null) => void }> = [];
  private processing = false;
  private ready: Promise<void>;
  private destroyed = false;

  constructor(src: string, private w = 160, private h = 90) {
    const v = document.createElement("video");
    v.src = src;
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    this.video = v;

    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;

    this.ready = new Promise((resolve) => {
      let timer = 0;
      const done = () => {
        window.clearTimeout(timer);
        v.removeEventListener("loadeddata", done);
        v.removeEventListener("error", done);
        resolve();
      };
      timer = window.setTimeout(done, 8_000);
      v.addEventListener("loadeddata", done);
      v.addEventListener("error", done);
    });
  }

  async getDuration(): Promise<number> {
    await this.ready;
    return isFinite(this.video.duration) ? this.video.duration : 0;
  }

  request(time: number): Promise<string | null> {
    if (this.destroyed) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.queue.push({ time, resolve });
      void this.process();
    });
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;
    await this.ready;
    while (this.queue.length && !this.destroyed) {
      const job = this.queue.shift()!;
      const url = await this.capture(job.time).catch(() => null);
      job.resolve(url);
    }
    this.processing = false;
  }

  private capture(time: number): Promise<string | null> {
    return new Promise((resolve) => {
      const v = this.video;
      let settled = false;
      const finish = (url: string | null) => {
        if (settled) return;
        settled = true;
        v.removeEventListener("seeked", onSeeked);
        resolve(url);
      };
      const onSeeked = () => {
        try {
          const ctx = this.canvas.getContext("2d");
          if (!ctx) return finish(null);
          ctx.drawImage(v, 0, 0, this.w, this.h);
          finish(this.canvas.toDataURL("image/jpeg", 0.6));
        } catch {
          finish(null);
        }
      };
      v.addEventListener("seeked", onSeeked);
      try {
        const dur = isFinite(v.duration) ? v.duration : time;
        v.currentTime = Math.min(time, Math.max(0, dur - 0.05));
      } catch {
        finish(null);
      }
      // Some codecs never emit `seeked`; complete the request without a thumbnail.
      setTimeout(() => finish(null), 4000);
    });
  }

  destroy() {
    this.destroyed = true;
    this.queue.forEach((j) => j.resolve(null));
    this.queue = [];
    this.video.removeAttribute("src");
    this.video.load();
  }
}
