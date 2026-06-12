"use client";

/**
 * Sprint 12 — the single render path for every body-only beat.
 *
 * The original file rendered welcome / goal / story / micro / celebrate /
 * progress / next through ONE branch; that real seam is preserved here
 * rather than splitting into seven identical components.
 */
import { MathText } from "@/components/learning/math-text";

export function StaticBeat({ body }: { body: string }) {
  return (
    <p className="font-display text-2xl">
      <MathText>{body}</MathText>
    </p>
  );
}
