/**
 * Per-tutor avatar characters, drawn in-repo from a shared "creature kit"
 * (same eye proportions + soft round silhouette + ear tufts as Aivo) so the
 * whole cast reads as one family. Each is tinted with its tutor brand color
 * from `@aivo/brand` TUTORS.
 *
 *   • NovaCharacter — Mathematics — a comet/star-sprite
 *   • SageCharacter — English Language Arts — a leafy book-sprite
 *   • TutorCharacter — generic kit creature for every other tutor, tinted by
 *     the tutor's brand color (replaces the flat monogram discs).
 *
 * Decorative (`aria-hidden`); the tutor's name is rendered as real text
 * alongside. Canonical source — the /design-preview route re-exports these.
 *
 * NOTE: literal fills below are the characters' internal palette (tinted from
 * the @aivo/brand TUTORS colors) — intentional illustration colors, not
 * themeable UI chrome. Surrounding UI uses brand tokens.
 */
import * as React from "react";

function KitFace({ look = 0 }: { look?: number }) {
  return (
    <g>
      <circle cx={84 + look} cy="86" r="11" fill="#fffdf8" />
      <circle cx={116 + look} cy="86" r="11" fill="#fffdf8" />
      <circle cx={85 + look} cy="87" r="5.5" fill="#2e2152" />
      <circle cx={117 + look} cy="87" r="5.5" fill="#2e2152" />
      <circle cx={83 + look} cy="84" r="2" fill="#fffdf8" />
      <circle cx={115 + look} cy="84" r="2" fill="#fffdf8" />
      <path
        d="M88 104 Q100 116 112 104"
        stroke="#2e2152"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

export function NovaCharacter({ size = 96, className }: { size?: number; className?: string }) {
  const id = React.useId().replace(/[:]/g, "");
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <radialGradient id={`${id}-b`} cx="42%" cy="34%" r="80%">
          <stop offset="0%" stopColor="#9a7bf7" />
          <stop offset="60%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#5b27b4" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="178" rx="46" ry="8" fill="#241a47" opacity="0.08" />
      <g className="tutor-orbit" fill="#f2c94c">
        <path d="M150 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" />
        <circle cx="44" cy="58" r="3.5" fill="#f06ba8" />
        <circle cx="160" cy="120" r="3" fill="#fffdf8" opacity="0.9" />
      </g>
      <path
        d="M100 38 C140 38 158 74 158 112 C158 150 132 172 100 172 C68 172 42 150 42 112 C42 74 60 38 100 38 Z"
        fill={`url(#${id}-b)`}
      />
      <path
        d="M100 50 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 Z"
        fill="#f2c94c"
        opacity="0.85"
      />
      <KitFace />
    </svg>
  );
}

export function SageCharacter({ size = 96, className }: { size?: number; className?: string }) {
  const id = React.useId().replace(/[:]/g, "");
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <radialGradient id={`${id}-b`} cx="42%" cy="34%" r="80%">
          <stop offset="0%" stopColor="#34d8a8" />
          <stop offset="60%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#0b8c62" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="178" rx="46" ry="8" fill="#241a47" opacity="0.08" />
      <ellipse cx="100" cy="110" rx="60" ry="62" fill={`url(#${id}-b)`} />
      <g className="tutor-leaf" fill="#0b8c62" style={{ transformOrigin: "100px 52px" }}>
        <path d="M100 54 C100 30 84 22 76 20 C78 36 86 50 100 54 Z" />
        <path d="M100 54 C100 30 116 22 124 20 C122 36 114 50 100 54 Z" />
      </g>
      <path
        d="M62 118 C76 110 92 110 100 118 C108 110 124 110 138 118 L138 148 C124 140 108 140 100 148 C92 140 76 140 62 148 Z"
        fill="#fdf6ec"
      />
      <path d="M100 118 v30" stroke="#cdbfa3" strokeWidth="3" />
      <KitFace />
    </svg>
  );
}

/**
 * Generic kit creature for any tutor, tinted by its brand `color`. Soft round
 * body + ear tufts (kinship with Aivo) + the shared friendly face, with a
 * small white-alpha highlight and dark-alpha base so a single hex reads with
 * depth (no per-tutor gradient stops needed).
 */
export function TutorCharacter({
  color,
  size = 96,
  className,
}: {
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <ellipse cx="100" cy="178" rx="44" ry="8" fill="#241a47" opacity="0.08" />
      {/* ear tufts */}
      <path d="M70 60 L78 34 L92 62 Z" fill={color} opacity="0.85" />
      <path d="M130 60 L122 34 L108 62 Z" fill={color} opacity="0.85" />
      {/* body */}
      <ellipse cx="100" cy="112" rx="60" ry="60" fill={color} />
      {/* base shade + top highlight for depth from a single hex */}
      <ellipse cx="100" cy="138" rx="60" ry="34" fill="#000000" opacity="0.1" />
      <ellipse cx="84" cy="88" rx="34" ry="26" fill="#ffffff" opacity="0.18" />
      {/* belly */}
      <ellipse cx="100" cy="124" rx="34" ry="32" fill="#fdf6ec" opacity="0.95" />
      <KitFace />
    </svg>
  );
}
