"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ParentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[parent/error]", error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-danger">Parent area</p>
      <h1 className="mt-2 font-display text-4xl font-bold">Something went wrong here.</h1>
      <p className="mt-3 text-aivo-ink-soft">
        Your learner's data is safe. We hit an unexpected error loading this page. You can retry, or
        go back to your parent home.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-aivo-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/parent/home">Parent home</Link>
        </Button>
      </div>
    </main>
  );
}
