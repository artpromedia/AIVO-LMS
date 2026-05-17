import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type LessonStepState = "done" | "active" | "todo";

export function LessonStepCard({
  index,
  title,
  description,
  state,
}: {
  index: number;
  title: string;
  description?: string;
  state: LessonStepState;
}) {
  const Icon = state === "done" ? CheckCircle2 : state === "active" ? PlayCircle : Circle;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-card)] border bg-aivo-surface p-4",
        state === "active" ? "border-aivo-primary" : "border-aivo-border",
      )}
      aria-current={state === "active" ? "step" : undefined}
    >
      <Icon
        className={cn(
          "mt-0.5 h-5 w-5",
          state === "done" && "text-aivo-success",
          state === "active" && "text-aivo-primary",
          state === "todo" && "text-aivo-muted",
        )}
        aria-hidden
      />
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
          Step {index}
        </p>
        <p className="mt-0.5 font-medium">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-aivo-ink-soft">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
