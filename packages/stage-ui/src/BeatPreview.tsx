/**
 * BeatPreview.tsx — web (DOM) version. Renders a single beat tile in the
 * progress strip with a numbered badge, a beat-type label and (optionally)
 * a 2-line preview of the narration.
 */
import React from "react";
import type { Beat } from "./types.js";

export interface BeatPreviewProps {
  beat: Beat;
  index: number;
  isCurrent?: boolean;
}

export function BeatPreview({ beat, index, isCurrent = false }: BeatPreviewProps) {
  const typeLabel = beat.type.charAt(0).toUpperCase() + beat.type.slice(1);

  return (
    <div
      className={"aivo-beat-preview" + (isCurrent ? " is-current" : "")}
      role="group"
      aria-label={`Beat ${index + 1}: ${typeLabel}`}
      style={{
        minHeight: 44,
        backgroundColor: isCurrent ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: 12,
        margin: "4px 0",
        display: "flex",
        alignItems: "center",
        gap: 10,
        border: isCurrent ? "1px solid #7c3aed" : "1px solid transparent",
        boxSizing: "border-box",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "#4f46e5",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </div>
      <span
        style={{
          color: isCurrent ? "#c4b5fd" : "#94a3b8",
          fontSize: 13,
          fontWeight: 600,
          flex: 1,
        }}
      >
        {typeLabel}
      </span>
      {beat.narration ? (
        <span
          style={{
            color: "#cbd5e1",
            fontSize: 12,
            flex: 2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {beat.narration}
        </span>
      ) : null}
    </div>
  );
}
