"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to console in dev; production errors are already captured server-side.
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-danger">
        Something went wrong
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">Let's try that again.</h1>
      <p className="mt-3 text-aivo-ink-soft">
        We hit an unexpected error. You can retry now, or head home and come back in a moment.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-aivo-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Back to home
        </Button>
      </div>
    </main>
  );
}
