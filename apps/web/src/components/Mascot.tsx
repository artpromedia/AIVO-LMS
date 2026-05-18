"use client";
import { useEffect, useState } from "react";

/**
 * Lightweight CSS-animated mascot used as a celebratory accent when a
 * learner gets a correct answer (or hits a section milestone). Deliberately
 * implemented without Lottie or any heavy animation library — the same
 * visual budget can be hit with a couple of looped SVG transforms, and we
 * keep the asset surface (and the `npm` dep tree) small.
 *
 * Honours `prefers-reduced-motion`: animation is replaced with a static
 * smile that scales to opacity-1 and stays put.
 */

export type MascotMood = "cheer" | "encourage" | "idle";

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  /** Visible label / aria-label for screen readers. */
  label?: string;
  className?: string;
}

const PALETTE: Record<MascotMood, { body: string; accent: string }> = {
  cheer: { body: "var(--tier-primary, #7C3AED)", accent: "var(--tier-accent, #FFB700)" },
  encourage: { body: "var(--tier-warm, #F8C4A0)", accent: "var(--tier-primary, #7C3AED)" },
  idle: { body: "var(--tier-primary-soft, #EDE3FE)", accent: "var(--tier-primary, #7C3AED)" },
};

export default function Mascot({ mood = "idle", size = 96, label, className = "" }: MascotProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const { body, accent } = PALETTE[mood];
  const animate = !reducedMotion;

  return (
    <div
      className={`inline-block ${className}`}
      style={{ width: size, height: size, lineHeight: 0 }}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id="mascot-glow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glow halo (only animated for cheer mood) */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="url(#mascot-glow)"
          style={
            animate && mood === "cheer"
              ? {
                  animation: "mascot-pulse calc(1.6s * var(--tier-pace, 1)) ease-in-out infinite",
                  transformOrigin: "50% 50%",
                }
              : undefined
          }
        />

        {/* Body */}
        <g
          style={
            animate
              ? mood === "cheer"
                ? {
                    animation: "mascot-bounce calc(1s * var(--tier-pace, 1)) ease-in-out infinite",
                    transformOrigin: "50% 70%",
                  }
                : mood === "idle"
                  ? {
                      animation:
                        "mascot-sway calc(2.6s * var(--tier-pace, 1)) ease-in-out infinite",
                      transformOrigin: "50% 70%",
                    }
                  : undefined
              : undefined
          }
        >
          <ellipse cx="50" cy="58" rx="28" ry="30" fill={body} />
          {/* Eyes */}
          <circle cx="40" cy="52" r="3" fill="#1F1535" />
          <circle cx="60" cy="52" r="3" fill="#1F1535" />
          <circle cx="41" cy="51" r="0.9" fill="#FFFFFF" />
          <circle cx="61" cy="51" r="0.9" fill="#FFFFFF" />
          {/* Smile */}
          <path
            d={mood === "encourage" ? "M40 66 Q50 70 60 66" : "M40 64 Q50 74 60 64"}
            stroke="#1F1535"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Cheek blush */}
          <ellipse cx="34" cy="62" rx="3" ry="2" fill={accent} opacity="0.55" />
          <ellipse cx="66" cy="62" rx="3" ry="2" fill={accent} opacity="0.55" />
        </g>
      </svg>
      <style jsx>{`
        @keyframes mascot-bounce {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-6%) scale(1.04);
          }
        }
        @keyframes mascot-sway {
          0%,
          100% {
            transform: rotate(-3deg);
          }
          50% {
            transform: rotate(3deg);
          }
        }
        @keyframes mascot-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.12);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
