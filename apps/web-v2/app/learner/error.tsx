"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LearnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[learner/error]", error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-danger">
        Hmm — that didn't work.
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">
        Let's take a quick breath and try again.
      </h1>
      <p className="mt-3 text-aivo-ink-soft">
        Your progress is saved. Tap "Try again" to come right back, or visit
        home for your next mission.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-aivo-muted">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/learner/home">My home</Link>
        </Button>
      </div>
    </main>
  );
}
