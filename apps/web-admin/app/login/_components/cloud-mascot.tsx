/**
 * CloudMascot — the friendly AIVO support-cloud illustration, mirrored from the
 * consumer auth surfaces so the admin sign-in shares the redesign's visual
 * language. Purely decorative (`aria-hidden`). The fills are the artwork's
 * fixed internal palette, intentionally not themeable chrome.
 */
import * as React from "react";

export function CloudMascot({ size = 220, className }: { size?: number; className?: string }) {
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
    >
      <defs>
        <linearGradient id={`${id}-cloud`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e7eefc" />
        </linearGradient>
        <radialGradient id={`${id}-cheek`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="120" cy="206" rx="62" ry="10" fill="#1d4ed8" opacity="0.08" />

      <g fill="#e3ecfb" stroke="#cfe0fa" strokeWidth="2">
        <ellipse cx="58" cy="96" rx="15" ry="13" />
      </g>

      <g fill={`url(#${id}-cloud)`} stroke="#d7e4fb" strokeWidth="2">
        <circle cx="86" cy="128" r="40" />
        <circle cx="120" cy="108" r="46" />
        <circle cx="158" cy="126" r="38" />
        <ellipse cx="120" cy="150" rx="68" ry="40" />
      </g>

      <g fill="none" stroke="#2563eb" strokeWidth="7" strokeLinecap="round">
        <path d="M78 104 Q120 64 162 104" />
      </g>
      <g fill="#1d4ed8">
        <rect x="68" y="104" width="16" height="30" rx="8" />
        <rect x="156" y="104" width="16" height="30" rx="8" />
      </g>
      <g fill="none" stroke="#1d4ed8" strokeWidth="5" strokeLinecap="round">
        <path d="M76 132 Q66 158 96 160" />
      </g>
      <circle cx="98" cy="160" r="5" fill="#1d4ed8" />

      <circle cx="98" cy="142" r="11" fill={`url(#${id}-cheek)`} />
      <circle cx="146" cy="142" r="11" fill={`url(#${id}-cheek)`} />
      <g fill="#172033">
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
        stroke="#172033"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      <g>
        <rect x="108" y="156" width="26" height="24" rx="8" fill="#e7eefc" stroke="#cfe0fa" strokeWidth="1.5" />
        <text
          x="121"
          y="174"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="800"
          fontSize="16"
          fill="#2563eb"
        >
          A
        </text>
      </g>

      <g fill="#60a5fa">
        <path d="M196 64 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" opacity="0.9" />
        <path d="M40 150 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 Z" opacity="0.7" />
      </g>
      <circle cx="186" cy="96" r="3" fill="#38bdf8" />
      <circle cx="64" cy="70" r="3.5" fill="#93c5fd" />
    </svg>
  );
}

CloudMascot.displayName = "Admin/CloudMascot";
