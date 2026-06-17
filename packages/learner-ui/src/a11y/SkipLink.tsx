"use client";
import React from "react";

export interface SkipLinkProps {
  targetId?: string;
  label?: string;
}

export function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-6 focus:py-3 focus:bg-iw-primary focus:text-white focus:rounded-iw-control focus:font-bold focus:shadow-soft-5 focus:outline-none focus:ring-2 focus:ring-white"
    >
      {label}
    </a>
  );
}
