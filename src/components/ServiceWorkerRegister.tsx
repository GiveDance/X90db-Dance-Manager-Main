"use client";

import { useEffect } from "react";

/** 注册离线 Service Worker（仅生产构建）。开发模式下注销，避免缓存陈旧资源。 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }, []);
  return null;
}
