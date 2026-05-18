"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Inclusive-Warm button. All variants resolve through the `iw-*` sensory
 * tokens (see `packages/brand/dist/tailwind/preset.cjs`) so a single click
 * on the sensory-mode toggle repaints every button on the page with no
 * extra wiring.
 *
 * No hardcoded hex anywhere — colors come from `var(--aivo-sensory-*)`.
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold",
    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg",
    "disabled:pointer-events-none disabled:opacity-50",
  ),
  {
    variants: {
      variant: {
        // Primary "pill" CTA — the signature Inclusive-Warm look.
        default: "bg-iw-primary text-iw-primary-fg shadow-md hover:bg-iw-primary-hover",
        // Soft glass card-on-card affordance.
        outline:
          "border border-iw-border bg-iw-raised text-iw-ink hover:bg-iw-card",
        ghost: "text-iw-ink hover:bg-iw-card",
        // Accent (lavender) — used for secondary brand actions.
        accent: "bg-iw-accent text-iw-primary-fg hover:opacity-90",
        // Warm amber call-to-action (used sparingly: rewards, achievements).
        warm: "bg-iw-warm text-iw-ink hover:opacity-90",
        soft: "bg-iw-accent-soft text-iw-ink hover:opacity-90",
        // Destructive — uses the semantic danger token from the base preset
        // (still token-driven, no raw hex).
        danger:
          "bg-aivo-danger text-aivo-primary-fg hover:opacity-90",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-8 text-base",
        hero: "h-[60px] px-10 text-lg",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
