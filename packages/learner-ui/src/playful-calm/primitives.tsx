"use client";

import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "playful" | "audio";
type ButtonSize = "sm" | "md" | "lg" | "xl" | "hero";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "var(--aivo-semantic-color-interactive-primary-default, #3b82f6)",
  secondary: "var(--aivo-semantic-color-interactive-secondary-default, #f43f5e)",
  ghost: "transparent",
  playful: "var(--aivo-color-lavender-500, #8b5cf6)",
  audio: "var(--aivo-semantic-color-interactive-audio-default, #34d399)",
};
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "48px",
  md: "56px",
  lg: "56px",
  xl: "64px",
  hero: "72px",
};

export interface PlayfulButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", style, ...props }: PlayfulButtonProps) {
  const isGhost = variant === "ghost";
  return (
    <button
      {...props}
      style={{
        minHeight: BUTTON_SIZES[size],
        borderRadius: "var(--aivo-radius-xl, 24px)",
        background: BUTTON_VARIANTS[variant],
        color: isGhost
          ? "var(--aivo-semantic-color-text-primary, #111827)"
          : "var(--aivo-semantic-color-text-onPrimary, #fff)",
        border: isGhost ? "2px solid var(--aivo-semantic-color-border-default, #d1d5db)" : "none",
        padding: "0 20px",
        fontWeight: 700,
        transition:
          "transform var(--aivo-motion-duration-fast, 150ms) var(--aivo-motion-easing-spring-bounce, ease)",
        ...style,
      }}
    />
  );
}

export function Card({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      style={{
        borderRadius: "var(--aivo-radius-xl, 24px)",
        background: "var(--aivo-semantic-color-surface-base, #fff)",
        boxShadow: "var(--aivo-shadow-soft-2, 0 6px 12px rgba(59,130,246,.1))",
        border: "1px solid var(--aivo-semantic-color-border-subtle, #e5e7eb)",
        ...style,
      }}
    />
  );
}

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    style={{
      minHeight: "56px",
      borderRadius: "var(--aivo-radius-lg, 16px)",
      border: "2px solid var(--aivo-semantic-color-border-default, #d1d5db)",
      padding: "0 16px",
      width: "100%",
      ...(props.style ?? {}),
    }}
  />
);

export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    style={{
      minHeight: "56px",
      borderRadius: "var(--aivo-radius-lg, 16px)",
      border: "2px solid var(--aivo-semantic-color-border-default, #d1d5db)",
      padding: "0 16px",
      width: "100%",
      ...(props.style ?? {}),
    }}
  />
);

export const Checkbox = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input type="checkbox" {...props} style={{ width: 24, height: 24, ...props.style }} />
);

export const Radio = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input type="radio" {...props} style={{ width: 24, height: 24, ...props.style }} />
);

export const Switch = ({
  checked,
  ...props
}: { checked: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    aria-pressed={checked}
    {...props}
    style={{
      width: 64,
      height: 36,
      borderRadius: 9999,
      border: 0,
      padding: 4,
      background: checked
        ? "var(--aivo-semantic-color-interactive-primary-default, #3b82f6)"
        : "var(--aivo-semantic-color-border-default, #d1d5db)",
      ...props.style,
    }}
  />
);

export function Badge({ style, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      style={{
        display: "inline-flex",
        borderRadius: "var(--aivo-radius-pill, 9999px)",
        padding: "6px 12px",
        background: "var(--aivo-semantic-color-interactive-primary-default, #3b82f6)",
        color: "var(--aivo-semantic-color-text-onPrimary, #fff)",
        fontSize: 12,
        ...style,
      }}
    />
  );
}

export const Chip = Badge;
export const Tag = Badge;

export function Avatar({ label, src, size = 56 }: { label: string; src?: string; size?: number }) {
  return src ? (
    <img src={src} alt={label} width={size} height={size} style={{ borderRadius: 9999 }} />
  ) : (
    <div
      aria-label={label}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: "var(--aivo-color-calmSky-200, #bfdbfe)",
      }}
    />
  );
}

export function Modal({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true">
      {children}
    </div>
  );
}

export function Sheet({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true">
      {children}
    </div>
  );
}

export const Toast = ({ children }: { children: React.ReactNode }) => (
  <div role="status">{children}</div>
);

export const Tooltip = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <span aria-label={label}>{children}</span>
);

export const ProgressBar = ({ value }: { value: number }) => (
  <div
    aria-label="Progress"
    style={{
      width: "100%",
      height: 12,
      borderRadius: 9999,
      background: "var(--aivo-semantic-color-border-subtle, #e5e7eb)",
    }}
  >
    <div
      style={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        height: "100%",
        borderRadius: 9999,
        background: "var(--aivo-semantic-color-interactive-primary-default, #3b82f6)",
      }}
    />
  </div>
);

export const ProgressRing = ({ value }: { value: number }) => {
  const pct = Math.max(0, Math.min(100, value));
  const dash = 226;
  const offset = dash - (dash * pct) / 100;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" aria-label="Progress ring">
      <circle
        cx="44"
        cy="44"
        r="36"
        stroke="var(--aivo-semantic-color-border-subtle, #e5e7eb)"
        strokeWidth="8"
        fill="none"
      />
      <circle
        cx="44"
        cy="44"
        r="36"
        stroke="var(--aivo-semantic-color-interactive-primary-default, #3b82f6)"
        strokeWidth="8"
        fill="none"
        strokeDasharray={dash}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
      />
    </svg>
  );
};

export const XPMeter = ({ xp, goal }: { xp: number; goal: number }) => (
  <ProgressBar value={(xp / Math.max(goal, 1)) * 100} />
);
export const StreakFlame = ({ days }: { days: number }) => (
  <Badge aria-label={`Streak ${days} days`}>🔥 {days} day streak</Badge>
);

export const Tabs = ({ children }: { children: React.ReactNode }) => (
  <div role="tablist">{children}</div>
);

export const Accordion = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

export const Stepper = ({ steps, currentStep }: { steps: string[]; currentStep: number }) => (
  <ol>
    {steps.map((step, idx) => (
      <li key={step} aria-current={idx === currentStep ? "step" : undefined}>
        {step}
      </li>
    ))}
  </ol>
);
