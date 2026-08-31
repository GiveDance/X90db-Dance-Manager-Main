"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  chineseMessages,
  englishMessages,
  type TranslationKey,
} from "./messages";

export type AppLanguage = "zh-CN" | "en";
export type TranslationParams = Record<string, string | number>;

const STORAGE_KEY = "dance-manager-language";
const languageListeners = new Set<() => void>();
let inMemoryLanguage: AppLanguage = "zh-CN";

function getStoredLanguage(): AppLanguage {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    inMemoryLanguage = saved === "en" ? "en" : "zh-CN";
  } catch {
    // Fall back to the in-memory selection when storage is unavailable.
  }
  return inMemoryLanguage;
}

function subscribeToLanguage(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  languageListeners.add(listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    languageListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function interpolate(message: string, params?: TranslationParams) {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`,
  );
}

function translateDynamicText(text: string): string {
  const bodyPart = (value: string) =>
    englishMessages[value as TranslationKey] ?? value;
  const rules: Array<[RegExp, (...parts: string[]) => string]> = [
    [/^第(\d+)段$/, (count) => `Section ${count}`],
    [/^8拍 (\d+)$/, (count) => `8-count ${count}`],
    [
      /^已敲 (\d+)$/,
      (count) => `${count} ${count === "1" ? "tap" : "taps"}`,
    ],
    [/^走位 (\d+)$/, (count) => `Formation ${count}`],
    [/^走位变化 (\d+)$/, (count) => `Transition ${count}`],
    [/^变化 (\d+)$/, (count) => `Transition ${count}`],
    [/^播放速度 (.+)倍$/, (speed) => `Playback speed ${speed}×`],
    [
      /^(.+) 这里(.+)对应的手臂没有完全打开，看起来有点拘谨，试着把手臂伸展到位。$/,
      (time, joint) =>
        `At ${time}, your ${bodyPart(joint).split(" ")[0]} arm is not fully extended. Extend through the movement.`,
    ],
    [
      /^(.+) 这里手臂伸得有点过了，注意和标准动作对比一下幅度。$/,
      (time) =>
        `At ${time}, your arm extends a little too far. Compare its range with the reference.`,
    ],
    [
      /^(.+) 附近肩膀有些耸起\/内收，让动作看起来不够舒展。放松肩膀，感受手臂从肩部自然延伸。$/,
      (time) =>
        `Around ${time}, your shoulders lift or turn inward. Relax them and let the arms extend naturally from the shoulders.`,
    ],
    [
      /^(.+) 附近肩膀打开得太大了，整体线条看起来不太协调，稍微收一点会更好看。$/,
      (time) =>
        `Around ${time}, your shoulders open too far. Bring them in slightly for a cleaner line.`,
    ],
    [
      /^(.+) 这里腿部弯曲不够，重心偏高了。试着蹲低一些，让动作更稳、更有力量感。$/,
      (time) =>
        `At ${time}, bend your legs more and lower your center of gravity for a stronger, steadier movement.`,
    ],
    [
      /^(.+) 这里膝盖弯得太深了，显得有些沉。稍微直一点，保持动作的轻盈感。$/,
      (time) =>
        `At ${time}, your knees bend too deeply. Straighten slightly to keep the movement light.`,
    ],
    [
      /^(.+) 附近胯部动作幅度不够，影响了整体的动感。放松胯部，让律动更自然。$/,
      (time) =>
        `Around ${time}, add more range through the hips and relax into the groove.`,
    ],
    [
      /^(.+) 附近胯部送得有点过了，注意控制幅度，和标准保持一致。$/,
      (time) =>
        `Around ${time}, the hip movement is too large. Control the range to match the reference.`,
    ],
    [
      /^(.+) 附近(.+)的位置需要调整，对照标准视频仔细看看。$/,
      (time, joint) =>
        `Around ${time}, adjust your ${bodyPart(joint)} position. Compare it closely with the reference video.`,
    ],
    [
      /^(.+) 这里慢了半拍，试着跟紧音乐的重拍。$/,
      (time) => `At ${time}, you are about half a beat late. Stay closer to the accented beats.`,
    ],
    [/^(.+)需要调整$/, (joint) => `Adjust your ${bodyPart(joint)}`],
    [
      /^(.+) 这段动作幅度偏小，感觉有些拘谨，试着把动作做得更舒展。$/,
      (time) => `At ${time}, the movement is too small. Open it up and extend more fully.`,
    ],
    [
      /^(.+) 到 (.+) 这段跳得非常到位，节奏感和动作都很棒！$/,
      (start, end) =>
        `From ${start} to ${end}, your timing and movement are excellent!`,
    ],
    [
      /^(.+) 这段节奏卡得很准，身体控制也很到位，就是这个感觉！$/,
      (time) => `At ${time}, your timing and body control are right on target—keep that feeling!`,
    ],
    [
      /^(.+) 这里动作晚了，感觉像是在追拍子。试着提前感受音乐的节奏，让身体自然跟上。$/,
      (time) =>
        `At ${time}, the movement is late. Anticipate the rhythm so your body meets the beat naturally.`,
    ],
    [
      /^(左|右)手臂的线条和标准有差距——注意看标准动作中手臂抬到什么高度、伸出去多远，对着镜子调整一下。$/,
      (side) =>
        `Your ${side === "左" ? "left" : "right"} arm line differs from the reference. Check its height and reach, then adjust in a mirror.`,
    ],
    [
      /^(左|右)边肩膀的位置不太对，看起来有点紧。试着放松肩膀，让手臂的发力从肩膀自然带出来。$/,
      (side) =>
        `Your ${side === "左" ? "left" : "right"} shoulder looks tense. Relax it and let the arm move naturally from the shoulder.`,
    ],
    [
      /^(左|右)腿在做动作的时候膝盖弯曲度和标准不一样，影响了整体的身体线条。慢动作回看一下标准视频里腿部的变化。$/,
      (side) =>
        `Your ${side === "左" ? "left" : "right"} knee bend differs from the reference and affects your line. Review the leg movement in slow motion.`,
    ],
    [/^(.+)表现不错，动作很到位$/, (joint) => `Your ${bodyPart(joint)} movement is accurate and well executed.`],
    [
      /^(左|右)(手臂|肩膀)可以再打开一些，看起来有点收$/,
      (side, part) =>
        part === "手臂"
          ? `Open your ${side === "左" ? "left" : "right"} arm a little more.`
          : `Open through your ${side === "左" ? "left" : "right"} shoulder a little more.`,
    ],
    [
      /^(左|右)(手臂|肩膀)伸得有点过了，注意控制$/,
      (side, part) =>
        part === "手臂"
          ? `Your ${side === "左" ? "left" : "right"} arm extends too far; reduce the range.`
          : `Your ${side === "左" ? "left" : "right"} shoulder opens too far; reduce the range.`,
    ],
    [
      /^(左|右)腿弯曲不够，需要蹲得更深一些$/,
      (side) => `Bend your ${side === "左" ? "left" : "right"} leg more and lower your stance.`,
    ],
    [
      /^(左|右)腿可以稍微放松一点，不用绷那么直$/,
      (side) => `Relax your ${side === "左" ? "left" : "right"} leg slightly.`,
    ],
    [
      /^(左|右)边胯位有些偏，注意重心的控制$/,
      (side) => `Your ${side === "左" ? "left" : "right"} hip is out of position; keep your balance centered.`,
    ],
    [/^(.+)的位置需要调整$/, (joint) => `Adjust the position of your ${bodyPart(joint)}.`],
    [
      /^“(.+)”可以播放，但未能保存到本地舞蹈库。请检查浏览器存储空间。$/,
      (name) =>
        `“${name}” can be played, but it could not be saved to the local dance library. Check your browser storage space.`,
    ],
    [
      /^“(.+)”的视频文件已不在本地存储中，请重新上传原视频。$/,
      (name) =>
        `The video file for “${name}” is no longer in local storage. Upload the source video again.`,
    ],
  ];
  for (const [pattern, replacement] of rules) {
    const match = text.match(pattern);
    if (match) return replacement(...match.slice(1));
  }
  return text;
}

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  translateText: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore<AppLanguage>(
    subscribeToLanguage,
    getStoredLanguage,
    () => "zh-CN",
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    inMemoryLanguage = nextLanguage;
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch {
      // Language selection remains active for this session if storage is unavailable.
    }
    languageListeners.forEach((listener) => listener());
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      interpolate(language === "en" ? englishMessages[key] : key, params),
    [language],
  );

  const translateText = useCallback(
    (text: string) => {
      if (language === "zh-CN") return chineseMessages[text] ?? text;
      const exact = englishMessages[text as TranslationKey];
      return exact ?? translateDynamicText(text);
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, translateText }),
    [language, setLanguage, t, translateText],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
