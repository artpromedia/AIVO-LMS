"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-aivo-primary text-aivo-primary-fg hover:opacity-90",
        outline: "border border-aivo-border bg-aivo-surface text-aivo-ink hover:bg-aivo-surface-2",
        ghost: "text-aivo-ink hover:bg-aivo-surface-2",
        soft: "bg-aivo-primary-soft text-aivo-primary hover:opacity-90",
        danger: "bg-aivo-danger text-white hover:opacity-90",
        playful: "bg-[var(--aivo-color-lavender-500)] text-white shadow-soft-3 hover:scale-[1.02] active:scale-[0.98]",
        audio: "bg-[var(--aivo-semantic-color-interactive-audio-default)] text-white hover:opacity-90",
      },
      size: {
        sm: "h-12 px-3",
        md: "h-14 px-4",
        lg: "h-14 px-6 text-base",
        xl: "h-16 px-8 text-base",
        hero: "h-[72px] px-10 text-lg",
        icon: "h-10 w-10",
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
