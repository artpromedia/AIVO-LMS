import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "Something went wrong",
  description = "We hit an error loading this. Try again, or come back in a moment.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-aivo-border bg-aivo-surface p-8 text-center",
        className,
      )}
    >
      <AlertTriangle className="h-8 w-8 text-aivo-danger" aria-hidden />
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-aivo-ink-soft">{description}</p>
      {onRetry ? (
        <Button onClick={onRetry} className="mt-4">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
