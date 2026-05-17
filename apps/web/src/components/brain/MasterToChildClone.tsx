"use client";
/**
 * MasterToChildClone
 * ------------------
 * The "cloning" narrative stage for the brain build flow. Renders the
 * AIVO master brain on the left, the child's still-empty virtual brain
 * on the right, and an animated particle stream flowing between them.
 *
 * Replaces the placeholder spinner that used to occupy `pageMode === "cloning"`
 * on the brain-review page so parents actually *see* the source brain
 * mirroring into the child's brain.
 *
 * Behaviour:
 *  - ~5s scripted sequence with a Skip button.
 *  - Particles are colour-coded by domain (math/ela/science/sel/speech/EF).
 *  - As each particle reaches the child silhouette, the corresponding
 *    region of the child brain lights up.
 *  - Honours `prefers-reduced-motion`: drops particle motion in favour
 *    of a cross-fade.
 *  - Tier-aware (uses `var(--tier-primary)` / `--tier-sky` so it matches
 *    K-5 / 6-8 / 9-12 chrome).
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Brain, Lock, Sparkles } from "lucide-react";
import AudioMuteToggle from "@/components/AudioMuteToggle";
import { playChime, playSwell } from "@/lib/audio";
import { markSeenClone } from "@/lib/clone-flags";

interface MasterToChildCloneProps {
  learnerName: string;
  /** Called when the animation completes naturally or the user skips. */
  onComplete?: () => void;
  /** Sticky caption while particles flow. Optional — defaults to a generic line. */
  caption?: string;
  /** Total scripted duration in milliseconds. Defaults to 5000 (~5s). */
  durationMs?: number;
  /**
   * If provided, the component records that this learner's parent has now
   * watched the cloning animation in full (used by the brain-review page
   * to auto-skip on revisit while keeping a "Replay clone" button).
   */
  learnerId?: string;
}

const DOMAIN_PARTICLES = [
  { key: "ela", color: "#F59E0B", angle: -28 },
  { key: "math", color: "#3B82F6", angle: -10 },
  { key: "science", color: "#10B981", angle: 6 },
  { key: "sel", color: "#EC4899", angle: 22 },
  { key: "speech", color: "#8B5CF6", angle: 38 },
  { key: "executive", color: "#06B6D4", angle: -42 },
];

export default function MasterToChildClone({
  learnerName,
  onComplete,
  caption,
  durationMs = 5000,
  learnerId,
}: MasterToChildCloneProps) {
  const reactId = useId();
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
        // Persist "seen" so the parent can opt into auto-skip on revisit
        // and the "Replay clone" button on the review screen works as a
        // deliberate replay rather than the only way to discover the moment.
        if (learnerId) markSeenClone(learnerId);
        // Defer onComplete to the next macro-task so consumers can safely
        // unmount this component without React warning about state
        // updates during a render cycle.
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
    [progress]
  );

  // Fire a per-region chime exactly once when each particle first arrives.
  // Uses a ref-set so React's StrictMode double-invocation in dev can't
  // trigger duplicate audio. Pitches climb the C-major pentatonic so the
  // sequence reads as a positive arpeggio regardless of domain ordering.
  useEffect(() => {
    const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5 D5 E5 G5 A5 C6
    for (let i = 0; i < arrivedCount && i < DOMAIN_PARTICLES.length; i++) {
      const key = DOMAIN_PARTICLES[i].key;
      if (chimedDomainsRef.current.has(key)) continue;
      chimedDomainsRef.current.add(key);
      playChime({ frequency: PENTATONIC[i % PENTATONIC.length], duration: 0.32, volume: 0.13 });
    }
  }, [arrivedCount]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, color-mix(in srgb, var(--tier-sky, #3F2D6E) 55%, transparent), transparent 70%), linear-gradient(to bottom right, #1a0a3e, #0f172a, #0c1222)",
        color: "white",
      }}
      role="status"
      aria-live="polite"
      aria-label={`Cloning AIVO's learning model into ${learnerName}'s personal brain`}
    >
      <div className="max-w-3xl w-full text-center relative">
        <div className="absolute right-0 top-0">
          <AudioMuteToggle compact />
        </div>
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          Cloning Brain
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
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
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
              AIVO Master Brain
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
              {learnerName}'s Brain
            </text>
          </g>

          {/* Particles travelling master → child. Skipped under reduced-motion. */}
          {!reducedMotion &&
            DOMAIN_PARTICLES.map((p, i) => {
              // Stagger each particle's start so the stream feels continuous.
              const startFrac = i / DOMAIN_PARTICLES.length;
              const localProgress = Math.max(
                0,
                Math.min(1, (progress - startFrac * 0.6) / 0.45)
              );
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

        <p className="mt-4 text-base md:text-lg font-heading font-bold">
          {caption ||
            `Cloning AIVO's learning model into ${learnerName}'s personal brain…`}
        </p>
        <p className="mt-1 text-xs md:text-sm text-white/60 max-w-md mx-auto">
          {progress < 0.95
            ? `Personalising for ${learnerName}'s grade and profile`
            : "Almost ready — finalising the personalised brain"}
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-md mx-auto mt-5 bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(progress * 100)}%`,
              background:
                "linear-gradient(90deg, #A78BFA, #7C3AED, #06B6D4, #10B981)",
              transition: "width 200ms linear",
            }}
          />
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3 h-3" aria-hidden="true" /> No PII leaves this device unencrypted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Brain className="w-3 h-3" aria-hidden="true" /> Versioned · rollback any time
          </span>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="mt-4 text-xs text-white/50 hover:text-white/80 transition focus:outline-none focus-visible:underline"
        >
          Skip animation
        </button>
      </div>

      <style jsx>{`
        @keyframes mtcMasterPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.95;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
