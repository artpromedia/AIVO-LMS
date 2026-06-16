"use client";
import React from "react";

import { SEMANTIC } from "@aivo/brand";
export interface LearnerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "break";
  size?: "standard" | "large" | "xl";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  accentColor?: string;
  fullWidth?: boolean;
}

export function LearnerButton({
  variant = "primary",
  size = "standard",
  icon,
  iconPosition = "left",
  accentColor,
  fullWidth = false,
  children,
  className = "",
  style,
  ...props
}: LearnerButtonProps) {
  const sizeClasses: Record<string, string> = {
    standard:
      "min-h-[var(--learner-hit-target,48px)] min-w-[var(--learner-hit-target,48px)] px-6 py-3 text-base",
    large:
      "min-h-[var(--learner-hit-target,56px)] min-w-[var(--learner-hit-target,56px)] px-8 py-4 text-lg",
    xl: "min-h-[var(--learner-hit-target,72px)] min-w-[var(--learner-hit-target,72px)] px-10 py-5 text-xl",
  };

  const variantClasses: Record<string, string> = {
    primary:
      "bg-gradient-to-r from-iw-purple-600 to-iw-purple-700 text-white shadow-soft-3 hover:shadow-soft-5 hover:scale-[1.02] active:scale-[0.98]",
    secondary:
      "bg-white border-2 border-iw-border text-iw-ink hover:border-iw-purple-300 hover:bg-iw-purple-100",
    ghost: "bg-transparent text-iw-ink-muted hover:bg-iw-raised",
    break:
      "bg-iw-accent-soft text-iw-teal-800 border border-iw-accent hover:brightness-95",
  };

  const accentStyle =
    accentColor && variant === "primary"
      ? { background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, ...style }
      : style;

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-iw-control font-iw-display font-bold
        transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2
        disabled:opacity-50 disabled:pointer-events-none
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `.trim()}
      style={
        {
          ...accentStyle,
          fontSize: "var(--learner-base-font, inherit)",
          letterSpacing: "var(--learner-letter-spacing, 0)",
          transitionDuration: "var(--learner-motion-ms, 300ms)",
          "--tw-ring-color": accentColor || SEMANTIC.color.text.accent,
        } as React.CSSProperties
      }
      {...props}
    >
      {icon && iconPosition === "left" && (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      {children && <span>{children}</span>}
      {icon && iconPosition === "right" && (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
}
