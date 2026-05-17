/**
 * CelebrationOverlay.tsx — full-screen celebration animation for web.
 * CSS keyframes back the pop-in & fade-out instead of `Animated.spring`.
 * Reduced-motion users see the same end state with a 100ms cross-fade
 * instead of a 400ms scale spring.
 */
import React, { useEffect, useState } from "react";

export interface CelebrationOverlayProps {
  visible: boolean;
  xpEarned: number;
  coinsEarned: number;
  onComplete?: () => void;
  reducedMotion?: boolean;
}

const KEYFRAMES = `
@keyframes aivo-celebration-pop {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes aivo-celebration-fade {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
`;

export function CelebrationOverlay({
  visible,
  xpEarned,
  coinsEarned,
  onComplete,
  reducedMotion = false,
}: CelebrationOverlayProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setFading(false);
      return;
    }
    const fadeAt = reducedMotion ? 600 : 1900;
    const completeAt = reducedMotion ? 800 : 2200;
    const fadeTimer = setTimeout(() => setFading(true), fadeAt);
    const doneTimer = setTimeout(() => {
      setFading(false);
      onComplete?.();
    }, completeAt);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [visible, reducedMotion, onComplete]);

  if (!visible) return null;

  const animation = fading
    ? "aivo-celebration-fade 300ms ease forwards"
    : reducedMotion
      ? "none"
      : "aivo-celebration-pop 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards";

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label={`Great job! You earned ${xpEarned} XP and ${coinsEarned} coins.`}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: fading ? 0 : 1,
        transition: "opacity 300ms ease",
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          backgroundColor: "#1e1b4b",
          borderRadius: 24,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          border: "2px solid #7c3aed",
          minWidth: 240,
          animation,
        }}
      >
        <span style={{ fontSize: 56 }} aria-hidden="true">
          🎉
        </span>
        <strong style={{ color: "#f8fafc", fontSize: 28, fontWeight: 800 }}>Amazing!</strong>
        <span style={{ color: "#c4b5fd", fontSize: 18, fontWeight: 600 }}>
          +{xpEarned} XP · +{coinsEarned} coins
        </span>
      </div>
    </div>
  );
}
