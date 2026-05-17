"use client";
import React from "react";

export interface LiveRegionProps {
  message: string;
  politeness?: "polite" | "assertive";
  atomic?: boolean;
  className?: string;
}

export function LiveRegion({
  message,
  politeness = "polite",
  atomic = true,
  className = "",
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className={`sr-only ${className}`}
    >
      {message}
    </div>
  );
}
