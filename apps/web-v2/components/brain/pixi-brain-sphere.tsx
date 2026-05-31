"use client";

/**
 * PixiBrainSphere
 * ---------------
 * GPU-accelerated "living brain" sphere, the v2 rendering called for in
 * `attached_assets/AIVO_Brain_Clone_Awakening_Sequence_*.md` ("a cross
 * between a nebula, a heartbeat visualization, and a warm lantern").
 *
 * Implementation: a single full-bleed quad `Mesh` driven by a custom GLSL
 * fragment shader (domain-warped fbm noise → aurora marble, radial falloff
 * → sphere, a breathing pulse on the radius/brightness). The colour
 * signature comes from the learner's `visualIdentity` (primary + up to
 * three secondary hues), so every learner's brain looks different.
 *
 * Resilience: Pixi is imported dynamically (client-only, keeps it out of
 * the SSR bundle) and the whole thing degrades to a pure-CSS breathing
 * orb when WebGL is unavailable, when `prefers-reduced-motion` is set, or
 * if Pixi fails to initialise for any reason. Callers always get a round,
 * glowing, on-brand sphere.
 */
import { useEffect, useRef, useState } from "react";
import { hexToRgbNorm } from "@/lib/brain/hex";

type PulseRate = "calm" | "steady" | "energetic";

export interface PixiBrainSphereProps {
  primaryHue: string;
  secondaryHues: string[];
  pulseRate?: PulseRate;
  /** 0..1 — how "formed" the sphere is. 1 = fully alive. Drives brightness. */
  intensity?: number;
  /** CSS size of the square canvas. Default 240. */
  size?: number;
  /** Accessible label for the figure. */
  ariaLabel?: string;
  className?: string;
}

const PULSE_HZ: Record<PulseRate, number> = {
  calm: 0.24,
  steady: 0.34,
  energetic: 0.5,
};

// Fragment shader: aurora-marbled sphere with a breathing pulse.
// GLSL ES 3.00 (`in`/`out`/`texture`) — Pixi v8's WebGL target. Pixi
// prepends the `#version` + precision directives at compile time.
const FRAG = `
in vec2 vUv;
out vec4 finalColor;
uniform float uTime;
uniform float uPulseHz;
uniform float uIntensity;
uniform vec3 uPrimary;
uniform vec3 uSec0;
uniform vec3 uSec1;
uniform vec3 uSec2;

// Hash / value-noise / fbm — cheap domain-warped marble.
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = vUv * 2.0 - 1.0;       // -1..1
  float r = length(uv);
  // Breathing: radius + brightness modulated by a slow sine.
  float breath = 0.5 + 0.5 * sin(uTime * uPulseHz * 6.2831853);
  float radius = 0.82 + breath * 0.05;

  // Outside the sphere → transparent (soft edge).
  float sphere = smoothstep(radius, radius - 0.16, r);
  if (sphere <= 0.001) { finalColor = vec4(0.0); return; }

  // Fake spherical normal for a lit, 3D feel.
  float z = sqrt(max(0.0, radius*radius - r*r));
  vec3 n = normalize(vec3(uv, z));
  vec3 lightDir = normalize(vec3(-0.4, -0.6, 0.7));
  float diff = clamp(dot(n, lightDir), 0.0, 1.0);

  // Domain-warped marble that drifts over time → aurora threads.
  vec2 q = n.xy * 1.6;
  float warp = fbm(q + uTime * 0.05);
  float marble = fbm(q + warp * 1.5 + vec2(uTime * 0.03, -uTime * 0.02));

  // Blend the learner's palette across the marble field.
  vec3 col = mix(uPrimary, uSec0, smoothstep(0.2, 0.6, marble));
  col = mix(col, uSec1, smoothstep(0.55, 0.85, marble) * 0.7);
  col = mix(col, uSec2, smoothstep(0.8, 1.0, warp) * 0.5);

  // Lighting + inner glow + rim light.
  col *= 0.55 + 0.7 * diff;
  float rim = pow(1.0 - clamp(z / radius, 0.0, 1.0), 2.0);
  col += uSec0 * rim * 0.35;
  float core = smoothstep(0.6, 0.0, r);
  col += uPrimary * core * 0.25;

  // Intensity (formation progress) + breathing brightness.
  col *= mix(0.4, 1.15, clamp(uIntensity, 0.0, 1.0));
  col *= 0.92 + breath * 0.12;

  finalColor = vec4(col * sphere, sphere);
}
`;

