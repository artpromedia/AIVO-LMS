/* eslint-disable no-restricted-syntax -- this is a self-contained animation
   surface ported from aivo-ai-learning. It uses raw color literals for the
   deep-space chrome and the six domain-coded particle hues (ELA amber, math
   blue, science green, SEL pink, speech purple, executive cyan). These are a
   fixed signature for the clone sequence, distinct from the Inclusive-Warm
   token system. The learner's own palette comes through via `primaryHue` /
   `secondaryHues` props from `state.visualIdentity`. */
"use client";

/**
 * MasterToChildClone
 * ------------------
 * The "cloning" narrative stage for the Brain build flow. Renders the AIVO
 * master brain on the left, the child's still-empty virtual brain on the
 * right, and an animated particle stream flowing between them. As each
 * particle reaches the child silhouette, the corresponding region lights
 * up and a pentatonic chime plays.
 *
 * Ported from `aivo-ai-learning/apps/web/src/components/brain/MasterToChildClone.tsx`,
 * adapted to web-v2's next-intl + visualIdentity data model.
 *
 * Behaviour:
 *  - ~5s scripted sequence (RAF-driven) with a Skip button.
 *  - Particles colour-coded by domain.
 *  - Honours `prefers-reduced-motion`: drops particle motion for a cross-fade.
 *  - Records "seen clone" per learner so the watch flow can auto-skip the
 *    intro on revisit while keeping a deliberate "Replay" affordance.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Brain, Lock, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import AudioMuteToggle from "./audio-mute-toggle";
import { playChime, playSwell } from "@/lib/audio";
import { markSeenClone } from "@/lib/clone-flags";

interface MasterToChildCloneProps {
  learnerName: string;
  /** Called when the animation completes naturally or the user skips. */
  onComplete?: () => void;
  /** Total scripted duration in milliseconds. Defaults to 5000 (~5s). */
  durationMs?: number;
  /**
   * If provided, the component records that this learner's parent has now
   * watched the cloning animation in full (used to auto-skip on revisit).
   */
  learnerId?: string;
  /** Learner's primary palette hue (from `state.visualIdentity`). */
  primaryHue?: string;
  /** Up to three secondary hues used to tint the child brain core. */
  secondaryHues?: string[];
}

const DOMAIN_PARTICLES = [
  { key: "ela", color: "#F59E0B", angle: -28 },
  { key: "math", color: "#3B82F6", angle: -10 },
  { key: "science", color: "#10B981", angle: 6 },
  { key: "sel", color: "#EC4899", angle: 22 },
  { key: "speech", color: "#8B5CF6", angle: 38 },
  { key: "executive", color: "#06B6D4", angle: -42 },
];

// C-major pentatonic so the arrival arpeggio always reads as positive.
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5 D5 E5 G5 A5 C6

