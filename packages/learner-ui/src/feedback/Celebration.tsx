"use client";
import React, { useEffect, useState } from "react";

export interface CelebrationProps {
  isVisible: boolean;
  tutorName?: string;
  tutorColor?: string;
  message?: string;
  durationMs?: number;
  motionBudget?: number;
  onDismiss?: () => void;
}

export function Celebration({
  isVisible,
  tutorName,
  tutorColor = "#7C3AED",
  message = "Great job!",
  durationMs = 2500,
  motionBudget = 8,
  onDismiss,
}: CelebrationProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        onDismiss?.();
      }, durationMs);
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [isVisible, durationMs, onDismiss]);

  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        setShow(false);
        onDismiss?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show, onDismiss]);

  if (!show || motionBudget === 0) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="text-center pointer-events-auto cursor-pointer"
        onClick={() => {
          setShow(false);
          onDismiss?.();
        }}
        role="button"
        tabIndex={0}
        aria-label="Dismiss celebration"
      >
        <div
          className="text-7xl mb-2"
          style={{
            animation: motionBudget > 2 ? "bounce 0.6s ease-in-out" : "none",
          }}
        >
          🌟
        </div>
        <p
          className="text-2xl font-heading font-bold text-white drop-shadow-lg"
          style={{ color: tutorColor }}
        >
          {message}
        </p>
        {tutorName && (
          <p className="text-sm text-white/80 drop-shadow mt-1">
            — {tutorName}
          </p>
        )}
      </div>
    </div>
  );
}
