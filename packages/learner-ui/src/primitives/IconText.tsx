"use client";
import React from "react";

export interface IconTextProps {
  icon: React.ReactNode;
  text: string;
  hideText?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function IconText({
  icon,
  text,
  hideText = false,
  size = "md",
  className = "",
}: IconTextProps) {
  const sizeClasses: Record<string, string> = {
    sm: "text-sm gap-1.5",
    md: "text-base gap-2",
    lg: "text-lg gap-2.5",
    xl: "text-xl gap-3",
  };

  return (
    <span className={`inline-flex items-center ${sizeClasses[size]} ${className}`}>
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      {hideText ? (
        <span className="sr-only">{text}</span>
      ) : (
        <span style={{ fontSize: "var(--learner-base-font, inherit)" }}>{text}</span>
      )}
    </span>
  );
}
