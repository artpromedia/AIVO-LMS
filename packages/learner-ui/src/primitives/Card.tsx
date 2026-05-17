"use client";
import React from "react";

export interface LearnerCardProps {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "bordered" | "interactive";
  accentColor?: string;
  padding?: "sm" | "md" | "lg" | "xl";
  className?: string;
  onClick?: () => void;
  role?: string;
  "aria-label"?: string;
}

export function LearnerCard({
  children,
  variant = "default",
  accentColor,
  padding = "md",
  className = "",
  onClick,
  ...props
}: LearnerCardProps) {
  const paddingClasses: Record<string, string> = {
    sm: "p-3",
    md: "p-5",
    lg: "p-6",
    xl: "p-8",
  };

  const variantClasses: Record<string, string> = {
    default: "bg-white rounded-2xl border border-slate-100 shadow-sm",
    elevated: "bg-white rounded-2xl shadow-lg",
    bordered: "bg-white rounded-2xl border-2",
    interactive: "bg-white rounded-2xl border-2 border-transparent hover:shadow-xl cursor-pointer transition-all focus-visible:ring-[3px] focus-visible:ring-offset-2",
  };

  const accentStyle = accentColor && (variant === "bordered" || variant === "interactive")
    ? { borderColor: accentColor }
    : undefined;

  const Component = onClick ? "button" : "div";

  return (
    <Component
      className={`${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      style={{
        ...accentStyle,
        transitionDuration: "var(--learner-motion-ms, 300ms)",
      }}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  );
}
