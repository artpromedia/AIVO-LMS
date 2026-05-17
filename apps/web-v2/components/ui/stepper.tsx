import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type StepperStep = { label: string; description?: string };

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: StepperStep[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-3", className)} aria-label="Progress">
      {steps.map((step, idx) => {
        const state = idx < current ? "done" : idx === current ? "active" : "todo";
        return (
          <li key={step.label} className="flex items-center gap-2">
            <span
              aria-current={state === "active" ? "step" : undefined}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                state === "done" && "border-aivo-primary bg-aivo-primary text-aivo-primary-fg",
                state === "active" && "border-aivo-primary text-aivo-primary",
                state === "todo" && "border-aivo-border text-aivo-muted",
              )}
            >
              {state === "done" ? <Check className="h-4 w-4" /> : idx + 1}
            </span>
            <span className="text-sm text-aivo-ink-soft">{step.label}</span>
            {idx < steps.length - 1 ? (
              <span aria-hidden className="mx-1 h-px w-6 bg-aivo-border" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
