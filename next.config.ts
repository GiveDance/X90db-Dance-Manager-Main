import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 纯前端应用，导出为静态站点：构建后产物在 out/，
  // 无需 Node 服务器即可本地运行（用任意静态服务器打开，或安装为 PWA 离线使用）。
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
