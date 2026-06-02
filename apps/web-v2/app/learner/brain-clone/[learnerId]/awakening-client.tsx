/* eslint-disable no-restricted-syntax -- this file embeds a self-contained
   CSS animation surface that intentionally uses raw color literals (the
   awakening background palette is fixed deep-space chrome, distinct from
   the Inclusive-Warm token system). Per-learner hues come through CSS
   custom properties from `state.visualIdentity`. */
"use client";

/**
 * Brain Clone Awakening — client animation surface.
 *
 * Six-phase narrative sequence per
 * `attached_assets/AIVO_Brain_Clone_Awakening_Sequence_*.md`:
 *
 *   1. gathering   — gentle ambient field, narration begins
 *   2. convergence — orbs (one per "memory") drift in from screen edges
 *   3. formation   — orbs collapse into a central pulsing sphere
 *   4. memories    — memory chips flash near the sphere
 *   5. reveal      — sphere brightens, learner's name is spoken on screen
 *   6. settling    — sphere shrinks into avatar slot, CTA appears
 *
 * Implementation is intentionally CSS-only (no WebGL) for v1: every
 * browser renders it, it works under `prefers-reduced-motion`, and the
 * file ships with no runtime deps beyond React. The full Pixi/Lottie
 * implementation called for in the design doc is queued for v2.
 *
 * Color signature is driven by `visualIdentity` on the brain profile so
 * each learner sees a unique palette computed by the brain-svc clone
 * pipeline (`primaryHue` + up to three `secondaryHues`, plus a
 * `pulseRate` which sets the breathing animation speed).
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import PixiBrainSphere from "@/components/brain/pixi-brain-sphere";

type PulseRate = "calm" | "steady" | "energetic";

type Phase = "gathering" | "convergence" | "formation" | "memories" | "reveal" | "settling";

// Phase durations in ms. Total ~22s, paced so the parent watch view can
// keep up without feeling rushed. Reduced-motion users see one
// 1-second crossfade per phase.
const PHASE_DURATIONS: Record<Phase, number> = {
  gathering: 2800,
  convergence: 4200,
  formation: 3500,
  memories: 4800,
  reveal: 3500,
  settling: 3200,
};
const PHASE_ORDER: Phase[] = [
  "gathering",
  "convergence",
  "formation",
  "memories",
  "reveal",
  "settling",
];

const PULSE_MS: Record<PulseRate, number> = {
  calm: 4200,
  steady: 3200,
  energetic: 2200,
};

export function AwakeningClient({
  displayName,
  primaryHue,
  secondaryHues,
  pulseRate,
  memories,
}: {
  displayName: string;
  primaryHue: string;
  secondaryHues: string[];
  pulseRate: PulseRate;
  memories: string[];
}) {
  const router = useRouter();
  const t = useTranslations("brain_clone");
  const [phase, setPhase] = useState<Phase>("gathering");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
  }, []);

  useEffect(() => {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx >= PHASE_ORDER.length - 1) return;
    const dur = reducedMotion ? 900 : PHASE_DURATIONS[phase];
    const t = window.setTimeout(() => setPhase(PHASE_ORDER[idx + 1]), dur);
    return () => window.clearTimeout(t);
  }, [phase, reducedMotion]);

  const palette = useMemo(() => {
    const sec = secondaryHues.length > 0 ? secondaryHues : [primaryHue];
    return { primary: primaryHue, secondary: sec };
  }, [primaryHue, secondaryHues]);

  const orbCount = Math.min(12, Math.max(6, memories.length * 2));
  const orbs = useMemo(() => {
    return Array.from({ length: orbCount }).map((_, i) => {
      const angle = (i / orbCount) * Math.PI * 2;
      const radius = 42 + (i % 3) * 6;
      const startX = 50 + Math.cos(angle) * 60;
      const startY = 50 + Math.sin(angle) * 60;
      const targetX = 50 + Math.cos(angle) * 0;
      const targetY = 50 + Math.sin(angle) * 0;
      const hue = palette.secondary[i % palette.secondary.length];
      return { i, angle, radius, startX, startY, targetX, targetY, hue };
    });
  }, [orbCount, palette.secondary]);

  const narrationKey = `awakening_narration_${phase}` as const;
  const phaseTitleKey = `awakening_phase_${phase}` as const;
  const showFinalCta = phase === "settling";

  // The GPU brain sphere fades in once the orbs collapse (formation) and
  // brightens through reveal. Before formation it stays hidden so the orb
  // convergence reads clearly. Maps each phase to a 0..1 "aliveness".
  const sphereIntensity = useMemo<number>(() => {
    switch (phase) {
      case "formation":
        return 0.7;
      case "memories":
        return 0.85;
      case "reveal":
        return 1;
      case "settling":
        return 0.9;
      default:
        return 0; // gathering / convergence — sphere not yet formed
    }
  }, [phase]);
  const showSphere = sphereIntensity > 0;
  const pulseForSphere: PulseRate = phase === "reveal" ? "energetic" : pulseRate;
  const onContinue = () => router.push("/learner/home");
  const onSkip = () => router.push("/learner/home");

  return (
    <main
      data-phase={phase}
      data-reduced-motion={reducedMotion ? "on" : "off"}
      className="awakening-root"
      aria-live="polite"
      aria-label={t(phaseTitleKey)}
      style={
        {
          "--bc-primary": palette.primary,
          "--bc-secondary-1": palette.secondary[0] ?? palette.primary,
          "--bc-secondary-2": palette.secondary[1] ?? palette.primary,
          "--bc-secondary-3": palette.secondary[2] ?? palette.primary,
          "--bc-pulse-ms": `${PULSE_MS[pulseRate]}ms`,
        } as React.CSSProperties
      }
    >
      <div className="awakening-bg" />
      <div className="awakening-field">
        {orbs.map((o) => (
          <span
            key={o.i}
            className="awakening-orb"
            style={
              {
                "--bc-orb-x-start": `${o.startX}%`,
                "--bc-orb-y-start": `${o.startY}%`,
                "--bc-orb-x-end": `${o.targetX}%`,
                "--bc-orb-y-end": `${o.targetY}%`,
                "--bc-orb-color": o.hue,
                "--bc-orb-delay": `${(o.i % 6) * 120}ms`,
              } as React.CSSProperties
            }
          />
        ))}
        <div className="awakening-sphere" aria-hidden="true" />
        {showSphere ? (
          <div className="awakening-pixi" data-phase={phase} aria-hidden="true">
            <PixiBrainSphere
              primaryHue={primaryHue}
              secondaryHues={secondaryHues}
              pulseRate={pulseForSphere}
              intensity={sphereIntensity}
              size={260}
            />
          </div>
        ) : null}
        <div className="awakening-memories" aria-hidden={phase !== "memories"}>
          {memories.slice(0, 5).map((m, idx) => (
            <span
              key={m + idx}
              className="awakening-memory-chip"
              style={{ "--bc-memory-delay": `${idx * 400}ms` } as React.CSSProperties}
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="awakening-narration">
        <p className="awakening-narration-eyebrow">{t(phaseTitleKey)}</p>
        <p className="awakening-narration-line">{t(narrationKey)}</p>
        {phase === "reveal" || phase === "settling" ? (
          <p className="awakening-name">{displayName}</p>
        ) : null}
      </div>

      {showFinalCta ? (
        <div className="awakening-cta">
          <button type="button" onClick={onContinue} className="awakening-cta-btn">
            {t("awakening_continue")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSkip}
          className="awakening-skip"
          aria-label={t("skip_animation")}
        >
          Skip
        </button>
      )}

      <style>{`
        .awakening-root {
          position: fixed;
          inset: 0;
          overflow: hidden;
          background: radial-gradient(
            ellipse at center,
            color-mix(in oklch, var(--bc-primary) 35%, #050714) 0%,
            #050714 75%
          );
          color: #f4f6ff;
          isolation: isolate;
        }
        .awakening-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 20% 30%, color-mix(in oklch, var(--bc-secondary-1) 40%, transparent), transparent 55%),
            radial-gradient(circle at 80% 70%, color-mix(in oklch, var(--bc-secondary-2) 40%, transparent), transparent 55%),
            radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--bc-secondary-3) 25%, transparent), transparent 60%);
          opacity: 0.55;
          animation: bcBgDrift 18s ease-in-out infinite alternate;
          pointer-events: none;
        }
        .awakening-field {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
        }
        .awakening-orb {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: var(--bc-orb-color);
          box-shadow: 0 0 18px 4px color-mix(in oklch, var(--bc-orb-color) 60%, transparent);
          left: var(--bc-orb-x-start);
          top: var(--bc-orb-y-start);
          transform: translate(-50%, -50%) scale(0.85);
          opacity: 0;
          transition:
            left 3800ms cubic-bezier(.2,.7,.1,1),
            top 3800ms cubic-bezier(.2,.7,.1,1),
            opacity 1200ms ease,
            transform 1200ms ease;
          transition-delay: var(--bc-orb-delay), var(--bc-orb-delay), var(--bc-orb-delay), var(--bc-orb-delay);
          will-change: left, top, opacity, transform;
        }
        .awakening-root[data-phase="gathering"] .awakening-orb { opacity: 0.85; transform: translate(-50%, -50%) scale(0.9); }
        .awakening-root[data-phase="convergence"] .awakening-orb,
        .awakening-root[data-phase="formation"] .awakening-orb,
        .awakening-root[data-phase="memories"] .awakening-orb,
        .awakening-root[data-phase="reveal"] .awakening-orb,
        .awakening-root[data-phase="settling"] .awakening-orb {
          left: var(--bc-orb-x-end);
          top: var(--bc-orb-y-end);
          opacity: 0.95;
        }
        .awakening-root[data-phase="formation"] .awakening-orb,
        .awakening-root[data-phase="memories"] .awakening-orb,
        .awakening-root[data-phase="reveal"] .awakening-orb {
          opacity: 0.6;
          transform: translate(-50%, -50%) scale(0.4);
        }
        .awakening-root[data-phase="settling"] .awakening-orb {
          opacity: 0;
        }
        .awakening-sphere {
          width: 16vmin;
          height: 16vmin;
          border-radius: 9999px;
          background: radial-gradient(
            circle at 30% 30%,
            color-mix(in oklch, var(--bc-primary) 85%, white) 0%,
            color-mix(in oklch, var(--bc-primary) 70%, #1a1438) 55%,
            #060814 100%
          );
          box-shadow:
            0 0 80px 8px color-mix(in oklch, var(--bc-primary) 55%, transparent),
            inset 0 0 40px color-mix(in oklch, var(--bc-secondary-1) 35%, transparent);
          opacity: 0;
          transform: scale(0.2);
          transition: opacity 1400ms ease, transform 1400ms ease;
          animation: bcPulse var(--bc-pulse-ms) ease-in-out infinite;
          z-index: 2;
        }
        .awakening-root[data-phase="formation"] .awakening-sphere,
        .awakening-root[data-phase="memories"] .awakening-sphere {
          opacity: 1;
          transform: scale(1);
        }
        .awakening-root[data-phase="reveal"] .awakening-sphere {
          opacity: 1;
          transform: scale(1.1);
        }
        .awakening-root[data-phase="settling"] .awakening-sphere {
          opacity: 0.85;
          transform: scale(0.55) translateY(15vh);
        }
        .awakening-pixi {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) scale(0.85);
          z-index: 2;
          opacity: 0;
          line-height: 0;
          filter: drop-shadow(0 0 60px color-mix(in oklch, var(--bc-primary) 50%, transparent));
          transition: opacity 1200ms ease, transform 1200ms ease;
          pointer-events: none;
        }
        .awakening-root[data-phase="formation"] .awakening-pixi,
        .awakening-root[data-phase="memories"] .awakening-pixi {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        .awakening-root[data-phase="reveal"] .awakening-pixi {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.12);
        }
        .awakening-root[data-phase="settling"] .awakening-pixi {
          opacity: 0.92;
          transform: translate(-50%, -50%) scale(0.6) translateY(15vh);
        }
        .awakening-memories {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          pointer-events: none;
          z-index: 3;
        }
        .awakening-memory-chip {
          position: absolute;
          padding: 0.45rem 0.9rem;
          background: rgba(10, 14, 28, 0.75);
          border: 1px solid color-mix(in oklch, var(--bc-secondary-1) 50%, transparent);
          color: #f4f6ff;
          border-radius: 9999px;
          font-size: 0.85rem;
          font-weight: 500;
          letter-spacing: 0.01em;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 700ms ease, transform 700ms ease;
          transition-delay: var(--bc-memory-delay);
          white-space: nowrap;
          backdrop-filter: blur(6px);
        }
        .awakening-memory-chip:nth-child(1) { transform: translate(-22vmin, -10vmin); }
        .awakening-memory-chip:nth-child(2) { transform: translate(20vmin, -8vmin); }
        .awakening-memory-chip:nth-child(3) { transform: translate(-18vmin, 12vmin); }
        .awakening-memory-chip:nth-child(4) { transform: translate(22vmin, 12vmin); }
        .awakening-memory-chip:nth-child(5) { transform: translate(0, -18vmin); }
        .awakening-root[data-phase="memories"] .awakening-memory-chip { opacity: 1; }
        .awakening-narration {
          position: absolute;
          left: 50%;
          bottom: 18%;
          transform: translateX(-50%);
          text-align: center;
          max-width: min(640px, 90vw);
          z-index: 4;
        }
        .awakening-narration-eyebrow {
          font-size: 0.78rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: color-mix(in oklch, var(--bc-secondary-1) 70%, white);
          margin: 0 0 0.5rem;
          opacity: 0.9;
        }
        .awakening-narration-line {
          font-size: clamp(1.1rem, 2.4vmin, 1.6rem);
          line-height: 1.45;
          color: #f4f6ff;
          margin: 0;
          font-weight: 500;
        }
        .awakening-name {
          margin: 0.8rem 0 0;
          font-size: clamp(1.4rem, 3.4vmin, 2.2rem);
          font-weight: 700;
          color: color-mix(in oklch, var(--bc-primary) 65%, white);
          letter-spacing: 0.005em;
        }
        .awakening-cta {
          position: absolute;
          left: 50%;
          bottom: 8%;
          transform: translateX(-50%);
          z-index: 5;
        }
        .awakening-cta-btn {
          padding: 0.95rem 2.2rem;
          font-size: 1rem;
          font-weight: 600;
          color: #050714;
          background: color-mix(in oklch, var(--bc-primary) 75%, white);
          border: none;
          border-radius: 9999px;
          cursor: pointer;
          box-shadow: 0 14px 40px color-mix(in oklch, var(--bc-primary) 45%, transparent);
          transition: transform 200ms ease, box-shadow 200ms ease;
        }
        .awakening-cta-btn:hover { transform: translateY(-1px); }
        .awakening-cta-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        .awakening-skip {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          padding: 0.5rem 0.9rem;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #f4f6ff;
          border-radius: 9999px;
          font-size: 0.85rem;
          cursor: pointer;
          z-index: 6;
        }
        .awakening-skip:hover { background: rgba(255,255,255,0.16); }
        @keyframes bcPulse {
          0%, 100% { box-shadow: 0 0 70px 6px color-mix(in oklch, var(--bc-primary) 45%, transparent); }
          50%      { box-shadow: 0 0 100px 14px color-mix(in oklch, var(--bc-primary) 65%, transparent); }
        }
        @keyframes bcBgDrift {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-2%, 1%) scale(1.04); }
        }
        .awakening-root[data-reduced-motion="on"] .awakening-orb,
        .awakening-root[data-reduced-motion="on"] .awakening-sphere,
        .awakening-root[data-reduced-motion="on"] .awakening-bg,
        .awakening-root[data-reduced-motion="on"] .awakening-memory-chip {
          animation: none !important;
          transition-duration: 600ms !important;
        }
      `}</style>
    </main>
  );
}
