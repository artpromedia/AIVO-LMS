"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RetryPanel({
  title,
  message,
  onRetry,
  className,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  const [pending, setPending] = React.useState(false);
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius-card)] border border-aivo-warning/30 bg-aivo-warning/10 p-4",
        className,
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-aivo-ink-soft">{message}</p>
      <Button
        size="sm"
        className="mt-3"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await onRetry();
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Retrying…" : "Retry"}
      </Button>
    </div>
  );
}
