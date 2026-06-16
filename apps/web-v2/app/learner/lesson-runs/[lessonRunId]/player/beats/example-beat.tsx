"use client";

/** Sprint 12 — worked-example beat: prompt + explanation. */
import { MathText } from "@/components/learning/math-text";
import type { Beat } from "../beats";

export function ExampleBeat({ beat }: { beat: Extract<Beat, { kind: "example" }> }) {
  return (
    <>
      <p className="font-display text-2xl">
        <MathText>{beat.prompt}</MathText>
      </p>
      <p className="text-iw-ink-muted">
        <MathText>{beat.explanation}</MathText>
      </p>
    </>
  );
}
