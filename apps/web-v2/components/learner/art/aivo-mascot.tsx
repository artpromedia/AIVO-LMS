/**
 * Aivo — the learner home host. Original SVG owl character, drawn in-repo.
 *
 * A single parametric component renders five expression states by swapping
 * eyes, beak, wing pose, and a small contextual flourish. The art is purely
 * decorative (`aria-hidden`); any meaning is carried by real text + SR labels
 * in the surrounding UI.
 *
 * Motion lives in CSS (app/learner-experience.css): the idle "breathe" and the
 * greeting wave layer on top of these static poses and are slowed under Calm /
 * removed under high-contrast and `prefers-reduced-motion`, so every
 * expression reads correctly with zero animation.
 *
 * Canonical source for the mascot — the /design-preview route re-exports it.
 *
 * NOTE: the literal fills/gradient stops below are the artwork's internal
 * palette (plumage, beak, eyes) — intentionally fixed illustration colors, not
 * themeable UI chrome. Surrounding UI still consumes the brand tokens.
 */
import * as React from "react";

export type AivoExpression = "greeting" | "encouraging" | "celebrating" | "thinking" | "resting";

export function AivoMascot({
  expression = "greeting",
  size = 120,
  className,
  animated = true,
}: {
  expression?: AivoExpression;
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const waving = expression === "greeting";
  const wingsUp = expression === "celebrating";

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-aivo-expression={expression}
      data-animated={animated ? "on" : "off"}
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="42%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#8b6cf6" />
          <stop offset="55%" stopColor="#6b4df0" />
          <stop offset="100%" stopColor="#553fc4" />
        </radialGradient>
        <linearGradient id={`${id}-belly`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdf6ec" />
          <stop offset="100%" stopColor="#f6e6cf" />
        </linearGradient>
        <radialGradient id={`${id}-cheek`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f7a8c9" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#f7a8c9" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="100" cy="180" rx="52" ry="9" fill="#241a47" opacity="0.08" />

      {/* ear tufts */}
      <path d="M64 44 L74 16 L86 48 Z" fill="#553fc4" />
      <path d="M136 44 L126 16 L114 48 Z" fill="#553fc4" />

      {/* breathing group — the idle loop scales this gently */}
      <g className="aivo-breathe">
        {/* body */}
        <ellipse cx="100" cy="108" rx="66" ry="64" fill={`url(#${id}-body)`} />

        {/* feet */}
        <g stroke="#f2a33c" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M84 165 v8 M84 173 l-7 5 M84 173 l7 5" />
          <path d="M116 165 v8 M116 173 l-7 5 M116 173 l7 5" />
        </g>

        {/* belly */}
        <path
          d="M100 70 C70 70 58 96 58 120 C58 150 78 170 100 170 C122 170 142 150 142 120 C142 96 130 70 100 70 Z"
          fill={`url(#${id}-belly)`}
        />

        {/* left wing (learner's-left) */}
        <path
          className={waving ? "aivo-wing-wave" : undefined}
          d={
            wingsUp
              ? "M44 96 C24 70 30 50 40 48 C52 58 56 80 60 104 C56 116 48 112 44 96 Z"
              : "M40 104 C26 110 26 136 42 150 C50 142 52 120 52 104 Z"
          }
          fill="#553fc4"
          style={{ transformOrigin: "48px 100px" }}
        />

        {/* right wing */}
        <path
          d={
            wingsUp
              ? "M156 96 C176 70 170 50 160 48 C148 58 144 80 140 104 C144 116 152 112 156 96 Z"
              : expression === "thinking"
                ? "M158 104 C172 110 168 132 150 138 C140 128 144 112 150 104 Z"
                : "M160 104 C174 110 174 136 158 150 C150 142 148 120 148 104 Z"
          }
          fill="#553fc4"
        />

        {/* face cheeks */}
        <circle cx="74" cy="118" r="16" fill={`url(#${id}-cheek)`} />
        <circle cx="126" cy="118" r="16" fill={`url(#${id}-cheek)`} />

        {/* eyes */}
        <Eyes expression={expression} />

        {/* beak */}
        <path
          d={
            expression === "celebrating" || expression === "encouraging"
              ? "M94 104 Q100 116 106 104 Q100 110 94 104 Z"
              : "M94 102 L106 102 L100 112 Z"
          }
          fill="#f2a33c"
        />
      </g>

      {/* per-expression flourish (decorative, motion-gated) */}
      <Flourish expression={expression} />
    </svg>
  );
}

function Eyes({ expression }: { expression: AivoExpression }) {
  if (expression === "resting") {
    // softly closed — calm curved lashes
    return (
      <g stroke="#2e2152" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M66 92 Q80 100 94 92" />
        <path d="M106 92 Q120 100 134 92" />
      </g>
    );
  }
  if (expression === "celebrating") {
    // happy upward arcs
    return (
      <g stroke="#2e2152" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M66 96 Q80 84 94 96" />
        <path d="M106 96 Q120 84 134 96" />
      </g>
    );
  }
  // open eyes; thinking looks up-left
  const lookX = expression === "thinking" ? -3 : 0;
  const lookY = expression === "thinking" ? -4 : 0;
  return (
    <g>
      <circle cx="80" cy="92" r="15" fill="#fffdf8" />
      <circle cx="120" cy="92" r="15" fill="#fffdf8" />
      <circle cx={80 + lookX} cy={92 + lookY} r="7.5" fill="#2e2152" />
      <circle cx={120 + lookX} cy={92 + lookY} r="7.5" fill="#2e2152" />
      <circle cx={77 + lookX} cy={88 + lookY} r="2.6" fill="#fffdf8" />
      <circle cx={117 + lookX} cy={88 + lookY} r="2.6" fill="#fffdf8" />
      {expression === "encouraging" && (
        <g stroke="#2e2152" strokeWidth="3.5" strokeLinecap="round" fill="none">
          <path d="M66 74 Q80 70 92 76" />
          <path d="M108 76 Q120 70 134 74" />
        </g>
      )}
    </g>
  );
}

function Flourish({ expression }: { expression: AivoExpression }) {
  if (expression === "celebrating") {
    return (
      <g className="aivo-sparkles" fill="#f2a33c">
        <path d="M40 40 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z" />
        <path d="M162 54 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 Z" opacity="0.85" />
        <circle cx="150" cy="30" r="3.5" fill="#f06ba8" />
      </g>
    );
  }
  if (expression === "thinking") {
    return (
      <g className="aivo-think-dot" fill="#8b6cf6">
        <circle cx="150" cy="58" r="4" opacity="0.5" />
        <circle cx="162" cy="46" r="6" opacity="0.8" />
      </g>
    );
  }
  if (expression === "resting") {
    return (
      <g
        className="aivo-zzz"
        fill="#8b6cf6"
        fontFamily="ui-sans-serif, sans-serif"
        fontWeight="700"
      >
        <text x="146" y="58" fontSize="16">
          z
        </text>
        <text x="158" y="44" fontSize="22">
          Z
        </text>
      </g>
    );
  }
  return null;
}
