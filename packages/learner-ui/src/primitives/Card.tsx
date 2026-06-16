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
    default: "bg-white rounded-iw-card border border-iw-border shadow-soft-1",
    elevated: "bg-white rounded-iw-card shadow-soft-3",
    bordered: "bg-white rounded-iw-card border-2",
    interactive:
      "bg-white rounded-iw-card border-2 border-transparent hover:shadow-soft-5 cursor-pointer transition-all focus-visible:ring-[3px] focus-visible:ring-offset-2",
  };

  const accentStyle =
    accentColor && (variant === "bordered" || variant === "interactive")
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
