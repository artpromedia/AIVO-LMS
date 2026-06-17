/**
 * CloudMascot — the friendly AIVO support-cloud illustration used across the
 * authentication surfaces (the waving cloud with a headset in the design
 * mockups). Purely decorative (`aria-hidden`); meaning is carried by the
 * surrounding text.
 *
 * Variants:
 *   wave    — default greeting, one arm raised
 *   shield  — hugs a verification shield (MFA / "confirm it's you")
 *   headset — calm, hands down (support / SSO)
 *
 * The fills below are the artwork's fixed internal palette (lavender cloud,
 * navy features) — intentionally not themeable chrome, matching the existing
 * AivoMascot convention. The soft halo behind it is rendered by the caller.
 */
/* eslint-disable no-restricted-syntax -- This is fixed decorative SVG artwork
   with its own internal palette (lavender cloud, navy features, purple shield),
   not themeable surface chrome. Same convention as
   components/learner/art/aivo-mascot.tsx; meaning is carried by surrounding
   text and the mascot is aria-hidden. */
import * as React from "react";

export type CloudMascotVariant = "wave" | "shield" | "headset";

export function CloudMascot({
  variant = "wave",
  size = 220,
  className,
}: {
  variant?: CloudMascotVariant;
  size?: number;
  className?: string;
}) {
  const id = React.useId().replace(/[:]/g, "");
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-variant={variant}
    >
      <defs>
        <linearGradient id={`${id}-cloud`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ede9fe" />
        </linearGradient>
        <radialGradient id={`${id}-cheek`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f9a8d4" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#f9a8d4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-shield`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c6cf6" />
          <stop offset="100%" stopColor="#5b46d6" />
        </linearGradient>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="120" cy="206" rx="62" ry="10" fill="#5b46d6" opacity="0.08" />

      {/* raised waving arm (left) */}
      {variant !== "shield" ? (
        <g
          fill="#e9e3ff"
          stroke="#d6cdf8"
          strokeWidth="2"
          className="aivo-cloud-wave"
          style={{ transformOrigin: "70px 120px" }}
        >
          <ellipse cx="58" cy="96" rx="15" ry="13" />
        </g>
      ) : null}

      {/* cloud body — overlapping puffs sharing one fill read as a cloud */}
      <g fill={`url(#${id}-cloud)`} stroke="#e3dcfb" strokeWidth="2">
        <circle cx="86" cy="128" r="40" />
        <circle cx="120" cy="108" r="46" />
        <circle cx="158" cy="126" r="38" />
        <ellipse cx="120" cy="150" rx="68" ry="40" />
      </g>

      {/* headset band + ear cups + mic boom */}
      <g fill="none" stroke="#6b5cf0" strokeWidth="7" strokeLinecap="round">
        <path d="M78 104 Q120 64 162 104" />
      </g>
      <g fill="#5b46d6">
        <rect x="68" y="104" width="16" height="30" rx="8" />
        <rect x="156" y="104" width="16" height="30" rx="8" />
      </g>
      <g fill="none" stroke="#5b46d6" strokeWidth="5" strokeLinecap="round">
        <path d="M76 132 Q66 158 96 160" />
      </g>
      <circle cx="98" cy="160" r="5" fill="#5b46d6" />

      {/* face: cheeks, eyes, smile */}
      <circle cx="98" cy="142" r="11" fill={`url(#${id}-cheek)`} />
      <circle cx="146" cy="142" r="11" fill={`url(#${id}-cheek)`} />
      <g fill="#2e2152">
        <ellipse cx="106" cy="128" rx="5" ry="7" />
        <ellipse cx="140" cy="128" rx="5" ry="7" />
      </g>
      <g fill="#fffdf8">
        <circle cx="104" cy="125" r="1.8" />
        <circle cx="138" cy="125" r="1.8" />
      </g>
      <path
        d="M112 142 Q123 152 134 142"
        fill="none"
        stroke="#2e2152"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* belly badge "A" (hidden behind the shield in the shield variant) */}
      {variant !== "shield" ? (
        <g>
          <rect x="108" y="156" width="26" height="24" rx="8" fill="#ede9fe" stroke="#d6cdf8" strokeWidth="1.5" />
          <text
            x="121"
            y="174"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="800"
            fontSize="16"
            fill="#6b5cf0"
          >
            A
          </text>
        </g>
      ) : null}

      {/* verification shield (shield variant) */}
      {variant === "shield" ? (
        <g>
          <path
            d="M120 150 L150 160 V184 C150 200 137 210 120 216 C103 210 90 200 90 184 V160 Z"
            fill={`url(#${id}-shield)`}
          />
          <path
            d="M108 186 l8 8 16 -18"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : null}

      {/* decorative sparkles */}
      <g fill="#a78bfa">
        <path d="M196 64 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" opacity="0.9" />
        <path d="M40 150 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 Z" opacity="0.7" />
      </g>
      <circle cx="186" cy="96" r="3" fill="#5eead4" />
      <circle cx="64" cy="70" r="3.5" fill="#c4b5fd" />
    </svg>
  );
}

CloudMascot.displayName = "Auth/CloudMascot";
