"use client";
import React from "react";
import { SkipLink } from "../a11y/SkipLink";

export interface LearnerShellProps {
  topBar: React.ReactNode;
  children: React.ReactNode;
  breakCloud?: React.ReactNode;
  celebration?: React.ReactNode;
  liveRegion?: React.ReactNode;
  className?: string;
}

export function LearnerShell({
  topBar,
  children,
  breakCloud,
  celebration,
  liveRegion,
  className = "",
}: LearnerShellProps) {
  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-purple-50 via-white to-cyan-50 ${className}`}
      style={{ fontSize: "var(--learner-base-font, 16px)" }}
    >
      <SkipLink />
      {celebration}
      {topBar}
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      {breakCloud}
      {liveRegion}
    </div>
  );
}
