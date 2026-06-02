"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /**
   * Render a small "Required" indicator after the label text. Defaults
   * to a single `*` glyph; pass `"text"` to render the word "Required"
   * in a chip. Pairs with the `required` attribute on the linked input,
   * which is what assistive tech actually reads.
   */
  readonly required?: boolean | "text";
  /**
   * Render a soft "(optional)" hint after the label. Mutually exclusive
   * with `required`. Replaces the convention of typing "(optional)" into
   * the label string by hand, which read with the same visual weight as
   * the field name and made required-vs-optional impossible to scan.
   */
  readonly optional?: boolean;
}

export const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  ({ className, required, optional, children, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "inline-flex items-baseline gap-1.5 text-sm font-semibold leading-none text-iw-ink",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {required === true && (
        <span aria-hidden="true" className="text-aivo-danger">
          *
        </span>
      )}
      {required === "text" && (
        <span className="rounded-full bg-aivo-danger/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-aivo-danger">
          Required
        </span>
      )}
      {optional && !required && (
        <span className="text-xs font-normal text-iw-ink-muted">Optional</span>
      )}
    </LabelPrimitive.Root>
  ),
);
Label.displayName = "Label";
