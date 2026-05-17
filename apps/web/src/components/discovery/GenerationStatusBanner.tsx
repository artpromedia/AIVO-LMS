"use client";
import type { CSSProperties } from "react";

export type GenerationSource = "ai" | "cache" | "fallback";
export type PersonalizationLevel = "full" | "partial" | "none";

export interface GenerationStatus {
  source: GenerationSource;
  personalizationLevel: PersonalizationLevel;
  retrying?: boolean;
  rejectedCount?: number;
  reason?: string;
}

export interface GenerationStatusBannerProps {
  status: GenerationStatus;
  /**
   * When true, render the technical view (rejected counts, reason
   * codes). Defaults to false so that learner-facing surfaces always
   * see the supportive copy.
   */
  technical?: boolean;
  onRetry?: () => void;
  onContinueWithFallback?: () => void;
}

const containerStyle: CSSProperties = {
  borderRadius: 12,
  padding: 16,
  margin: "12px 0",
  border: "1px solid rgba(148,163,184,0.4)",
  backgroundColor: "rgba(254,243,199,0.5)",
  color: "#1f2937",
  fontFamily: "inherit",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 8,
};

export function GenerationStatusBanner({
  status,
  technical = false,
  onRetry,
  onContinueWithFallback,
}: GenerationStatusBannerProps) {
  const shouldShow =
    status.source === "fallback" ||
    status.personalizationLevel !== "full" ||
    (status.rejectedCount ?? 0) > 0 ||
    status.retrying === true;

  if (!shouldShow) return null;

  const learnerCopy = status.retrying
    ? "I'm getting your personalized adventure ready..."
    : "I'm getting your personalized adventure ready. We can try again or continue with a warm-up.";

  return (
    <section role="status" aria-live="polite" style={containerStyle}>
      <p style={{ margin: 0, fontWeight: 600 }}>{learnerCopy}</p>
      {technical ? (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>
          source={status.source}, personalization={status.personalizationLevel},
          {status.rejectedCount !== undefined ? ` rejected=${status.rejectedCount},` : ""}
          {status.reason ? ` reason=${status.reason}` : ""}
        </p>
      ) : null}
      <div style={buttonRowStyle}>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={status.retrying}
            aria-label="retry personalized generation"
          >
            Try again
          </button>
        ) : null}
        {onContinueWithFallback ? (
          <button
            type="button"
            onClick={onContinueWithFallback}
            aria-label="continue with warm-up activity"
          >
            Continue with warm-up
          </button>
        ) : null}
      </div>
    </section>
  );
}
