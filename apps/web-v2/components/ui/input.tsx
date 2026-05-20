import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Text input primitive. Uses the `iw-control` radius (14 px) — the
 * token specifically defined for form controls in the Inclusive-Warm
 * design system. Do NOT use `rounded-full` here: a pill input is fine
 * for a one-off search box but reads as a children's-app filter chip
 * when stamped across every field of a multi-field form.
 */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3.5 text-sm text-iw-ink",
      "placeholder:text-iw-ink-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-1 focus-visible:ring-offset-iw-bg",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-aivo-danger aria-[invalid=true]:focus-visible:ring-aivo-danger",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
