"use client";

/**
 * "Refresh learning path" action (adaptive-learning E2E Sprint 3) — wires the
 * existing BFF route POST /api/bff/learners/:learnerId/learning-path/generate
 * (prerequisite-aware regeneration) to the parent progress page.
 */
import * as React from "react";
import { bffFetch } from "@/lib/api/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Phase = "idle" | "pending" | "done" | "error";

export function RefreshLearningPathButton({
  learnerId,
  labels,
}: {
  learnerId: string;
  labels: { idle: string; done: string; error: string };
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");

  async function refresh() {
    setPhase("pending");
    try {
      await bffFetch(`/api/bff/learners/${learnerId}/learning-path/generate`, {
        method: "POST",
      });
      setPhase("done");
      router.refresh();
    } catch {
      setPhase("error");
    }
  }

  return (
    <Button
      variant="outline"
      onClick={refresh}
      disabled={phase === "pending"}
      aria-busy={phase === "pending"}
    >
      {phase === "done" ? labels.done : phase === "error" ? labels.error : labels.idle}
    </Button>
  );
}
