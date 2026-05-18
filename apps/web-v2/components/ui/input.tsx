import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "h-11 w-full rounded-full border border-iw-border bg-iw-raised px-4 text-sm text-iw-ink",
      "placeholder:text-iw-ink-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-1 focus-visible:ring-offset-iw-bg",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
