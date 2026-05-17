"use client";
import React from "react";

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
    standard: "min-h-[var(--learner-hit-target,48px)] min-w-[var(--learner-hit-target,48px)] px-6 py-3 text-base",
    large: "min-h-[var(--learner-hit-target,56px)] min-w-[var(--learner-hit-target,56px)] px-8 py-4 text-lg",
    xl: "min-h-[var(--learner-hit-target,72px)] min-w-[var(--learner-hit-target,72px)] px-10 py-5 text-xl",
  };

  const variantClasses: Record<string, string> = {
    primary: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
    secondary: "bg-white border-2 border-slate-200 text-slate-700 hover:border-purple-300 hover:bg-purple-50",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    break: "bg-gradient-to-r from-sky-100 to-blue-100 text-sky-700 border border-sky-200 hover:from-sky-200 hover:to-blue-200",
  };

  const accentStyle = accentColor && variant === "primary"
    ? { background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, ...style }
    : style;

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-2xl font-heading font-bold
        transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2
        disabled:opacity-50 disabled:pointer-events-none
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `.trim()}
      style={{
        ...accentStyle,
        fontSize: "var(--learner-base-font, inherit)",
        letterSpacing: "var(--learner-letter-spacing, 0)",
        transitionDuration: "var(--learner-motion-ms, 300ms)",
        "--tw-ring-color": accentColor || "#7C3AED",
      } as React.CSSProperties}
      {...props}
    >
      {icon && iconPosition === "left" && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      {children && <span>{children}</span>}
      {icon && iconPosition === "right" && <span className="shrink-0" aria-hidden="true">{icon}</span>}
    </button>
  );
}
