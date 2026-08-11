import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dance Learning Player",
  description: "为舞者设计的扒舞 / 学舞 / 练舞工具 — 八拍分段、单段循环、节拍可视化、镜像跟练",
  manifest: "./manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "LearnDance" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
