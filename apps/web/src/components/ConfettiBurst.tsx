"use client";
import { useEffect, useMemo, useState } from "react";

/**
 * Lightweight CSS-only confetti burst.
 *
 * Triggered by changing `triggerKey` (a string/number that's stable while
 * the burst should NOT replay and changes when it should). When triggered,
 * mounts ~24 absolutely-positioned scraps that fall + spin via a single
 * CSS keyframe and unmount themselves once the animation completes —
 * never accumulates DOM, never blocks pointer events.
 *
 * Honours `prefers-reduced-motion`: emits a single fade-in/out flash card
 * instead of confetti so the celebratory beat still lands.
 */

interface ConfettiBurstProps {
  /** Change this value to fire a new burst. Identical values are ignored. */
  triggerKey: string | number | null;
  /** Total scraps. Default 24. */
  count?: number;
  /** Duration in ms; the component unmounts itself after this. Default 1600. */
  durationMs?: number;
  /** Optional className appended to the root. */
  className?: string;
}

// Six tier-aware ribbon colours. Pulled from CSS vars so each tier gets a
// confetti palette that matches its mood without prop-drilling.
const COLOR_VARS = [
  "var(--tier-primary, #7C3AED)",
  "var(--tier-accent, #FFB700)",
  "var(--tier-warm, #F8C4A0)",
  "var(--tier-sky, #EDE3FE)",
  "var(--tier-primary-soft, #EDE3FE)",
  "var(--visual-sel, 43 100% 50%)",
];

export default function ConfettiBurst({
  triggerKey,
  count = 24,
  durationMs = 1600,
  className = "",
}: ConfettiBurstProps) {
  const [active, setActive] = useState<string | number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (triggerKey == null || triggerKey === active) return;
    setActive(triggerKey);
    const t = setTimeout(() => setActive(null), durationMs + 100);
    return () => clearTimeout(t);
  }, [triggerKey, durationMs, active]);

  // Pre-compute scrap layout once per burst so re-renders don't re-randomise
  // and produce visual jitter.
  const scraps = useMemo(() => {
    if (active == null) return [];
    return Array.from({ length: count }).map((_, i) => {
      // Deterministic-ish randomisation seeded by index + active key for
      // stable rendering across the burst's lifetime.
      const seed = (i + 1) * 9301 + Number(String(active).length || 1) * 49297;
      const rand = (n: number) => ((seed * (n + 7)) % 1000) / 1000;
      const left = rand(1) * 100;
      const drift = (rand(2) - 0.5) * 60;
      const delay = rand(3) * 250;
      const dur = durationMs - 300 + rand(4) * 300;
      const rot = rand(5) * 720 - 360;
      const color = COLOR_VARS[i % COLOR_VARS.length];
      const w = 6 + rand(6) * 6;
      const h = 10 + rand(7) * 8;
      return { i, left, drift, delay, dur, rot, color, w, h };
    });
  }, [active, count, durationMs]);

  if (active == null) return null;

  if (reducedMotion) {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 flex justify-center z-40 ${className}`}
      >
        <div
          className="px-4 py-2 mt-4 rounded-full text-xs font-bold"
          style={{
            background: "color-mix(in srgb, var(--tier-accent, #FFB700) 35%, transparent)",
            color: "var(--tier-text, #292F3D)",
            animation: `confetti-flash ${Math.min(durationMs, 1200)}ms ease-out forwards`,
          }}
        >
          ✨ Section complete!
        </div>
        <style jsx>{`
          @keyframes confetti-flash {
            0% { opacity: 0; transform: translateY(-6px); }
            20%, 70% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-6px); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 overflow-hidden z-40 ${className}`}
    >
      {scraps.map((s) => (
        <span
          key={s.i}
          style={{
            position: "absolute",
            top: "-8px",
            left: `${s.left}%`,
            width: `${s.w}px`,
            height: `${s.h}px`,
            background: s.color,
            borderRadius: "2px",
            opacity: 0.95,
            animation: `confetti-fall ${s.dur}ms cubic-bezier(0.2, 0.6, 0.4, 1) ${s.delay}ms forwards`,
            ["--drift" as string]: `${s.drift}px`,
            ["--rot" as string]: `${s.rot}deg`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% {
            transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(var(--rot, 360deg));
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
