"use client";
import React, { useEffect, useState } from "react";

import { SEMANTIC } from "@aivo/brand";
export interface PreviewOverlayProps {
  isVisible: boolean;
  title: string;
  icon?: React.ReactNode;
  description?: string;
  autoAdvanceMs?: number;
  onReady: () => void;
  onDismiss?: () => void;
  accentColor?: string;
}

export function PreviewOverlay({
  isVisible,
  title,
  icon,
  description,
  autoAdvanceMs = 0,
  onReady,
  onDismiss,
  accentColor = SEMANTIC.color.text.accent,
}: PreviewOverlayProps) {
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (!isVisible || !autoAdvanceMs || interacted) return;
    const timer = setTimeout(onReady, autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [isVisible, autoAdvanceMs, interacted, onReady]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      style={{ transitionDuration: "var(--learner-motion-ms, 300ms)" }}
    >
      <div
        className="bg-white rounded-iw-card-lg shadow-soft-5 p-8 max-w-sm w-full mx-4 text-center"
        role="alert"
      >
        {icon && (
          <div className="text-5xl mb-3" aria-hidden="true">
            {icon}
          </div>
        )}
        <p className="text-sm font-bold text-iw-ink-muted uppercase tracking-wider mb-1">Coming up</p>
        <h3 className="text-xl font-iw-display font-bold mb-2" style={{ color: accentColor }}>
          {title}
        </h3>
        {description && <p className="text-iw-ink-muted text-sm mb-4">{description}</p>}
        <button
          onClick={() => {
            setInteracted(true);
            onReady();
          }}
          className="px-8 py-3 rounded-iw-control text-white font-iw-display font-bold text-lg shadow-soft-3 hover:shadow-soft-5 hover:scale-[1.02] active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            minHeight: "var(--learner-hit-target, 48px)",
          }}
        >
          I'm ready
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-3 text-sm text-iw-ink-muted hover:text-iw-ink-muted font-bold transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