const VERT = `
in vec2 aPosition;
out vec2 vUv;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main(){
  vUv = aPosition;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`;

function CssFallbackSphere({
  primaryHue,
  secondaryHues,
  pulseRate = "steady",
  size = 240,
  ariaLabel,
  className,
  animated,
}: PixiBrainSphereProps & { animated: boolean }) {
  const sec0 = secondaryHues[0] ?? primaryHue;
  const sec1 = secondaryHues[1] ?? sec0;
  const pulseMs = Math.round(1000 / PULSE_HZ[pulseRate]);
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ width: size, height: size, position: "relative" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          background: `radial-gradient(circle at 32% 30%, ${primaryHue}, ${sec0} 55%, ${sec1} 100%)`,
          boxShadow: `0 0 60px 6px ${primaryHue}66, inset 0 0 40px ${sec0}55`,
          animation: animated ? `pbsBreath ${pulseMs}ms ease-in-out infinite` : undefined,
        }}
      />
      <style>{`
        @keyframes pbsBreath {
          0%, 100% { transform: scale(1); filter: brightness(0.95); }
          50% { transform: scale(1.04); filter: brightness(1.1); }
        }
      `}</style>
    </div>
  );
}

export default function PixiBrainSphere(props: PixiBrainSphereProps) {
  const { primaryHue, secondaryHues, pulseRate = "steady", intensity = 1, size = 240 } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Start in fallback mode; flip to Pixi only after a successful init.
  const [usePixi, setUsePixi] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    // Honour reduced-motion by skipping the live render entirely.
    if (reducedMotion) {
      setUsePixi(false);
      return;
    }
    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const host = hostRef.current;
      if (!host) return;
      try {
        const PIXI = await import("pixi.js");
        if (disposed) return;

        const app = new PIXI.Application();
        const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
        await app.init({
          width: size,
          height: size,
          backgroundAlpha: 0,
          antialias: true,
          resolution: dpr,
          autoDensity: true,
          preference: "webgl",
        });
        if (disposed) {
          app.destroy(true);
          return;
        }

        const geometry = new PIXI.Geometry({
          attributes: {
            aPosition: [0, 0, 1, 0, 1, 1, 0, 1],
          },
          indexBuffer: [0, 1, 2, 0, 2, 3],
        });

        const toVec = (hex: string) => hexToRgbNorm(hex);
        const shader = PIXI.Shader.from({
          gl: { vertex: VERT, fragment: FRAG },
          resources: {
            uniforms: {
              uTime: { value: 0, type: "f32" },
              uPulseHz: { value: PULSE_HZ[pulseRate], type: "f32" },
              uIntensity: { value: intensity, type: "f32" },
              uPrimary: { value: toVec(primaryHue), type: "vec3<f32>" },
              uSec0: { value: toVec(secondaryHues[0] ?? primaryHue), type: "vec3<f32>" },
              uSec1: { value: toVec(secondaryHues[1] ?? secondaryHues[0] ?? primaryHue), type: "vec3<f32>" },
              uSec2: { value: toVec(secondaryHues[2] ?? secondaryHues[0] ?? primaryHue), type: "vec3<f32>" },
            },
          },
        });

        const mesh = new PIXI.Mesh({ geometry, shader });
        // The quad is in 0..1 space; scale it up to the canvas.
        mesh.scale.set(size);
        app.stage.addChild(mesh);

        host.appendChild(app.canvas);

        const start = performance.now();
        const onTick = () => {
          const t = (performance.now() - start) / 1000;
          shader.resources.uniforms.uniforms.uTime = t;
        };
        app.ticker.add(onTick);

        setUsePixi(true);
        cleanup = () => {
          app.ticker.remove(onTick);
          try {
            if (app.canvas.parentNode === host) host.removeChild(app.canvas);
          } catch {
            /* ignore */
          }
          app.destroy(true);
        };
      } catch {
        // WebGL unavailable / context lost / init failed → stay on CSS.
        if (!disposed) setUsePixi(false);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
    // Re-init when the visual signature or size changes.
  }, [primaryHue, secondaryHues, pulseRate, intensity, size, reducedMotion]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={props.ariaLabel}
      className={props.className}
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      {!usePixi ? <CssFallbackSphere {...props} animated={!reducedMotion} /> : null}
    </div>
  );
}