export default function MasterToChildClone({
  learnerName,
  onComplete,
  durationMs = 5000,
  learnerId,
  primaryHue,
  secondaryHues = [],
}: MasterToChildCloneProps) {
  const reactId = useId();
  const t = useTranslations("brain_clone");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const startedRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const swellStopRef = useRef<(() => void) | null>(null);
  // Each particle plays its own chime exactly once when it "arrives".
  const chimedDomainsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Start the ambient swell exactly once per mount; tear down on skip/unmount.
  useEffect(() => {
    swellStopRef.current = playSwell(durationMs / 1000);
    return () => {
      swellStopRef.current?.();
      swellStopRef.current = null;
    };
  }, [durationMs]);

  useEffect(() => {
    let cancelled = false;
    function tick(ts: number) {
      if (cancelled) return;
      if (startedRef.current == null) startedRef.current = ts;
      const elapsed = ts - startedRef.current;
      const p = Math.min(1, elapsed / durationMs);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!completedRef.current) {
        completedRef.current = true;
        if (learnerId) markSeenClone(learnerId);
        // Defer so consumers can safely unmount without a render-phase warning.
        setTimeout(() => onComplete?.(), 0);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [durationMs, onComplete, learnerId]);

  const handleSkip = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    swellStopRef.current?.();
    swellStopRef.current = null;
    if (learnerId) markSeenClone(learnerId);
    setProgress(1);
    onComplete?.();
  };

  // How many particles have "arrived" — drives the child-brain region lighting.
  const arrivedCount = useMemo(
    () => Math.floor(progress * (DOMAIN_PARTICLES.length + 1)),
    [progress],
  );

  // Fire a per-region chime exactly once when each particle first arrives.
  // Ref-set guards against React StrictMode double-invocation in dev.
  useEffect(() => {
    for (let i = 0; i < arrivedCount && i < DOMAIN_PARTICLES.length; i++) {
      const key = DOMAIN_PARTICLES[i].key;
      if (chimedDomainsRef.current.has(key)) continue;
      chimedDomainsRef.current.add(key);
      playChime({ frequency: PENTATONIC[i % PENTATONIC.length], duration: 0.32, volume: 0.13 });
    }
  }, [arrivedCount]);

  // Child-brain core gradient tinted with the learner's own palette so the
  // brain that "wakes up" matches the colour signature they'll see elsewhere.
  const childCoreStops = useMemo(() => {
    const primary = primaryHue ?? "#A78BFA";
    const secondary = secondaryHues[0] ?? primary;
    return { primary, secondary };
  }, [primaryHue, secondaryHues]);

  return (
    <div
      className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-8 rounded-3xl"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, rgba(63,45,110,0.55), transparent 70%), linear-gradient(to bottom right, #1a0a3e, #0f172a, #0c1222)",
        color: "white",
      }}
      role="status"
      aria-live="polite"
      aria-label={t("clone_aria", { name: learnerName })}
    >
      <div className="max-w-3xl w-full text-center relative">
        <div className="absolute right-0 top-0">
          <AudioMuteToggle compact />
        </div>
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          {t("clone_eyebrow")}
        </div>

        <svg
          viewBox="0 0 600 260"
          className="w-full h-auto"
          aria-hidden="true"
          style={{ maxHeight: 320 }}
        >
          <defs>
            <radialGradient id={`${reactId}-master`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#7C3AED" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.4" />
            </radialGradient>
            <radialGradient id={`${reactId}-child`} cx="50%" cy="45%" r="55%">
              <stop
                offset="0%"
                stopColor={childCoreStops.primary}
                stopOpacity={0.2 + progress * 0.7}
              />
              <stop
                offset="100%"
                stopColor={childCoreStops.secondary}
                stopOpacity={0.05 + progress * 0.25}
              />
            </radialGradient>
            <filter id={`${reactId}-glow`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          {/* Connecting beam between brains, intensifies as cloning proceeds */}
          <line
            x1="190"
            y1="130"
            x2="410"
            y2="130"
            stroke="rgba(124,58,237,0.6)"
            strokeWidth={1 + progress * 3}
            strokeDasharray="6 6"
            opacity={0.4 + progress * 0.6}
          />

          {/* Master brain (left) */}
          <g transform="translate(150, 130)">
            <ellipse
              cx="0"
              cy="0"
              rx="80"
              ry="65"
              fill={`url(#${reactId}-master)`}
              filter={`url(#${reactId}-glow)`}
              opacity={reducedMotion ? 0.95 : undefined}
              style={
                reducedMotion
                  ? undefined
                  : {
                      animation: "mtcMasterPulse 2.4s ease-in-out infinite",
                      transformOrigin: "0 0",
                    }
              }
            />
            <path
              d="M-65,-25 Q-80,-50 -45,-58 Q-15,-62 5,-50 Q35,-58 60,-45 Q78,-20 70,5 Q75,30 50,45 Q15,55 -10,48 Q-40,52 -60,38 Q-78,15 -65,-25 Z"
              fill="rgba(255,255,255,0.08)"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="86"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="rgba(255,255,255,0.85)"
            >
              {t("clone_master_label")}
            </text>
          </g>

          {/* Child brain (right) */}
          <g transform="translate(450, 130)">
            <ellipse
              cx="0"
              cy="0"
              rx="80"
              ry="65"
              fill={`url(#${reactId}-child)`}
              opacity={0.4 + progress * 0.5}
            />
            <path
              d="M-65,-25 Q-80,-50 -45,-58 Q-15,-62 5,-50 Q35,-58 60,-45 Q78,-20 70,5 Q75,30 50,45 Q15,55 -10,48 Q-40,52 -60,38 Q-78,15 -65,-25 Z"
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.5"
              strokeDasharray={progress >= 1 ? "0" : "3 3"}
            />
            {/* Six region dots, light up as particles arrive */}
            {DOMAIN_PARTICLES.map((p, i) => {
              const a = (p.angle * Math.PI) / 180;
              const x = Math.cos(a) * 35;
              const y = Math.sin(a) * 28;
              const lit = i < arrivedCount;
              return (
                <circle
                  key={p.key}
                  cx={x}
                  cy={y}
                  r={lit ? 5 : 3.5}
                  fill={lit ? p.color : "rgba(255,255,255,0.25)"}
                  opacity={lit ? 0.95 : 0.6}
                  style={{ transition: "fill 300ms ease, r 300ms ease, opacity 300ms ease" }}
                />
              );
            })}
            <text
              x="0"
              y="86"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="rgba(255,255,255,0.85)"
            >
              {t("clone_child_label", { name: learnerName })}
            </text>
          </g>

          {/* Particles travelling master → child. Skipped under reduced-motion. */}
          {!reducedMotion &&
            DOMAIN_PARTICLES.map((p, i) => {
              // Stagger each particle's start so the stream feels continuous.
              const startFrac = i / DOMAIN_PARTICLES.length;
              const localProgress = Math.max(0, Math.min(1, (progress - startFrac * 0.6) / 0.45));
              if (localProgress <= 0) return null;
              const x1 = 230;
              const x2 = 370;
              const y = 130 + Math.sin((i / DOMAIN_PARTICLES.length) * Math.PI * 2) * 8;
              const x = x1 + (x2 - x1) * localProgress;
              return (
                <g key={p.key}>
                  <circle
                    cx={x}
                    cy={y}
                    r={4}
                    fill={p.color}
                    opacity={0.95}
                    filter={`url(#${reactId}-glow)`}
                  />
                  <circle cx={x} cy={y} r={2} fill="white" opacity={0.85} />
                </g>
              );
            })}
        </svg>

        <p className="mt-4 text-base md:text-lg font-bold">
          {t("clone_caption", { name: learnerName })}
        </p>
        <p className="mt-1 text-xs md:text-sm text-white/60 max-w-md mx-auto">
          {progress < 0.95
            ? t("clone_personalising", { name: learnerName })
            : t("clone_finalising")}
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-md mx-auto mt-5 bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(progress * 100)}%`,
              background: "linear-gradient(90deg, #A78BFA, #7C3AED, #06B6D4, #10B981)",
              transition: "width 200ms linear",
            }}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-[11px] text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3 h-3" aria-hidden="true" /> {t("clone_privacy_pii")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Brain className="w-3 h-3" aria-hidden="true" /> {t("clone_privacy_versioned")}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="mt-4 text-xs text-white/50 hover:text-white/80 transition focus:outline-none focus-visible:underline"
        >
          {t("clone_skip")}
        </button>
      </div>

      <style>{`
        @keyframes mtcMasterPulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
