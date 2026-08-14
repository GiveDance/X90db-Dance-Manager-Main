"use client";

import { useEffect, useRef } from "react";
import { ArrowDown, GraduationCap, Sparkles } from "lucide-react";
import type { WorkspaceMode } from "./Home";
import {
  LANDING_BEAT_EVENT,
  LANDING_VIDEO_PLAYBACK_RATE,
  landingCharacterAt,
} from "@/lib/landingRhythm";

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 vUv;
  uniform sampler2D uVideo;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uTime;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv * 2.0 - 1.0;
    float aspect = uResolution.x / max(1.0, uResolution.y);
    centered.x *= aspect;

    float radius = dot(centered, centered);
    centered *= 1.0 + radius * 0.055;
    centered.x /= aspect;
    uv = centered * 0.5 + 0.5;

    float row = floor(uv.y * 92.0);
    float glitchGate = step(0.91, hash(vec2(row, floor(uTime * 2.4))));
    float glitchDirection = hash(vec2(row + 17.0, floor(uTime * 1.7))) - 0.5;
    uv.x += glitchGate * glitchDirection * 0.035;
    uv.x += (uMouse.x - 0.5) * 0.006 * smoothstep(0.25, 0.0, abs(uv.y - uMouse.y));

    float inside =
      step(0.0, uv.x) * step(uv.x, 1.0) *
      step(0.0, uv.y) * step(uv.y, 1.0);

    vec2 ghostOffset = vec2(0.0025 + glitchGate * 0.004, 0.0);
    vec2 videoUv = vec2(uv.x, 0.14 + (1.0 - uv.y) * 0.86);
    float base = luminance(texture2D(uVideo, videoUv).rgb);
    float ghostBefore = luminance(texture2D(uVideo, videoUv - ghostOffset).rgb);
    float ghostAfter = luminance(texture2D(uVideo, videoUv + ghostOffset).rgb);
    float edgeGhost = abs(ghostBefore - ghostAfter);

    float scanline = 0.90 + 0.10 * sin(gl_FragCoord.y * 1.62);
    float fineLine = 0.965 + 0.035 * sin(gl_FragCoord.y * 3.14159);
    float staticGrain = hash(gl_FragCoord.xy * 0.217) - 0.5;
    float slowFlicker = 0.985 + 0.015 * sin(uTime * 7.0);

    float monochrome = base * scanline * fineLine * slowFlicker;
    monochrome += edgeGhost * 0.32;
    monochrome += staticGrain * 0.105;
    monochrome = smoothstep(0.035, 0.96, monochrome);

    vec2 vignetteUv = vUv * (1.0 - vUv.yx);
    float vignette = pow(clamp(vignetteUv.x * vignetteUv.y * 18.0, 0.0, 1.0), 0.34);
    monochrome *= mix(0.38, 1.0, vignette) * inside;

    gl_FragColor = vec4(vec3(monochrome * 0.58), 1.0);
  }
`;

interface LandingExperienceProps {
  onEnter: (mode: WorkspaceMode) => void;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create landing shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export function LandingExperience({ onEnter }: LandingExperienceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      console.error("WebGL is unavailable; using the monochrome video fallback.");
      return;
    }

    let vertexShader: WebGLShader;
    let fragmentShader: WebGLShader;
    try {
      vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    } catch (error) {
      console.error("Landing shader failed to compile.", error);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      console.error("Unable to create the landing shader program.");
      return;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(
        "Landing shader failed to link.",
        gl.getProgramInfoLog(program),
      );
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture) {
      console.error("Unable to allocate landing shader resources.");
      return;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, "uVideo"), 0);

    const resolutionUniform = gl.getUniformLocation(program, "uResolution");
    const mouseUniform = gl.getUniformLocation(program, "uMouse");
    const timeUniform = gl.getUniformLocation(program, "uTime");
    const mouse = { x: 0.5, y: 0.5 };
    const startedAt = performance.now();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let animationFrame = 0;
    let active = true;
    let lastCharacter = -1;
    video.playbackRate = LANDING_VIDEO_PLAYBACK_RATE;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.round(canvas.clientWidth * ratio);
      const height = Math.round(canvas.clientHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };
    const movePointer = (event: PointerEvent) => {
      mouse.x = event.clientX / Math.max(1, window.innerWidth);
      mouse.y = 1 - event.clientY / Math.max(1, window.innerHeight);
    };
    const render = () => {
      animationFrame = 0;
      if (!active) return;
      resize();
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const character = landingCharacterAt(video.currentTime);
        if (character !== lastCharacter) {
          lastCharacter = character;
          window.dispatchEvent(
            new CustomEvent(LANDING_BEAT_EVENT, { detail: character }),
          );
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          video,
        );
      }
      gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
      gl.uniform2f(mouseUniform, mouse.x, mouse.y);
      gl.uniform1f(
        timeUniform,
        reduceMotion ? 0 : (performance.now() - startedAt) / 1000,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrame = window.requestAnimationFrame(render);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        active = entry.isIntersecting;
        if (active) {
          if (!reduceMotion) {
            void video.play().catch((error) => {
              console.error("Landing video playback failed.", error);
            });
          }
          if (!animationFrame) render();
        } else {
          video.pause();
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      },
      { threshold: 0.01 },
    );

    window.addEventListener("pointermove", movePointer, { passive: true });
    window.addEventListener("resize", resize);
    observer.observe(canvas);
    if (reduceMotion) video.pause();
    else void video.play().catch((error) => {
      console.error("Landing video autoplay failed.", error);
    });
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("resize", resize);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <section className="relative flex min-h-full items-center justify-center overflow-hidden bg-black px-6 pb-36 pt-20 text-white">
      <video
        ref={videoRef}
        src="/media/landing-bg.mov"
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover grayscale"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(0,0,0,0.18)_58%,rgba(0,0,0,0.72)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/80 to-transparent" />

      <header className="absolute inset-x-0 top-7 z-10 mx-auto flex max-w-5xl justify-center px-6">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center font-mono text-[11px] tracking-[0.16em] text-white/58">
          <span>听障人士舞蹈小助手</span>
          <span className="text-white/38">
            Designed for X90dB 聋人街舞团 by Studio 8 × Give
          </span>
        </p>
      </header>

      <div className="absolute inset-x-6 bottom-8 z-10 flex flex-col items-center gap-5">
        <div className="flex w-full max-w-md gap-3">
          <button
            type="button"
            onClick={() => onEnter("learning")}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full border-0 bg-white/10 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white hover:text-black"
          >
            <GraduationCap className="h-4 w-4" />
            扒舞练习
          </button>
          <button
            type="button"
            onClick={() => onEnter("performing")}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full border-0 bg-white/10 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white hover:text-black"
          >
            <Sparkles className="h-4 w-4" />
            舞台演出
          </button>
        </div>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
          <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
          选择模式开始
        </span>
      </div>
    </section>
  );
}
