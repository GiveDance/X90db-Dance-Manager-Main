"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LoopRange {
  start: number;
  end: number;
}

export function usePlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [mirrored, setMirrored] = useState(false);

  // 循环区间用 ref，保证 rAF 回调读到最新值。
  const loopRef = useRef<LoopRange | null>(null);
  // 5678 倒计时（练舞准备时间）：每次循环重复前都会出现。
  const [countdown, setCountdown] = useState<number | null>(null);
  const countingRef = useRef(false);
  const cdTimers = useRef<number[]>([]);
  const restartRef = useRef<() => void>(() => {});
  // 循环 5678 每拍的真实时长（毫秒）：随歌曲 BPM 与当前倍速实时更新，默认 1 秒。
  const beatMsRef = useRef(1000);

  const rafRef = useRef<number | null>(null);

  const clearCountdownTimers = useCallback(() => {
    cdTimers.current.forEach((t) => clearTimeout(t));
    cdTimers.current = [];
  }, []);

  // 暂停 → 5→6→7→8（间隔 intervalMs，静音）→ 回调播放。
  // 循环用固定 1 秒；起播前的「跟拍 count-in」用一拍的时长。
  const runCountdown = useCallback(
    (onDone: () => void, intervalMs = 1000) => {
      clearCountdownTimers();
      countingRef.current = true;
      setIsPlaying(false);
      videoRef.current?.pause();
      setCountdown(5);
      cdTimers.current.push(window.setTimeout(() => setCountdown(6), intervalMs));
      cdTimers.current.push(window.setTimeout(() => setCountdown(7), intervalMs * 2));
      cdTimers.current.push(window.setTimeout(() => setCountdown(8), intervalMs * 3));
      cdTimers.current.push(
        window.setTimeout(() => {
          setCountdown(null);
          countingRef.current = false;
          onDone();
        }, intervalMs * 4),
      );
    },
    [clearCountdownTimers],
  );

  // 回到段首并倒计时后播放
  const restartLoop = useCallback(() => {
    const lp = loopRef.current;
    const v = videoRef.current;
    if (!lp || !v) return;
    setIsPlaying(false);
    v.pause();
    v.currentTime = lp.start;
    setCurrentTime(lp.start);
    runCountdown(() => {
      setIsPlaying(true);
      v.play().catch(() => setIsPlaying(false));
    }, beatMsRef.current);
  }, [runCountdown]);
  useEffect(() => {
    restartRef.current = restartLoop;
  }, [restartLoop]);

  // rAF 循环：仅在播放时运行，平滑更新时间 + 到段尾触发「倒计时再循环」。
  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const lp = loopRef.current;
        if (lp && !countingRef.current && v.currentTime >= lp.end - 0.03) {
          restartRef.current();
        }
        setCurrentTime(v.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsPlaying(true);
    video.play().catch(() => setIsPlaying(false));
  }, []);
  const pause = useCallback(() => {
    setIsPlaying(false);
    videoRef.current?.pause();
  }, []);
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    // 倒计时进行中再按一次 → 跳过倒数立即播放
    if (countingRef.current) {
      clearCountdownTimers();
      countingRef.current = false;
      setCountdown(null);
      setIsPlaying(true);
      v.play().catch(() => setIsPlaying(false));
      return;
    }
    if (v.paused) {
      setIsPlaying(true);
      v.play().catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
      v.pause();
    }
  }, [clearCountdownTimers]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(t, v.duration || t));
    v.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const startWithCountIn = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      clearCountdownTimers();
      setIsPlaying(false);
      v.pause();
      const clamped = Math.max(0, Math.min(t, v.duration || t));
      v.currentTime = clamped;
      setCurrentTime(clamped);
      runCountdown(() => {
        setIsPlaying(true);
        v.play().catch(() => setIsPlaying(false));
      }, beatMsRef.current);
    },
    [clearCountdownTimers, runCountdown],
  );

  const setVolume = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, val));
    if (val > 0) v.muted = false;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const setPlaybackRate = useCallback((r: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = r;
  }, []);

  const toggleMirror = useCallback(() => setMirrored((m) => !m), []);

  /** 开启某段循环：设区间 → 回段首 → 5678 倒计时 → 播放。 */
  const startLoop = useCallback(
    (range: LoopRange) => {
      loopRef.current = range;
      restartRef.current();
    },
    [],
  );

  /** 关闭循环并清除倒计时。 */
  const stopLoop = useCallback(() => {
    loopRef.current = null;
    clearCountdownTimers();
    countingRef.current = false;
    setCountdown(null);
  }, [clearCountdownTimers]);

  /** 设置循环 5678 每拍的真实时长（毫秒），由 BPM 与倍速推导。 */
  const setCountInBeatMs = useCallback((ms: number) => {
    if (Number.isFinite(ms) && ms > 0) beatMsRef.current = ms;
  }, []);

  // 绑定到 <video> 的事件，保持 state 与原生状态同步。
  const videoProps = {
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setDuration(e.currentTarget.duration || 0);
    },
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onVolumeChange: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setVolumeState(e.currentTarget.volume);
      setMuted(e.currentTarget.muted);
    },
    onRateChange: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setPlaybackRateState(e.currentTarget.playbackRate);
    },
    onSeeked: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setCurrentTime(e.currentTarget.currentTime);
    },
    onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      // 暂停时拖动/事件驱动的兜底更新（播放时由 rAF 主导）
      if (!isPlaying) setCurrentTime(e.currentTarget.currentTime);
    },
    onEnded: () => setIsPlaying(false),
  };

  return {
    videoRef,
    videoProps,
    state: { isPlaying, currentTime, duration, volume, muted, playbackRate, mirrored, countdown },
    actions: {
      play,
      pause,
      togglePlay,
      seek,
      startWithCountIn,
      setVolume,
      toggleMute,
      setPlaybackRate,
      toggleMirror,
      startLoop,
      stopLoop,
      setCountInBeatMs,
    },
  };
}

export type PlayerApi = ReturnType<typeof usePlayer>;
