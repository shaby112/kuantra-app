import React, { useEffect, useMemo, useRef, useState } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

export type PrismProps = {
  height?: number;
  baseWidth?: number;
  animationType?: "rotate" | "hover" | "3drotate";
  glow?: number;
  offset?: { x?: number; y?: number };
  noise?: number;
  transparent?: boolean;
  scale?: number;
  hueShift?: number;
  colorFrequency?: number;
  hoverStrength?: number;
  inertia?: number;
  bloom?: number;
  suspendWhenOffscreen?: boolean;
  timeScale?: number;
  className?: string;
  quality?: "low" | "medium" | "high";
  renderScale?: number;
  maxFps?: number;
  disableOnMobile?: boolean;
  startWhenIdle?: boolean;
};

type QualityPreset = {
  steps: number;
  dprCap: number;
  renderScale: number;
  maxFps: number;
};

const QUALITY_PRESETS: Record<"low" | "medium" | "high", QualityPreset> = {
  low: { steps: 26, dprCap: 1, renderScale: 0.58, maxFps: 20 },
  medium: { steps: 40, dprCap: 1.15, renderScale: 0.7, maxFps: 24 },
  high: { steps: 60, dprCap: 1.35, renderScale: 0.85, maxFps: 30 },
};

function createFragmentShader(steps: number): string {
  return /* glsl */ `
    precision highp float;
    uniform vec2  iResolution;
    uniform float iTime;
    uniform float uHeight;
    uniform float uBaseHalf;
    uniform mat3  uRot;
    uniform int   uUseBaseWobble;
    uniform float uGlow;
    uniform vec2  uOffsetPx;
    uniform float uNoise;
    uniform float uSaturation;
    uniform float uScale;
    uniform float uHueShift;
    uniform float uColorFreq;
    uniform float uBloom;
    uniform float uCenterShift;
    uniform float uInvBaseHalf;
    uniform float uInvHeight;
    uniform float uMinAxis;
    uniform float uPxScale;
    uniform float uTimeScale;

    vec4 tanh4(vec4 x){
      vec4 e2x = exp(2.0*x);
      return (e2x - 1.0) / (e2x + 1.0);
    }

    float rand(vec2 co){
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    float sdOctaAnisoInv(vec3 p){
      vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
      float m = q.x + q.y + q.z - 1.0;
      return m * uMinAxis * 0.5773502691896258;
    }

    float sdPyramidUpInv(vec3 p){
      float oct = sdOctaAnisoInv(p);
      float halfSpace = -p.y;
      return max(oct, halfSpace);
    }

    mat3 hueRotation(float a){
      float c = cos(a), s = sin(a);
      mat3 W = mat3(
        0.299, 0.587, 0.114,
        0.299, 0.587, 0.114,
        0.299, 0.587, 0.114
      );
      mat3 U = mat3(
         0.701, -0.587, -0.114,
        -0.299,  0.413, -0.114,
        -0.300, -0.588,  0.886
      );
      mat3 V = mat3(
         0.168, -0.331,  0.500,
         0.328,  0.035, -0.500,
        -0.497,  0.296,  0.201
      );
      return W + U * c + V * s;
    }

    void main(){
      vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy - uOffsetPx) * uPxScale;
      float z = 5.0;
      float d = 0.0;
      vec3 p;
      vec4 o = vec4(0.0);
      float centerShift = uCenterShift;
      float cf = uColorFreq;

      mat2 wob = mat2(1.0);
      if (uUseBaseWobble == 1) {
        float t = iTime * uTimeScale;
        float c0 = cos(t + 0.0);
        float c1 = cos(t + 33.0);
        float c2 = cos(t + 11.0);
        wob = mat2(c0, c1, c2, c0);
      }

      const int STEPS = ${steps};
      for (int i = 0; i < STEPS; i++) {
        p = vec3(f, z);
        p.xz = p.xz * wob;
        p = uRot * p;
        vec3 q = p;
        q.y += centerShift;
        d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
        z -= d;
        o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
      }

      o = tanh4(o * o * (uGlow * uBloom) / 1e5);
      vec3 col = o.rgb;
      float n = rand(gl_FragCoord.xy + vec2(iTime));
      col += (n - 0.5) * uNoise;
      col = clamp(col, 0.0, 1.0);
      float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = clamp(mix(vec3(L), col, uSaturation), 0.0, 1.0);

      if(abs(uHueShift) > 0.0001){
        col = clamp(hueRotation(uHueShift) * col, 0.0, 1.0);
      }

      gl_FragColor = vec4(col, o.a);
    }
  `;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function PrismBackground({
  height = 3.5,
  baseWidth = 5.5,
  animationType = "rotate",
  glow = 1,
  offset = { x: 0, y: 0 },
  noise = 0.5,
  transparent = true,
  scale = 3.6,
  hueShift = 0,
  colorFrequency = 1,
  hoverStrength = 2,
  inertia = 0.05,
  bloom = 1,
  suspendWhenOffscreen = false,
  timeScale = 0.5,
  className = "",
  quality = "medium",
  renderScale,
  maxFps,
  disableOnMobile = true,
  startWhenIdle = true,
}: PrismProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglEnabled, setWebglEnabled] = useState(true);
  const [canStart, setCanStart] = useState(false);

  const qualityConfig = useMemo(() => QUALITY_PRESETS[quality], [quality]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setWebglEnabled(!(reduceMotion || (disableOnMobile && isMobile)));
  }, [disableOnMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!webglEnabled) {
      setCanStart(false);
      return;
    }

    if (!startWhenIdle) {
      setCanStart(true);
      return;
    }

    setCanStart(false);
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    let cancelled = false;

    const start = () => {
      if (!cancelled) setCanStart(true);
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(start, { timeout: 450 });
    } else {
      timeoutId = window.setTimeout(start, 140);
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (idleId !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
    };
  }, [webglEnabled, startWhenIdle]);

  useEffect(() => {
    if (!webglEnabled || !canStart) return;

    const container = containerRef.current;
    if (!container) return;

    const H = Math.max(0.001, height);
    const BW = Math.max(0.001, baseWidth);
    const BASE_HALF = BW * 0.5;
    const GLOW = Math.max(0.0, glow);
    const NOISE = Math.max(0.0, noise);
    const offX = offset?.x ?? 0;
    const offY = offset?.y ?? 0;
    const SAT = transparent ? 1.5 : 1;
    const SCALE = Math.max(0.001, scale);
    const HUE = hueShift || 0;
    const CFREQ = Math.max(0.0, colorFrequency || 1);
    const BLOOM = Math.max(0.0, bloom || 1);
    const TS = Math.max(0, timeScale || 1);
    const HOVSTR = Math.max(0, hoverStrength || 1);
    const INERT = Math.max(0, Math.min(1, inertia || 0.12));
    const FPS = Math.max(12, maxFps ?? qualityConfig.maxFps);
    const RENDER_SCALE = clamp(renderScale ?? qualityConfig.renderScale, 0.45, 1);
    const dpr = Math.min(qualityConfig.dprCap, window.devicePixelRatio || 1);

    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer({
        dpr,
        alpha: transparent,
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch (error) {
      console.warn("PrismBackground disabled after WebGL initialization error.", error);
      setWebglEnabled(false);
      return;
    }

    const gl = renderer.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    Object.assign(gl.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      pointerEvents: "none",
    } as Partial<CSSStyleDeclaration>);

    container.appendChild(gl.canvas);

    const vertex = /* glsl */ `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragment = createFragmentShader(qualityConfig.steps);
    const geometry = new Triangle(gl);
    const iResBuf = new Float32Array(2);
    const offsetPxBuf = new Float32Array(2);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iResolution: { value: iResBuf },
        iTime: { value: 0 },
        uHeight: { value: H },
        uBaseHalf: { value: BASE_HALF },
        uUseBaseWobble: { value: 1 },
        uRot: { value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) },
        uGlow: { value: GLOW },
        uOffsetPx: { value: offsetPxBuf },
        uNoise: { value: NOISE },
        uSaturation: { value: SAT },
        uScale: { value: SCALE },
        uHueShift: { value: HUE },
        uColorFreq: { value: CFREQ },
        uBloom: { value: BLOOM },
        uCenterShift: { value: H * 0.25 },
        uInvBaseHalf: { value: 1 / BASE_HALF },
        uInvHeight: { value: 1 / H },
        uMinAxis: { value: Math.min(BASE_HALF, H) },
        uPxScale: { value: 1 / ((gl.drawingBufferHeight || 1) * 0.1 * SCALE) },
        uTimeScale: { value: TS },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer!.setSize(Math.max(1, Math.floor(w * RENDER_SCALE)), Math.max(1, Math.floor(h * RENDER_SCALE)));
      iResBuf[0] = gl.drawingBufferWidth;
      iResBuf[1] = gl.drawingBufferHeight;
      offsetPxBuf[0] = offX * dpr;
      offsetPxBuf[1] = offY * dpr;
      program.uniforms.uPxScale.value = 1 / ((gl.drawingBufferHeight || 1) * 0.1 * SCALE);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const rotBuf = new Float32Array(9);
    const setMat3FromEuler = (yawY: number, pitchX: number, rollZ: number, out: Float32Array) => {
      const cy = Math.cos(yawY);
      const sy = Math.sin(yawY);
      const cx = Math.cos(pitchX);
      const sx = Math.sin(pitchX);
      const cz = Math.cos(rollZ);
      const sz = Math.sin(rollZ);

      out[0] = cy * cz + sy * sx * sz;
      out[1] = cx * sz;
      out[2] = -sy * cz + cy * sx * sz;
      out[3] = -cy * sz + sy * sx * cz;
      out[4] = cx * cz;
      out[5] = sy * sz + cy * sx * cz;
      out[6] = sy * cx;
      out[7] = -sx;
      out[8] = cy * cx;
      return out;
    };

    const NOISE_IS_ZERO = NOISE < 1e-6;
    let raf = 0;
    let lastPaint = 0;
    const frameInterval = 1000 / FPS;
    const t0 = performance.now();

    const startRAF = () => {
      if (raf) return;
      raf = requestAnimationFrame(render);
    };

    const stopRAF = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const randVal = () => Math.random();
    const wX = 0.3 + randVal() * 0.6;
    const wY = 0.2 + randVal() * 0.7;
    const wZ = 0.1 + randVal() * 0.5;
    const phX = randVal() * Math.PI * 2;
    const phZ = randVal() * Math.PI * 2;

    let yaw = 0;
    let pitch = 0;
    let roll = 0;
    let targetYaw = 0;
    let targetPitch = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const pointer = { x: 0, y: 0, inside: true };

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      const ny = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
      pointer.x = Math.max(-1, Math.min(1, nx));
      pointer.y = Math.max(-1, Math.min(1, ny));
      pointer.inside = true;
    };

    const onLeave = () => {
      pointer.inside = false;
    };

    const onVisibilityChange = () => {
      if (document.hidden) stopRAF();
      else startRAF();
    };

    let onPointerMove: ((e: PointerEvent) => void) | null = null;
    if (animationType === "hover") {
      onPointerMove = (e: PointerEvent) => {
        onMove(e);
        startRAF();
      };
      container.addEventListener("pointermove", onPointerMove, { passive: true });
      container.addEventListener("pointerleave", onLeave);
      window.addEventListener("blur", onLeave);
      program.uniforms.uUseBaseWobble.value = 0;
    } else if (animationType === "3drotate") {
      program.uniforms.uUseBaseWobble.value = 0;
    } else {
      program.uniforms.uUseBaseWobble.value = 1;
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    const render = (t: number) => {
      if (t - lastPaint < frameInterval) {
        raf = requestAnimationFrame(render);
        return;
      }
      lastPaint = t;

      const time = (t - t0) * 0.001;
      program.uniforms.iTime.value = time;
      let continueRAF = true;

      if (animationType === "hover") {
        const maxPitch = 0.5 * HOVSTR;
        const maxYaw = 0.5 * HOVSTR;
        targetYaw = (pointer.inside ? -pointer.x : 0) * maxYaw;
        targetPitch = (pointer.inside ? pointer.y : 0) * maxPitch;

        yaw = lerp(yaw, targetYaw, INERT);
        pitch = lerp(pitch, targetPitch, INERT);
        roll = lerp(roll, 0, 0.1);

        program.uniforms.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf);

        if (NOISE_IS_ZERO) {
          const settled =
            Math.abs(yaw - targetYaw) < 1e-4 &&
            Math.abs(pitch - targetPitch) < 1e-4 &&
            Math.abs(roll) < 1e-4;
          if (settled) continueRAF = false;
        }
      } else if (animationType === "3drotate") {
        const tScaled = time * TS;
        yaw = tScaled * wY;
        pitch = Math.sin(tScaled * wX + phX) * 0.5;
        roll = Math.sin(tScaled * wZ + phZ) * 0.4;
        program.uniforms.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf);
        if (TS < 1e-6) continueRAF = false;
      } else {
        rotBuf[0] = 1; rotBuf[1] = 0; rotBuf[2] = 0;
        rotBuf[3] = 0; rotBuf[4] = 1; rotBuf[5] = 0;
        rotBuf[6] = 0; rotBuf[7] = 0; rotBuf[8] = 1;
        program.uniforms.uRot.value = rotBuf;
        if (TS < 1e-6) continueRAF = false;
      }

      renderer!.render({ scene: mesh });
      if (continueRAF && !document.hidden) {
        raf = requestAnimationFrame(render);
      } else {
        raf = 0;
      }
    };

    interface PrismContainer extends HTMLElement {
      __prismIO?: IntersectionObserver;
    }

    if (suspendWhenOffscreen) {
      const io = new IntersectionObserver((entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible && !document.hidden) startRAF();
        else stopRAF();
      });
      io.observe(container);
      startRAF();
      (container as PrismContainer).__prismIO = io;
    } else {
      startRAF();
    }

    return () => {
      stopRAF();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);

      if (animationType === "hover") {
        if (onPointerMove) container.removeEventListener("pointermove", onPointerMove as EventListener);
        container.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("blur", onLeave);
      }

      if (suspendWhenOffscreen) {
        const io = (container as PrismContainer).__prismIO as IntersectionObserver | undefined;
        if (io) io.disconnect();
        delete (container as PrismContainer).__prismIO;
      }

      if (gl.canvas.parentElement === container) container.removeChild(gl.canvas);
    };
  }, [
    webglEnabled,
    canStart,
    height,
    baseWidth,
    animationType,
    glow,
    noise,
    offset?.x,
    offset?.y,
    scale,
    transparent,
    hueShift,
    colorFrequency,
    timeScale,
    hoverStrength,
    inertia,
    bloom,
    suspendWhenOffscreen,
    qualityConfig.steps,
    qualityConfig.dprCap,
    qualityConfig.renderScale,
    qualityConfig.maxFps,
    renderScale,
    maxFps,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={
        webglEnabled && canStart
          ? undefined
          : {
              background:
                "radial-gradient(ellipse at 35% 10%, rgba(124,95,240,0.38), rgba(8,14,32,0.92) 52%, rgba(5,9,20,1) 100%)",
            }
      }
    />
  );
}

export default PrismBackground;
