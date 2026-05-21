import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea primitive. Shape and tone tokens match `Input` so a form
 * mixing single-line and multi-line fields reads as one control set,
 * not two.
 */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[6.5rem] w-full rounded-iw-control border border-iw-border bg-iw-raised px-3.5 py-2.5 text-sm text-iw-ink leading-relaxed",
      "placeholder:text-iw-ink-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-1 focus-visible:ring-offset-iw-bg",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-aivo-danger aria-[invalid=true]:focus-visible:ring-aivo-danger",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
